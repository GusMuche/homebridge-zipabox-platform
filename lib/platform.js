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

  /* configureAccessory is invoked when homebridge tries to restore cached accessory.*/
  configureAccessory(accessory){
    this.debug && this.log("> Method configureAccessory");
    this.debug && this.log("Accessory to configure UUID :",accessory.UUID);
    this.debug && this.log("Accessory to configure name :",accessory.name);
    var platform = this;

    //this.accessories.push(accessory);
  } // end of configureAccessory function

  /* didFinishLaunching
  homebridge already finished loading cached accessories.
  Plugin should only register new accessory that doesn't exist in homebridge after this event.
  Or start discover new accessories.*/
  didFinishLaunching(){
    /* DEBUG */
    this.debug && this.log("> Method didFinishLaunching");
    this.debug && this.log("Cached accessories loaded.");
    /* Add all configured accessory */
    for ( var accessory in this.accessoriesConfig){
      this.addAccessory(this.accessoriesConfig[accessory]);
    }
  } // end of didFinishLaunching function

  /* addAccessory
  TODO : complete text
  */
  addAccessory(accessoryJSON){
  /* UUID of the accessory based on UUID gen of homebridge */
    var uuid = UUIDGen.generate(accessoryJSON.UUID);
    /* DEBUG */
    this.debug && this.log("> Method addAccessory");
    this.debug && this.log("Accessory name :",accessoryJSON.name);
    this.debug && this.log("Accessory UUID :",accessoryJSON.UUID);
    this.debug && this.log("Accessory UUIDGen :",uuid);
    /* Check if accessory already exist */
    var uuidExists = this.accessories.filter(function(item) {
      console.log("Accessories filter :",item.UUID)
      return item.UUID == uuid;
    }).length;
    if (uuidExists == 0) {
      this.debug && this.log("New accessory to add");
      //this.accessories[UUID] = accessoryJSON;
      /* Create the accessory */
      var newAccessory = new Accessory(accessoryJSON.name,uuid);
      /* Add service(s) */
      newAccessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "manufactererTEST")
        .setCharacteristic(Characteristic.Model, "modelTest")
        .setCharacteristic(Characteristic.SerialNumber, "SerialTest");
      newAccessory.addService(Service.Switch, accessoryJSON.name);

      this.accessories.push(newAccessory); //Accessory will be added in configure Accessory
      this.configureAccessory(newAccessory); // POURQUOI ???
      this.homebridge.registerPlatformAccessories("homebridge-zipabox-platform", "Zipabox", [newAccessory]);

      //this.accessories[UUID].service = new Service.Switch(accessoryJSON.name);
    } // end if (uuidExists == 0)
  }
} // End Class ZipaPlatform

module.exports = ZipaPlatform;
