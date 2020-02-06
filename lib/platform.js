'use strict';

var Zipabox = require('./zipabox');

/* Link this module to homebridge. */
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

/* Class ZipaPlatform manage the platform function with homebridge */
class ZipaPlatform{
  /* Constructor of Zipaplatform class
  log : log objet of the plugin
  config : config json object from config.json */
  constructor (log, config, homeBridgeApi) {
    /* Base variable initialisation */
    this.log = log;
    this.config = config;
    this.accessoriesConfig = config.accessories || [];
    this.accessories = [];
    this.homebridge = homeBridgeApi;
    /* Debug */
    this.debug = config["debug"] || false;
    this.debug && this.log("DEBUG - Debug mode configured by user.");
    /*Homebridge linking */
    Accessory = this.homebridge.platformAccessory;
    Service = this.homebridge.hap.Service;
    Characteristic = this.homebridge.hap.Characteristic;
    UUIDGen = this.homebridge.hap.uuid;
    /* Zipabox API Object */
    this.zipabox = new Zipabox(this.debug,"URL",this.log,"USER","PASS");
    /* Loaded cached accessories */
    this.homebridge.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  } // end constructor


  /* didFinishLaunching
  homebridge already finished loading cached accessories.
  Plugin should only register new accessory that doesn't exist in homebridge after this event.
  Or start discover new accessories.*/
  didFinishLaunching(){
    /* DEBUG */
    this.debug && this.log("> Method didFinishLaunching");
    this.debug && this.log("Cached accessories loaded.");
    /* Add all configured accessory */
    for ( var index in this.accessoriesConfig){
      this.debug && this.log("In didFinishLaunching > add the accessory :",this.accessoriesConfig[index]);
      this.addAccessory(this.accessoriesConfig[index]);
    }
  } // end of didFinishLaunching function

  /* addAccessory
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
    var alreadyExist = false;
    for( var index in this.accessories){
      if (this.accessories[index].UUID === UUIDGen)
        alreadyExist = true;
    }
    this.debug && this.log("Accessory to add already exist ? :",alreadyExist);
    if(alreadyExist) {
      /* The accessory exist, what to we do ? FIXME */
      return;
    }else {
      /* The accessory doesn't exist, we need to add it */
      this.debug && this.log("New accessory found to add :", accessoryJSON.name)
      var newAccessory = new Accessory(accessoryJSON.name,uuidGen);
      newAccessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "manufactererTEST")
        .setCharacteristic(Characteristic.Model, "modelTest")
        .setCharacteristic(Characteristic.SerialNumber, "SerialTest");
      newAccessory.addService(Service.Switch, accessoryJSON.name);
      //this.configureAccessory(newAccessory); // POURQUOI ???
      newAccessory.reachable = true; // TODO test without
      this.accessories.push(newAccessory);
      this.homebridge.registerPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [newAccessory]);
      this.log("DEBUG EXPRESS : ",this.accessories);
    }
  } // End function addAccessory

  /* configureAccessory is invoked when homebridge tries to restore cached accessory.*/
  configureAccessory(accessory){
    this.debug && this.log("> Method configureAccessory");
    //this.debug && this.log("Accessory to configure :", accessory);
    this.debug && this.log("Accessory to configure UUID :",accessory.UUID);
    this.debug && this.log("Accessory to configure name :",accessory.displayName);

    /* Handle the 'identify' event */
    accessory.on('identify', function(paired, callback) {
      console.log(accessory.displayName, "Identify!!!");
      // TODO: run 3000ms on/off?
      callback();
    });

    accessory.reachable = false; // Add begining the accessory is not reachable

    /* Check if accessory already stored */
    var alreadyStored = false;
    for (var index in this.accessories){
      if (this.accessories[index].UUID === accessory.UUID)
        alreadyStored = true;
    }
    this.debug && this.log("Accessory alreadyStored ? :", alreadyStored);
    /* Check if accessory is still in config file */
    this.debug && this.log("Try to find if accessory is already configured or not.");
    this.debug && this.log("Accessory list config :", this.accessoriesConfig);
    var isConfigured = false;
    for (var index in this.accessoriesConfig){
      this.log("DEBUG : ", this.accessoriesConfig[index]);
      this.log("DEBUG : ", UUIDGen.generate(this.accessoriesConfig[index].UUID));
      if(accessory.UUID === UUIDGen.generate(this.accessoriesConfig[index].UUID))
        isConfigured = true;
    }
    this.debug && this.log("Accessory isConfigured ? :", isConfigured);
    if(alreadyStored && isConfigured){
      // Todo : check if possible to
      // Here the system try to configure a cache accessory that we have alereadyload
      //this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
      return;
    }
    if(alreadyStored && !isConfigured){
      // Todo : check if possible to
      // Here the system try to configure a cache accessory that we have alereadyload
      //this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
      return;
    }
    if(!isConfigured){
      // Todo : check if possible to
      // Here the system try to configure a cache accessory that we have alereadyload
      this.homebridge.unregisterPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [accessory]);
      return;
    }
    this.debug && this.log("Accessory push in accessory list");
    this.accessories.push(accessory);
  } // end of configureAccessory function

} // End Class ZipaPlatform

module.exports = ZipaPlatform;
