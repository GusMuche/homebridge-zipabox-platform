'use strict';

/* Link this module to homebridge. */
let Accessory;
let Service;
let Characteristic;

/*
  Class ZipAccessory manage the accessory compatible with the Zipabox
  it's not an accessory, it's a gateway or group of mathod
*/
class ZipAccessory{
  constructor(debug,log,zAccessory,zService,zCharacteristic){
    /* Base variable initzialisation */
    this.debug = debug;
    this.log = log;
    Accessory = zAccessory;
    Service = zService;
    Characteristic = zCharacteristic;
  } // end constructor of ZipAccessory Class

  /*
    createAccessory method return a new accessory based on the configuration
    config need to be a item of accessories[] from config file
  */
  createAccessory(accessoryJSON,uuid){
    var newAccessory = new Accessory(accessoryJSON.name,uuid);
    newAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "manufactererTEST")
      .setCharacteristic(Characteristic.Model, "modelTest")
      .setCharacteristic(Characteristic.SerialNumber, "SerialTest");
    newAccessory.addService(Service.Switch, accessoryJSON.name);
    return newAccessory;
  } // end function createAccessory

} // End ZipAccessory Class


module.exports = ZipAccessory;
