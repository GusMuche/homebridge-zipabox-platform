'use strict';

var ZipaboxApi = require('./zipaboxApi'); // for request to API
var ZipAccessory = require('./zipAccessory') // for management of Zipabox Accessory specification

/* Link this module to homebridge. */
var Accessory, Service, Characteristic, UUIDGen;

/* Export with homebridge values */
module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  return ZipaPlatform;
};


/*
  Class ZipaPlatform manage the platform function with homebridge
*/
class ZipaPlatform{
  /*
    Constructor of Zipaplatform class
    log : log objet of the plugin
    config : config json object from config.json
  */
  constructor (log, config, homeBridgeApi) {
    /* Base variable initialisation */
    this.log = log;
    this.config = config;
    /* Homebridge linking */
    this.homebridge = homeBridgeApi;
    /* Check for configuration of the Plugin */
    this.disabled = false;
    this.debug = false;
    this.connectionError = false;
    this.connectionOnGoing = false;
    this.firstLaunch = true;
    if (!config) {
      this.log.warn(`[PTFM] Ignoring ZipaboxPlatform  setup because it is not configured`);
      this.disabled = true;
      return;
    }
    /* Debug */
    this.debug = config["debug"];
    this.debug && this.log.warn("[PTFM] DEBUG - Debug mode configured by user for ALL the accessory.");
    this.debugApi = config["debugApi"] || false;
    /* Cache flush */
    // After v1.8.25, we reset always
    this.reset = true;

    /* Box configuration */
    this.user = config["username"] || "ERROR";
    this.password = config["password"] || "ERROR";
    if(this.name == "ERROR" || this.password == "ERROR")
      this.log.warn("[PTFM] WARNING : no username or password, please check config.json.");
    this.connectionLocal = config.connection.local || "ERROR";
    this.IP = config.connection.server_ip || "ERROR";
    this.apiVersion = config.connection.api_version || "ERROR";
    /* Server configuration */
    if(this.connectionLocal == "ERROR"){
      this.log.warn("[PTFM] WARNING : no local or remote mode selected, forced to remote.");
      this.connectionLocal = false;
    }
    if(this.connectionLocal != false && this.connectionLocal != true){
      this.log.warn("[PTFM] WARNING : wrong selection for local or remote connection, forced to remote.");
      this.connectionLocal = false;
    }
    if(this.connectionLocal == true && this.IP == "ERROR"){
      this.log.warn("[PTFM] WARNING : no IP found. Please check config. Forced to remote.");
      this.connectionLocal = false;
    }
    if(!this.connectionLocal && this.apiVersion == "ERROR"){
      this.log.warn("[PTFM] WARNING : na PI version selected. Please check config. Forced to V2.");
      this.apiVersion = "remoteV2";
    }
    if(this.connectionLocal){
      this.baseURL = "http://"+this.IP+":8080/zipato-web/v2/";
      this.debug && this.log("[PTFM] Local access URL : ",this.baseURL);
    }else{
      if(this.apiVersion == "remoteV2"){
        this.debug && this.log("[PTFM] Remote access configured by the user with v2 API.");
        this.baseURL = "https://my.zipato.com:443/zipato-web/v2/";
      }else{
        this.debug && this.log("[PTFM] Remote access configured by the user. V3 API used");
        this.baseURL = "https://my3.zipato.com:443/zipato-web/v2/";
      }
    }

    /* Check for box serial for V3 API */
    this.boxSerial = config["boxSerial"] || "ERROR";
    if(this.boxSerial == "ERROR" && this.apiVersion == "remoteV3"){
      this.log.error("--- !!! --- ");
      this.log.error("No serial given for the BOX with V3 API request. System will not work. Please check config.json.");
      this.log.error("--- !!! --- ");
    }

    /* PIN for alarm accessory */
    this.pin = config["pin"] || "noPin";
    if(this.pin != "noPin")
      this.debug && this.log("[PTFM] Pin for alarm option is specified");
    this.alarmIsConfigured = false; // will be change to true if user specify an alarm

    /* Refresh for timePolling */
    this.timePolling = config["refresh"] || 10;
    if(this.timePolling != 0)
      this.debug && this.log("[PTFM] User request to refresh the value after (seconds)",this.timePolling);
    if(this.timePolling <= 0){
      this.debug && this.log.warn("[PTFM] User didnt specify a correct refresh rate for central Refresh. Fixed to 10s.");
      this.timePolling = 10;
    }
    this.timePolling = this.timePolling * 1000; // turn to milliseconds
    this.timeOut = null; // will be launch after connection

    /* Accessories */
    this.accessoriesConfig = config.accessories || [];
    if(this.accessoriesConfig == [])
      this.log.warn("[PTFM] No accessory configured, please check config.json.");
    this.zipAccessories = [];
    this.devicesStatuses = {}; // dictionnary for all the devices statuses
    this.attributesValues = {}; // dictionnary for all the attributes values
    this.cachedAccessoriesToDelete = [];
    this.checkDoubleConfig(); // Check if user config two accessories with same UUID
    this.checkIfAlarm();
    /* Zipabox API Object */
    this.zipabox = new ZipaboxApi(this.debugApi,this.baseURL,this.log,this.user,this.password,this.boxSerial);
    /* Cached accessories loaded */
    this.homebridge.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  } // end constructor


  /*
    configureAccessory
    Method is invoked when homebridge tries to restore cached accessory.
  */
  configureAccessory(accessory){
    /* Check if platform used. If not delete accessory */
    if(this.disabled){
      this.log.warn("[PTFM] Found an orphelin Accessory configured before. Delete them :",accessory.displayName);
      this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "ZipaboxPlatform", [accessory]);
      return;
    }
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method configureAccessory from cache");
    //this.debug && this.log("Accessory to configure :", accessory);
    //this.debug && this.log("[PTFM] [configureAccessory] Accessory to configure UUID :",accessory.UUID);
    //this.debug && this.log("[PTFM] [configureAccessory] Accessory to configure name :",accessory.displayName);

    accessory.updateReachability(false); // Add begining the accessory is not reachable

    /* No more reuse from archived accessories, direct save to delete after cache upload */
    this.cachedAccessoriesToDelete.push(accessory);
  } // end of configureAccessory function


  /*
    didFinishLaunching
    homebridge already finished loading cached accessories.
    Load the other accessories from config.json
  */
  didFinishLaunching(){
    /* Check if platform used */
    if(this.disabled)
      return;
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method didFinishLaunching");

    /* Delete the cached accessories no more configured */
    if(this.cachedAccessoriesToDelete.length > 0){
      this.debug && this.log("[PTFM] [didFinishLaunching] removing the accessories from cache. #:",this.cachedAccessoriesToDelete.length);
      for (var index = 0; index < this.cachedAccessoriesToDelete.length; index++) {
        this.removePlatformAccessory(this.cachedAccessoriesToDelete[index]);
        delete this.cachedAccessoriesToDelete[index];
      }
    }

    /* Remove all accessory still there */
    this.removeAllAccessories();

    /* Add all configured accessory */
    for (var index in this.accessoriesConfig){
      this.debug && this.log("[PTFM] [didFinishLaunching] Add the accessory :",this.accessoriesConfig[index].name);
      if(this.accessoriesConfig[index].hidden){
        this.debug && this.log("[PTFM] [didFinishLaunching] Hidden accessory pass :",this.accessoriesConfig[index].name);
      }else{
        this.addAccessory(this.accessoriesConfig[index]);
      }
    }

    /* Launch the box */
    this.debug && this.log.warn("[PTFM] [didFinishLaunching] All loaded in HomeBridge, starting connection process");
    this.connectTheBox()
    .then(function launchPolling(){
      /* User information for alarm */
      if(this.alarmIsConfigured && !this.connectionError)
        this.debug && this.log("[PTFM] [connectTheBox] User is connected to the security partition");
      /* Launch polling */
      this.statusPolling();
    }.bind(this))
  } // end of didFinishLaunching function


  /*
    addAccessory add a new accessory based on the configuration of the user
  */
  addAccessory(accessoryJSON){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method addAccessory");
    this.debug && this.log("[PTFM] [addAccessory] Accessory name :",accessoryJSON.name);
    this.debug && this.log("[PTFM] [addAccessory] Accessory first UUID :",accessoryJSON.services[0].uuid);
    /* UUID of the accessory based on UUID gen of homebridge */
    /* Cause we add the name and the UUID, user can configure two accessory for same UUID with different names */
    var uuidGen = UUIDGen.generate(accessoryJSON.services[0].uuid+accessoryJSON.name);
    this.debug && this.log("[PTFM] [addAccessory] Accessory UUIDGen :",uuidGen);
    this.debug && this.log("[PTFM] [addAccessory] New accessory to add :", accessoryJSON.name);
    var zipAccessory = new ZipAccessory(this.debug,this.log,this.zipabox,Accessory,Service,Characteristic,accessoryJSON,uuidGen);
    this.zipAccessories.push(zipAccessory);
    this.homebridge.registerPlatformAccessories("homebridge-zipabox-platform", "ZipaboxPlatform", [zipAccessory.platformAccessory]);
    /* User check */
    !this.debug && this.log("Accessory added to the platform :",accessoryJSON.name)
  } // End function addAccessory


  /*
    Method connectTheBox. Will simply... connect the box = init > login > get all Devices UUID
    If user specify an alarm and a pin, the method will process the security init > login
  */
  connectTheBox(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method connectTheBox");

    this.connectionOnGoing = true;

    /* Launch connection */
    return this.zipabox.connectUser()
    .then(this.zipabox.selectBox.bind(this.zipabox))
    .then(this.checkUUIDAttributes.bind(this))
    .then(this.manageDevicesUUID.bind(this))
    .catch(function manageError(error) {
      /* Wrong user or password error */
      if (error.message.substr(0,21) == "invalid json response"){
          this.log.error("Connection error, please check username and password");
          this.log.error("All accessories will be deleted");
          this.removeAllAccessories();
          this.connectionError = true;
          this.connectionOnGoing = false;
      }else{
        this.log.error("[PTFM] [connectTheBox] Unexpexted error before security : ",error);
        this.connectionOnGoing = false;
        //throw new Error(error);
      }
    }.bind(this))
    /* Security connection if needed */
    .then(function connectSecurityIfNeeded(notUsedReturn){
      if(this.alarmIsConfigured && !this.connectionError){
        this.debug && this.log("[PTFM] [connectTheBox] Alarm found after zipa connection > connect to the alarm.")
        return this.zipabox.connectSecurity(this.pin);
      }else{
        return null; // same for previous Promise without alarm
      }
    }.bind(this))
    .then(function endInformationAfterAPIRequest(notUsedReturn){
      /* User information for alarm */
      if(this.alarmIsConfigured && !this.connectionError)
        this.debug && this.log("[PTFM] [connectTheBox] User is connected to the security partition");
      this.connectionOnGoing = false;
    }.bind(this))
    .catch(function manageError(error) {
      if(!this.connectionError){
        this.log.error("[PTFM] [connectTheBox] Error on connectTheBox after security :",error);
        this.connectionOnGoing = false;
        throw new Error(error);
      }
    }.bind(this));
  } // end connectTheBox function

  /*
  statusPolling refresh all accessory after the parameter seconds
  */
  statusPolling(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method statusPolling");
        // this.debug && this.log("[PTFM] [statusPolling] Central refresh ?",this.centralRefresh);

    /* Loop through devices */
    this.zipabox.getAllDevicesStatuses()
    .then(function updateDevicesStatus(newDevicesStatuses){
      /* Populate the this.devicesStatuses with new value */
      var status = null
      for (var zipAccesory of this.zipAccessories){
        status = this.getNewDeviceStatus(newDevicesStatuses,zipAccesory.getDeviceUUIDfix(),zipAccesory.getNoStatus());
        if(status != undefined){
          if(status == "true")
            status = true;
          if(status == "false")
            status = false;
          this.devicesStatuses[zipAccesory.getDeviceUUIDfix()] = status;
          zipAccesory.setCentralDeviceStatus(status); // update status
          this.debug && this.log("[PTFM] [statusPolling] Device ",zipAccesory.getDeviceUUIDfix(), "status", status, zipAccesory.getDebugContext());
        }else{
          this.log.error("[PTFM] [statusPolling] No devices found for UUID",zipAccesory.getDeviceUUIDfix(),zipAccesory.getDebugContext());
        }
      }
    }.bind(this))
    .then(this.zipabox.getAllAttributesValues.bind(this.zipabox))
    .then(function updateAttributesValues(newAttributesValues){
      var value = null;
      var uuids = [];
      for (var zipAccesory of this.zipAccessories){
        uuids = zipAccesory.getUUIDs();
        for (var uuid of uuids){
          value = this.getNewAttributeValue(newAttributesValues,uuid);
          if(value != undefined){
            value = zipAccesory.translateAttribute(value,uuid)
            this.attributesValues[uuid] = value;
            zipAccesory.setLast(value,uuid);
            this.debug && this.log("[PTFM] [statusPolling] Attributes", uuid, "value", value, zipAccesory.getDebugContext());
          }else{
            this.log.error("[PTFM] [statusPolling] No attributes found for UUID",uuid,zipAccesory.getDebugContext());
          }
        }
      }
    }.bind(this))
    .then(function followStatusPolling(){
      this.timeOut = setTimeout(function refreshAccessories(){
        this.statusPolling();
      }.bind(this),this.timePolling)// end function of timeout
    }.bind(this))
    .catch(function manageError(error){
      this.debug && this.log.error("[PTFM] [statusPolling] Error in big update search :",error,error.message);
      this.debug && this.log.error("[PTFM] [statusPolling] Reconnection requested.");
      if(this.connectionOnGoing){
        this.debug && this.log.error("[PTFM] [statusPolling] Reconnection aborded, still in connection process.");
      }else{
        this.connectTheBox();
      }
    }.bind(this));
  } // end statusPolling function


  /*
  Used to return the new value of the corresponding attributes
  Input mut be the return of the attributes value from API and the UUID of the attribute to search
  */
  getNewAttributeValue(attributesValues,attributeUUID){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method getNewAttributeValue");
    // Search the new value
    for (var attribute in attributesValues){
      if(attributesValues[attribute].uuid == attributeUUID){
        this.debug && this.log("[PTFM] [getNewAttributeValue] Found the UUID and new value :",attributesValues[attribute].uuid,attributesValues[attribute].value.value);
        return attributesValues[attribute].value.value;
      }
    }
    this.debug && this.log("[PTFM] [getNewAttributeValue] No attributes found for UUID :",attributeUUID);
    return undefined;
  }


  /*
  Used to return the new status of a device
  Input must be the return of the devices Statuses and UUID the device to search
  */
  getNewDeviceStatus(devicesStatuses,deviceUUID,noStatus){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method getNewDeviceStatus");
    if(noStatus)
      return true;
    // Search the new status
    for (var device in devicesStatuses){
      if(devicesStatuses[device].uuid == deviceUUID){
        this.debug && this.log("[PTFM] [getNewDeviceStatus] Found the UUID and new status :",devicesStatuses[device].uuid,devicesStatuses[device].state.online);
        return devicesStatuses[device].state.online;
      }
    }
    this.debug && this.log("[PTFM] [getNewDeviceStatus] No device found for UUID :",deviceUUID);
    return false;
  }

  /*
  configurationRequestHandler from homebrige examples not implemented
  */
  configurationRequestHandler(context, request, callback){
    this.log("[PTFM] [configurationRequestHandler] NOT IMPLEMENTED");
    this.log("[PTFM] [configurationRequestHandler] context :", context);
    this.log("[PTFM] [configurationRequestHandler] request : ", request);

  } // end configurationRequestHandler function


  /*
  removePlatformAccessory delete the accessory from cache and in the accessories array
  */
  removePlatformAccessory(accessoryPlatform){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method removePlatformAccessory");

    /* Get the accessory out from HomeBridge */
    accessoryPlatform.updateReachability(false);
    this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "ZipaboxPlatform", [accessoryPlatform]);
    this.debug && this.log("[PTFM] [removePlatformAccessory] Unregister this accessory :",accessoryPlatform.displayName, accessoryPlatform.UUID);

    /* Delete the accessory from the accessories array */
    if(this.isAccessoryStored(accessoryPlatform.UUID)){
      let index = this.getZipAccessoryIndexByUUID(accessoryPlatform.UUID);
      this.debug && this.log("[PTFM] [removePlatformAccessory] Delete this accessory :",accessoryPlatform.UUID);
      /* Desactivate the accessory to stop polling */
      this.zipAccessories[index].desactivate();
      let removed = this.zipAccessories.splice(index,1);
      this.debug && this.log("[PTFM] [removePlatformAccessory] Length of accessories after remove :",this.zipAccessories.length);
      removed = null;
    }else{
      this.debug && this.log("[PTFM] [removePlatformAccessory] Accessory is not stored.");
    }
  } // end removePlatformAccessory function


  /*
  removeAllAccessories will remove... all... accessories (cache and array)
  */
  removeAllAccessories(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method removeAllAccessories");
    var allPlatformAccessories = [];
    for (var index = 0; index < this.zipAccessories.length; index++) {
      this.debug && this.log("[PTFM] [removeAllAccessories] Remove",this.zipAccessories[index].platformAccessory.displayName);
      this.zipAccessories[index].desactivate();
      allPlatformAccessories.push(this.zipAccessories[index].platformAccessory);
    }
    this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "ZipaboxPlatform", allPlatformAccessories);
    //this.homebridge.updatePlatformAccessories([accessory])
    this.zipAccessories = [];
  } // end removeAllAccessories function


  /*
    isAccessoryStored
    return true if accessory is saved inside this.accessories
    @param accessoryConfigUUID : UUID from first config file
  */
  isAccessoryStored(accessoryPlatformUUID){
    /* context is like the config json */
    if (this.getZipAccessoryIndexByUUID(accessoryPlatformUUID) != null)
      return true;
    else
      return false;
  } // end function isAccessoryStored


  /*
  getZipAccessoryIndexByUUID return the index (int) for a specific accessoryPlatform uuid
  */
  getZipAccessoryIndexByUUID(accessoryPlatformUUID){
      /* DEBUG */
      this.debug && this.log("[PTFM] > Method getZipAccessoryIndexByUUID");
      /* Loop on the accessories to find the one with the good UUID */
      for (var index = 0; index < this.zipAccessories.length; index++) {
        if(this.zipAccessories[index].getUUID() == accessoryPlatformUUID){
          //this.debug && this.log("[PTFM] [getZipAccessoryIndexByUUID] Index found :",index);
          return index;
        }
      } // end for
      //this.log.warn("[PTFM] [getZipAccessoryIndexByUUID] Accessory requested not found for uuid",accessoryPlatformUUID);
      return null;
  } // end function getZipAccessoryIndexByUUID


  /*
  checkDoubleConfig check all the configuration and verify if the user config a accessory twice
  */
  checkDoubleConfig(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method checkDoubleConfig");
    /* Search for same config */
    for(var indexSearch in this.accessoriesConfig){
      for(var indexCheck in this.accessoriesConfig){
        if(this.accessoriesConfig[indexSearch].uuid == this.accessoriesConfig[indexCheck].uuid && indexSearch != indexCheck && this.accessoriesConfig[indexSearch].name == this.accessoriesConfig[indexCheck].name)
          this.log.warn('[PTFM] [checkDoubleConfig] WARNING : same UUID for different accessories, please check config.json.', this.accessoriesConfig[indexSearch].name, this.accessoriesConfig[indexCheck].name);
      } // end for
    } // end for
  } // end function checkDoubleConfig


  /*
  checkIfAlarm specify if the user config an alam accessory and if yes check for pin
  */
  checkIfAlarm(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method checkIfAlarm");
    for(var indexA in this.accessoriesConfig){
      for(var indexS in this.accessoriesConfig[indexA].services){
        if(this.accessoriesConfig[indexA].services[indexS].type == "alarm")
          this.alarmIsConfigured = true;
      }
    }
    if(this.alarmIsConfigured && this.pin == "noPin")
      this.log.error("[PTFM] [checkIfAlarm] No pin configured with an alarm specified. Plugin will crash. See config.json");
  }


  /*
  Manage Device UUID return a Promise will all method getDeviceUUID for each accessory
  */
  manageDevicesUUID(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method manageDevicesUUID");

    var promiseArray = [];
    this.debug && this.log("[PTFM] [manageDevicesUUID] Length of zipAccessories :",this.zipAccessories.length);
    for (var index = 0; index < this.zipAccessories.length; index++) {
      var zipAccessory = this.zipAccessories[index];
      // this.debug && this.log("[PTFM] [manageDevicesUUID] ZipAccesory :",zipAccessory);
      // this.debug && this.log("[PTFM] [manageDevicesUUID] Type of zipAccesory :",typeof(zipAccessory));
      promiseArray.push(zipAccessory.getDeviceUUID()); // quick answer if already know, else API request
      // if(this.centralRefresh)
      //   this.devicesStatuses[zipAccesory.getDeviceUUID()] = null;
    } // end for
    return Promise.all(promiseArray);
  } // end manageDevicesUUID function


  /*
  checkUUIDAttributes get all the attributes available in the box and compare with the user list
  */
  checkUUIDAttributes(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method checkUUIDAttributes");
    /* Verify first launch or not */
    if(!this.firstLaunch){
      return true;
    }else{
      this.firstLaunch = false;
      return this.zipabox.getAllAttributes()
      .then(function checkUUIDs(attributesUUID){
        var platformAccessoryToDelete = [];
        this.debug && this.log("[PTFM] [checkUUIDAttributes] Length of zipAccessories already stored :",this.zipAccessories.length);
        this.debug && this.log("[PTFM] [checkUUIDAttributes] Length of attributesUUID from the box :",attributesUUID.length);
        for(var indexSearch = 0; indexSearch < this.zipAccessories.length; indexSearch++){
          this.debug && this.log("[PTFM] [checkUUIDAttributes] Actual index :",indexSearch);
          var uuids = this.zipAccessories[indexSearch].getUUIDs();
          var types = this.zipAccessories[indexSearch].getTypes();
          for (var indexServices in uuids){
            var isValable = false;
            if(types[indexServices] == "alarm" || uuids[indexServices] == "rebootBox" || uuids[indexServices] == "rebootHomebridge" || uuids[indexServices] == "disconnectBox"){
              isValable = true;
            }else{
              for(var indexCheck = 0; indexCheck < attributesUUID.length; indexCheck++){
                if(uuids[indexServices] == attributesUUID[indexCheck].uuid)
                  isValable = true;
              } // end for
            } // end else
            this.debug && this.log("[PTFM] [checkUUIDAttributes] is Valable ? :",isValable);
            /* Manage error */
            if(!isValable){
              this.log.error("[PTFM] [checkUUIDAttributes] The UUID of the accessory",this.zipAccessories[indexSearch].name, attributesUUID[indexCheck].uuid, "is not available in the box. Please check config. Accessory will not be added");
              platformAccessoryToDelete.push(this.zipAccessories[indexSearch].getPlatformAccessory());
            }else{
              this.debug && this.log("[PTFM] [checkUUIDAttributes] UUID of services is in the box. That's good.",uuids[indexServices]);
            }
          }
        } // end for
        return platformAccessoryToDelete;
      }.bind(this))
      .then(function deleteBadConfig(platformAccessoryToDelete){
        for(var index = 0;index < platformAccessoryToDelete.length;index++){
          this.debug && this.log("[PTFM] [checkUUIDAttributes] Request to delete ",platformAccessoryToDelete[index].displayName)
          this.removePlatformAccessory(platformAccessoryToDelete[index]);
        }
        return true;
      }.bind(this)); // end promise to return
    } // end if firstLaunch
  } // end checkUUIDAttributes function

} // End Class ZipaPlatform
