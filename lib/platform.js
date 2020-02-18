'use strict';

var Zipabox = require('./zipabox');
var ZipAccessory = require('./zipAccessory')

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
    /* Debug */
    this.debug = config["debug"] || false;
    this.debug && this.log("DEBUG - Debug mode configured by user.");
    /* Cache flush */
    this.reset = config["reset"] || false;
    if(this.reset != true && this.reset != false){
      this.log.warn("WARNING : config error : Reset is not set to true or false. Forced to false")
      this.reset = false;
    }
    if(this.reset)
      this.debug && this.log("Reset requested by user. Accessory in cache will be deleted.")

    /* Box configuration */
    this.user = config["USERNAME"] || "ERROR";
    this.password = config["PASSWORD"] || "ERROR";
    if(this.name == "ERROR" || this.password == "ERROR")
      this.log.warn("WARNING : no username or passwoard, please check config.json.");
    this.IP = config["server_ip"] || "ERROR"; // Change to server_IP > ! config
    if(this.IP == "ERROR")
      this.log.warn("WARNING : no IP configured, please check config.json.");
    if(this.IP == "remote"){
      this.debug && this.log("Remote access configured by the user.")
      this.baseURL = "https://my.zipato.com:443/zipato-web/v2/";
    }else{
      this.baseURL = "http://"+this.IP+":8080/zipato-web/v2/";
      this.debug && this.log("Local access URL : ",this.baseURL);
    }

    /* Accessories */
    this.accessoriesConfig = config.accessories || [];
    if(this.accessoriesConfig == [])
      this.log.warn("WARNING : no accessory configured, please check config.json.");
    this.accessories = [];
    this.checkDoubleConfig(); // Check if user config two accessories with same UUID

    /* Homebridge linking */
    this.homebridge = homeBridgeApi;
    // Accessory = this.homebridge.platformAccessory;
    // Service = this.homebridge.hap.Service;
    // Characteristic = this.homebridge.hap.Characteristic;
    // UUIDGen = this.homebridge.hap.uuid;

    /* Zipabox API Object */
    this.zipabox = new Zipabox(this.debug,this.baseURL,this.log,this.user,this.password);
    this.zipAccessory = new ZipAccessory(this.debug,this.log,Accessory,Service,Characteristic);

    /* Launch the box */
    //this.connectTheBox();

    /* Cached accessories loaded*/
    this.homebridge.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  } // end constructor

  /*
    Method connectTheBox. Will simly... connect the box = init > login
  */
  connectTheBox(){
    return this.zipabox.initUser()
    .then(this.zipabox.connectUser.bind(this.zipabox))
              // .then(function manageDeviceUUID(connectionResponseOrDeviceName){
              //   return new Promise(function (resolve,reject){
              //     if(this.noStatus == true){ // no device Status available > return simple uuid
              //       resolve(this.uuid);
              //     }else{
              //       this.zipabox.getDeviceUUID(this.uuid)
              //       .then(function saveDeviceUUID(deviceUUID){
              //         this.debug && this.log("Device UUID found :",deviceUUID);
              //         this.deviceUUID = deviceUUID;
              //         resolve(deviceUUID);
              //       }.bind(this));
              //     }
              //   }.bind(this)); // end returned Promise
              // }.bind(this))
              // .then(function connectSecurityIfNeeded(deviceUUIDorUUID){
              //   if(this.type == "alarm"){
              //     this.debug && this.log("Alarm found after zipa connection > connect to the alarm.")
              //     return this.zipabox.initSecurity(this.pin)
              //     .then(this.zipabox.connectSecurity.bind(this.zipabox));
              //   }else{
              //     return deviceUUID; // same for previous Promise without alarm
              //   }
              // }.bind(this))
              // .then(function statusPollingStartIfNeeded(none){
              //   if(this.timePolling > 0) //FIXME delete if change to connectmethod is ok
              //     this.statusPolling();
              // }.bind(this))
              // .catch(function manageError(error) {
              //   this.log("Error on connectBox : ",error);
              //   throw new Error(error);
              // }.bind(this));
  } // end connectTheBox function

  /*
    configureAccessory
    Method is invoked when homebridge tries to restore cached accessory.
  */
  configureAccessory(accessory){
    this.debug && this.log("> Method configureAccessory from cache");
    //this.debug && this.log("Accessory to configure :", accessory);
    this.debug && this.log("Accessory to configure UUID :",accessory.UUID);
    this.debug && this.log("Accessory to configure name :",accessory.displayName);

    /* Handle the 'identify' event */ //FIXME : why is this ????
    accessory.on('identify', function(paired, callback) {
      console.log(accessory.displayName, "Identify!!!");
      callback();
    });

    accessory.reachable = false; // Add begining the accessory is not reachable

    /* Check if user request to flush the cache */ // FIXME : not working yet
    if(this.reset){
      this.debug && this.log("User request to delete the cached accessory ", accessory.displayName)
      this.accessories = [];
      this.log("Delete accessory ", [accessory]);
      this.removeAccessory(accessory);
      return;
    }

    /* Check if accessory already stored */
    var alreadyStored = this.isAccessoryStored(accessory.UUID).bind(this);
    this.debug && this.log("Accessory alreadyStored ? :", alreadyStored);

    /* Check if accessory is in config file */
    this.debug && this.log("Try to find if accessory is already configured or not.");
    var isConfigured = false;
    for (var index in this.accessoriesConfig){
      if(accessory.UUID === UUIDGen.generate(this.accessoriesConfig[index].UUID))
        isConfigured = true;
    }
    this.debug && this.log("Accessory isConfigured ? :", isConfigured);

    /* Manage the system with the two status of accessory */
    if(!alreadyStored && isConfigured){
      // Todo : check if possible to
      // Here the system try to configure a cache accessory that we have not alereadyload
      // this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
      accessory.reachable = true;
      this.accessories[accessory.UUID] = accessory;
      this.debug && this.log("Accessory not stored but configured > store.");
      return;
    }
    if(!isConfigured){
      this.removeAccessory(accessory);
      this.debug && this.log("Accessory not stored and not configured > unregister.");
      return;
    }
    // if(!alreadyStored && !isConfigured){
    //   this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
    //   this.debug && this.log("Accessory not stored and not configured > unregister.");
    //   return;
    // }
    // if(alreadyStored && !isConfigured){
    //   // Todo : check if possible to
    //   // Here the system try to configure a cache accessory that we have alereadyload
    //   this.accessories.splice(indexOfStored,1);
    //   this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
    //   this.debug && this.log("Accessory stored but not configured > slice and unregister.");
    //   return;
    // }
    this.debug && this.log("Accessory already stored and configured. No action.");
  } // end of configureAccessory function

  /*
    didFinishLaunching
    homebridge already finished loading cached accessories.
    Plugin should only register new accessory that doesn't exist in homebridge after this event.
    Or start discover new accessories.
  */
  didFinishLaunching(){
    /* DEBUG */
    this.debug && this.log("> Method didFinishLaunching");
    // /* Flush the cache if requested by the user */
    // if(this.reset){ // TODO : check if this block is needed or not
    //   this.accessories = [];
    //   // for(var resIndex in this.accessories){
    //   //   this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
    //   // }
    // }

    /* Add all configured accessory */
    for ( var index in this.accessoriesConfig){
      this.debug && this.log("In didFinishLaunching > add the accessory :",this.accessoriesConfig[index]);
      this.addAccessory(this.accessoriesConfig[index]);
    }
  } // end of didFinishLaunching function

  /*
    addAccessory
    TODO : complete text
  */
  addAccessory(accessoryJSON){
    /* DEBUG */
    this.debug && this.log("> Method addAccessory");
    this.debug && this.log("Accessory full :",accessoryJSON);
    this.debug && this.log("Accessory name :",accessoryJSON.name);
    this.debug && this.log("Accessory UUID :",accessoryJSON.UUID);

    /* UUID of the accessory based on UUID gen of homebridge */
    var uuidGen = UUIDGen.generate(accessoryJSON.UUID);
    this.debug && this.log("Accessory UUIDGen :",uuidGen);
    /* Check if accessory already exist */
    var alreadyExist = this.isAccessoryStored(uuidGen);
    this.debug && this.log("Accessory to add already exist ? :",alreadyExist);
    if(alreadyExist){
      /* Accessory is Stored, need to set it reachable */
      this.accessories[uuidGen].reachable = true;
    }else{
      /* The accessory doesn't exist, we need to add it */
      this.debug && this.log("New accessory found to add :", accessoryJSON.name)
      var newAccessory = this.zipAccessory.createAccessory(accessoryJSON,uuidGen);
      newAccessory.reachable = true; // TODO test without
      this.accessories[uuidGen] = newAccessory;
      this.homebridge.registerPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [newAccessory]);
    }
  } // End function addAccessory

  removeAccessory(accessory){
    /* DEBUG */
    this.debug && this.log("> Method removeAccessory");
    //this.debug && this.log("Accessory to remove :",accessory);
    /* Retrait de l'accessoire de homebridge */
    accessory.reachable = false;
    try {
      this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);;
    } catch (e) {
      this.log("Could not unregister platform accessory! (" + accessory.name + ")" + e);
    }
    /* Retrait de la liste des accessoires */
    if(this.isAccessoryStored(accessory.UUID))
      delete this.accessories[accessory.UUID];
  }

  /*
    isAccessoryStored
    return -1 if accessory not in this.accessories
    return the index of accessory inside this.accessories if accessory stored
  */
  isAccessoryStored(accessoryUUID){
    if (this.accessories[accessoryUUID])
      return true;
    else
      return false;
    // var indexOfStored = -1;
    // for (var i in this.accessories){
    //     if (this.accessories[i].UUID === accessoryUUID)
    //       indexOfStored = i;
    // }
    // return indexOfStored;
  }

  /*
  checkDoubleConfig check all the configuration and verify if the user config a accessory twice
  */
  checkDoubleConfig(){
    /* DEBUG */
    this.debug && this.log("> Method checkDoubleConfig");
    /* Search for same config */
    for(var indexSearch in this.accessoriesConfig){
      for(var indexCheck in this.accessoriesConfig){
        if(this.accessoriesConfig[indexSearch].UUID == this.accessoriesConfig[indexCheck].UUID && indexSearch != indexCheck)
          this.log.warn('WARNING : same UUID for different accessories, please check config.json.')
      }
    }
  }

} // End Class ZipaPlatform
