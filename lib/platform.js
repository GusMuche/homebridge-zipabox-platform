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
    this.reset = config["reset"] || false;
    if(this.reset != true && this.reset != false){
      this.log.warn("[PTFM] WARNING : config error : Reset is not set to true or false. Forced to false")
      this.reset = false;
    }
    if(this.reset)
      this.debug && this.log.warn("Reset requested by user. Accessory will have fresh installation.")

    /* Box configuration */
    this.user = config["username"] || "ERROR";
    this.password = config["password"] || "ERROR";
    if(this.name == "ERROR" || this.password == "ERROR")
      this.log.warn("[PTFM] WARNING : no username or passwoard, please check config.json.");
    this.IP = config["server_ip"] || "ERROR"; // Change to server_IP > ! config
    if(this.IP == "ERROR")
      this.log.warn("[PTFM] WARNING : no IP configured, please check config.json.");
    if(this.IP == "remote"){
      this.debug && this.log("[PTFM] Remote access configured by the user.")
      this.baseURL = "https://my.zipato.com:443/zipato-web/v2/";
    }else{
      if(this.IP == "remoteV3"){
        this.debug && this.log("[PTFM] Remote access configured by the user. V3 API used")
        this.baseURL = "https://my3.zipato.com:443/zipato-web/v2";
      }else{
        this.baseURL = "http://"+this.IP+":8080/zipato-web/v2/";
        this.debug && this.log("[PTFM] Local access URL : ",this.baseURL);
      }
    }

    /* PIN for alarm accessory */
    this.pin = config["pin"] || "noPin";
    if(this.pin != "noPin")
      this.debug && this.log("[PTFM] Pin for alarm option is specified");
    this.alarmIsConfigured = false; // will be change to true if user specify an alarm

    /* Refresh for timePolling */
    this.timePolling = config["refresh"] || 0;
    if(this.timePolling != 0)
      this.debug && this.log("[PTFM] User request to refresh the value after (seconds)",this.timePolling);
    this.timePolling = this.timePolling * 1000; // turn to milliseconds
    this.timeOut = null; // will be launch after connection

    /* Accessories */
    this.accessoriesConfig = config.accessories || [];
    if(this.accessoriesConfig == [])
      this.log.warn("[PTFM] WARNING : no accessory configured, please check config.json.");
    this.zipAccessories = [];
    this.cachedAccessoriesToDelete = [];
    this.checkDoubleConfig(); // Check if user config two accessories with same UUID
    this.checkIfAlarm();
    /* Zipabox API Object */
    this.zipabox = new ZipaboxApi(this.debugApi,this.baseURL,this.log,this.user,this.password);
    /* Cached accessories loaded */
    this.homebridge.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  } // end constructor

  /*
    Method connectTheBox. Will simply... connect the box = init > login > get all Devices UUID
    If user specify an alarm and a pin, the method will process the security init > login
  */
  connectTheBox(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method connectTheBox");

    /* Launch connection */
    this.zipabox.connectUser()
    .then(this.checkUUIDAttributes.bind(this))
    .then(this.manageDevicesUUID.bind(this))
    .catch(function manageError(error) {
      this.log.error("[PTFM] [connectTheBox] Unexpexted error before security : ",error);
      throw new Error(error);
    }.bind(this))
    .then(function connectSecurityIfNeeded(deviceUUIDorUUID){
      if(this.alarmIsConfigured){
        this.debug && this.log("[PTFM] [connectTheBox] Alarm found after zipa connection > connect to the alarm.")
        return this.zipabox.connectFirstSecurity(this.pin);
      }else{
        return deviceUUIDorUUID; // same for previous Promise without alarm
      }
    }.bind(this))
    .then(function firstRefreshOfAccessories(notUsedReturn){
      /* User information for alarm */
      if(this.alarmIsConfigured)
        this.debug && this.log("[PTFM] [connectTheBox] User is connected to the security partition");
      /* First refresh off all statuses */
      for (var zipAccesory of this.zipAccessories)
        zipAccesory.updatePolling();
    }.bind(this))
    .then(function launchPolling(notUsedReturn){
      /* Start polling if request */
      if(this.timePolling > 0)
        this.statusPolling();
    }.bind(this))
    .catch(function manageError(error) {
      this.log.error("[PTFM] [connectTheBox] Error on connectTheBox after security :",error);
      throw new Error(error);
    }.bind(this));
  } // end connectTheBox function

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
    this.debug && this.log("[PTFM] [configureAccessory] Accessory to configure UUID :",accessory.UUID);
    this.debug && this.log("[PTFM] [configureAccessory] Accessory to configure name :",accessory.displayName);

    accessory.updateReachability(false); // Add begining the accessory is not reachable //FIXME : is it used ?

    // /* Reset if requested */
    // if(this.reset){
    //   this.removePlatformAccessory(accessory);
    //   return;
    // }
    /* Check if accessory already stored */
    var alreadyStored = this.isAccessoryStored(accessory.UUID);
    this.debug && this.log("[PTFM] [configureAccessory] Accessory alreadyStored ? :", alreadyStored);

    /* Check if accessory is in config file */
    this.debug && this.log("[PTFM] [configureAccessory] Try to find if accessory is already configured or not.");
    var isConfigured = false;
    var indexOfConfiguredAccessory = 0;
    for (var index in this.accessoriesConfig){
      if(accessory.context.uuid === this.accessoriesConfig[index].uuid && accessory.context.name === this.accessoriesConfig[index].name ){
        isConfigured = true;
        indexOfConfiguredAccessory = index;
      }
    }
    this.debug && this.log("[PTFM] [configureAccessory] Accessory isConfigured ? :", isConfigured);

    /* Manage the system with the two status of the accessory */
    if(!alreadyStored && isConfigured){
      var zipAccessory = new ZipAccessory(this.debug,this.log,this.zipabox,Accessory,Service,Characteristic);
      zipAccessory.rechargeAccessoryFromCache(accessory);
      zipAccessory.fixContextFromConfig(this.accessoriesConfig[indexOfConfiguredAccessory]);

      zipAccessory.updateReachability(true);
      this.zipAccessories.push(zipAccessory);
      this.debug && this.log("[PTFM] [configureAccessory] Accessory not stored but configured > store.");
    }else if (!isConfigured) {
      this.cachedAccessoriesToDelete.push(accessory);
      // this.removePlatformAccessory(accessory);
      this.debug && this.log("[PTFM] [configureAccessory] Accessory not stored and not configured > saved for delete.");
    }else{
      this.debug && this.log("[PTFM] [configureAccessory] Accessory already stored and configured. No action.");
    }

  } // end of configureAccessory function

  /*
    didFinishLaunching
    homebridge already finished loading cached accessories.
    Load the other accessories from config.json
  */
  didFinishLaunching(){
    /* Check if accessory used */
    if(this.disabled)
      return;
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method didFinishLaunching");

    /* First delete the cached accessories no more configured */
    if(this.cachedAccessoriesToDelete.length > 0){
      this.debug && this.log("[PTFM] [didFinishLaunching] removing the unconfigured accessories from cache. #:",this.cachedAccessoriesToDelete.length);
      for (var index = 0; index < this.cachedAccessoriesToDelete.length; index++) {
        this.removePlatformAccessory(this.cachedAccessoriesToDelete[index]);
        delete this.cachedAccessoriesToDelete[index];
      }
    }

    /* Check if user request to flush the cache */ // FIXME : not working correctly and twice ?
    if(this.reset){
      this.debug && this.log("[PTFM] [didFinishLaunching] User request to delete the cached accessory.");
      this.removeAllAccessories();
    }

    /* Add all configured accessory */
    for ( var index in this.accessoriesConfig){
      this.debug && this.log("[PTFM] [didFinishLaunching] Add the accessory :",this.accessoriesConfig[index].name);
      this.addAccessory(this.accessoriesConfig[index]);
    }
    /* Update the cache after launch all the accessories */ //TODO : return only platformAccessory (if needed)
    //this.homebridge.updatePlatformAccessories(this.zipAccessories);

    /* Launch the box */
    this.connectTheBox();
  } // end of didFinishLaunching function

  /*
    addAccessory add a new accessory based on the configuration of the user
  */
  addAccessory(accessoryJSON){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method addAccessory");
    this.debug && this.log("[PTFM] [addAccessory] Accessory name :",accessoryJSON.name);
    this.debug && this.log("[PTFM] [addAccessory] Accessory UUID :",accessoryJSON.uuid);
    /* UUID of the accessory based on UUID gen of homebridge */
    /* Cause we add the name and the UUID, user can configure two accessory for same UUID with different names */
    var uuidGen = UUIDGen.generate(accessoryJSON.uuid+accessoryJSON.name);
    this.debug && this.log("[PTFM] [addAccessory] Accessory UUIDGen :",uuidGen);
    /* Check if accessory already exist */
    var alreadyExist = this.isAccessoryStored(uuidGen);
    this.debug && this.log("[PTFM] [addAccessory] Accessory to add already exist ? :",alreadyExist);
    if(alreadyExist){
      /* Accessory is Stored, need to set it reachable */
      this.zipAccessories[this.getZipAccessoryIndexByUUID(uuidGen)].updateReachability(true);
    }else{
      /* The accessory doesn't exist, we need to add it */
      this.debug && this.log("[PTFM] [addAccessory] New accessory found to add :", accessoryJSON.name);
      var zipAccessory = new ZipAccessory(this.debug,this.log,this.zipabox,Accessory,Service,Characteristic);
      zipAccessory.createAccessory(accessoryJSON,uuidGen);
      zipAccessory.updateReachability(true); // TODO test without the refresh of reachability
      this.zipAccessories.push(zipAccessory);
      this.homebridge.registerPlatformAccessories("homebridge-zipabox-platform", "ZipaboxPlatform", [zipAccessory.platformAccessory]);
    }
    /* User check */
    !this.debug && this.log("Accessory added to the platform :",accessoryJSON.name)
  } // End function addAccessory

  /*
  statusPolling refresh all accessory after the parameter seconds
  */
  statusPolling(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method statusPolling");

    /* Loop through accessories */
    this.timeOut = setTimeout(function refreshStatus(){
      for (var zipAccesory of this.zipAccessories)
        zipAccesory.updatePolling();
      this.statusPolling();
    }.bind(this),this.timePolling)// end function of timeout
  } // end statusPolling function

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
      // this.debug && this.log("[PTFM] [removePlatformAccessory] Accessory to delete found at index :",index);
      // this.debug && this.log("[PTFM] [removePlatformAccessory] Length of accessories before remove :",this.zipAccessories.length);
      // this.debug && this.log("[PTFM] [removePlatformAccessory] Accessory stored :",this.zipAccessories[index].name);
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
    for(var index in this.accessoriesConfig){
      if(this.accessoriesConfig[index].type == "alarm")
        this.alarmIsConfigured = true;
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
      promiseArray.push(zipAccessory.getDeviceUUID());
    } // end for
    return Promise.all(promiseArray);
  } // end manageDevicesUUID function

  /*
  checkUUIDAttributes get all the attributes available in the box and compare with the user list
  */
  checkUUIDAttributes(){
    /* DEBUG */
    this.debug && this.log("[PTFM] > Method checkUUIDAttributes");
    return this.zipabox.getAllAttributes()
    .then(function checkUUIDs(attributesUUID){
      var platformAccessoryToDelete = [];
      this.debug && this.log("[PTFM] [checkUUIDAttributes] Length of zipAccessories already stored :",this.zipAccessories.length);
      this.debug && this.log("[PTFM] [checkUUIDAttributes] Length of attributesUUID from the box :",attributesUUID.length);
      for(var indexSearch = 0; indexSearch < this.zipAccessories.length; indexSearch++){
        this.debug && this.log("[PTFM] [checkUUIDAttributes] Actual index :",indexSearch);
        var isValable = false;
        if(this.zipAccessories[indexSearch].type == "alarm" || this.zipAccessories[indexSearch].uuid == "rebootBox" || this.zipAccessories[indexSearch].uuid == "rebootHomebridge" || this.zipAccessories[indexSearch].uuid == "disconnectBox"){
          isValable = true;
        }else{
          for(var indexCheck = 0; indexCheck < attributesUUID.length; indexCheck++){
            if(this.zipAccessories[indexSearch].uuid == attributesUUID[indexCheck].uuid)
              isValable = true;
          } // end for
        } // end else
        this.debug && this.log("[PTFM] [checkUUIDAttributes] is Valable ? :",isValable);

        /* Manage error */
        if(!isValable){
          this.log.error("[PTFM] [checkUUIDAttributes] The UUID of the accessory",this.zipAccessories[indexSearch].name, this.accessoriesConfig[indexSearch].uuid, "is not available in the box. Please check config. Accessory will not be added");
          platformAccessoryToDelete.push(this.zipAccessories[indexSearch].getPlatformAccessory());
        }else{
          this.debug && this.log("[PTFM] [checkUUIDAttributes] UUID of accessory state is in the box. That's good.",this.zipAccessories[indexSearch].uuid);
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
    }.bind(this));
  } // end checkUUIDAttributes function

} // End Class ZipaPlatform
