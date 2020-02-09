'use strict';

var Zipabox = require('./zipabox');
var ZipAccessory = require('./zipAccessory')

/* Link this module to homebridge. */
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

/* Class ZipaPlatform manage the platform function with homebridge */
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
    /* Box configuration */
    this.user = config["USERNAME"] || "ERROR";
    this.password = config["PASSWORD"] || "ERROR";
    if(this.name == "ERROR" || this.password == "ERROR")
      this.log("WARNING : no username or passwoard, please check config.json.");
    this.IP = config["server_ip"] || "ERROR"; // Change to server_IP > ! config
    if(this.IP == "ERROR")
      this.log("WARNING : no IP configured, please check config.json.");
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
      this.log("WARNING : no accessory configured, please check config.json.");
    this.accessories = [];
    /* Homebridge linking */
    this.homebridge = homeBridgeApi;
    Accessory = this.homebridge.platformAccessory;
    Service = this.homebridge.hap.Service;
    Characteristic = this.homebridge.hap.Characteristic;
    UUIDGen = this.homebridge.hap.uuid;
    /* Zipabox API Object */
    this.zipabox = new Zipabox(this.debug,this.baseURL,this.log,this.user,this.password);
    this.zipAccessory = new ZipAccessory(this.debug,this.log,Accessory,Service,Characteristic);
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
      // TODO: run 3000ms on/off?
      callback();
    });

    accessory.reachable = false; // Add begining the accessory is not reachable

    /* Check if accessory already stored */
    var indexOfStored = this.isAccessoryStored(accessory.UUID);
    var alreadyStored = indexOfStored != -1;
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
      this.accessories.push(accessory);
      this.debug && this.log("Accessory not stored but configured > store.");
      return;
    }
    if(!alreadyStored && !isConfigured){
      this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
      this.debug && this.log("Accessory not stored and not configured > unregister.");
      return;
    }
    if(alreadyStored && !isConfigured){
      // Todo : check if possible to
      // Here the system try to configure a cache accessory that we have alereadyload
      this.accessories.splice(indexOfStored,1);
      this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
      this.debug && this.log("Accessory stored but not configured > slice and unregister.");
      return;
    }
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
    this.debug && this.log("=Cached accessories loaded, loading accessories from config file.");
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
    var indexOfStored = this.isAccessoryStored(uuidGen);
    var alreadyExist = indexOfStored != -1;
    this.debug && this.log("Accessory to add already exist ? :",alreadyExist);
    if(alreadyExist){
      /* Accessory is Stored, need to set it reachable */
      this.accessories[indexOfStored].reachable = true;
    }else{
      /* The accessory doesn't exist, we need to add it */
      this.debug && this.log("New accessory found to add :", accessoryJSON.name)
      var newAccessory = this.zipAccessory.createAccessory(accessoryJSON,uuidGen);
      newAccessory.reachable = true; // TODO test without
      this.accessories.push(newAccessory);
      this.homebridge.registerPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [newAccessory]);
    }
  } // End function addAccessory

  /*
    isAccessoryStored
    return -1 if accessory not in this.accessories
    return the index of accessory inside this.accessories if accessory stored
  */
  isAccessoryStored(accessoryUUID){
    var indexOfStored = -1;
    for (var i in this.accessories){
        if (this.accessories[i].UUID === accessoryUUID)
          indexOfStored = i;
    }
    return indexOfStored;
  }

} // End Class ZipaPlatform

module.exports = ZipaPlatform;
