'use strict';

/* Link this module to homebridge. */
let Accessory;
let Service;
let Characteristic;

/*
  Class ZipAccessory manage the accessory compatible with the Zipabox
  it's not an accessory, it's a gateway or group of method
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
  createAccessory(config,uuidGen){
    var that = this;
    /* DEBUG */
    that.debug && that.log("> Method createAccessory");

    /*                        */
    /* Accessory config start */
    /*                        */

    /* Test Value */
    that.testValue = config["testValue"] || null;
    if(that.testValue != null)
      that.debug && that.log("Test value fixed by user at ", that.testValue);
    /* UUID's of accessory */
    that.uuid = config["UUID"];
    that.uuidB = config["UUIDB"] || null;
    if(that.uuiB != null)
      that.debug && that.log("A second Characteristic was added with the uuid",this.uuidB)
    /* Optional reverse Value */
    that.reverseValue = config["reverse"] || false;
    if(that.reverseValue != false && that.reverseValue != true){
      that.log("WARNING : Configuration error : reverse fixed to false");
      that.reverseValue = false;
    }
    // if(this.type == "alarm")
    //   this.reverseValue = false;


    /*                        */
    /* New Accessory creation */
    /*                        */
    var newAccessory = new Accessory(config.name,uuidGen);
    /* Base Information */ // TODO : mode info needed ?
    newAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "manufactererTEST")
      .setCharacteristic(Characteristic.Model, "modelTest")
      .setCharacteristic(Characteristic.SerialNumber, "SerialTest");

    /* Add the service requested by user */
    newAccessory.addService(this.createService(config.type), config.name);
    newAccessory= this.bindCharacteristic(newAccessory);
    return newAccessory;
  } // end function createAccessory

  /*
  createService return to service linked to the selected types
  */
  createService(service,name){
    /* DEBUG */
    this.debug && this.log("> Method createService");
    /* Switch to the correct service */
    switch(service){
      case "switch":
        this.debug && this.log("Add a Switch Accessory");
        return new Service.Switch(name);//(this.name);
        break;
      case "light":
        this.debug && this.log("Add a LightBulb Accessory");
        //return new Service.Lightbulb(this.name);
        break;
      case "outlet":
        this.debug && this.log("Add an Outlet Accessory");
        //return new Service.Outlet(this.name);
        break;
      case "temperature":
        this.debug && this.log("Add an Temperature Sensor Accessory");
        //return new Service.TemperatureSensor(this.name);
        break;
      case "ambient":
        this.debug && this.log("Add an Light Sensor Accessory");
        //return new Service.LightSensor(this.name);
        break;
      case "motion":
        this.debug && this.log("Add an Motion Sensor Accessory");
        //return new Service.MotionSensor(this.name);
        break;
      case "contact":
        this.debug && this.log("Add an Contact Sensor Accessory");
        //return new Service.ContactSensor(this.name);
        break;
      case "window":
        this.debug && this.log("Add an Window Accessory");
        //return new Service.Window(this.name);
        break;
      case "door":
        this.debug && this.log("Add an Door Accessory");
        //return new Service.Door(this.name);
        break;
      case "leak":
        this.debug && this.log("Add a Leak Sensor Accessory");
        //return new Service.LeakSensor(this.name);
        break;
      case "battery":
        this.debug && this.log("Add a Battery Accessory");
        //return new Service.BatteryService(this.name);
        break;
      case "co2":
        this.debug && this.log("Add a Carbon Monoxide Sensor Accessory");
        //return new Service.CarbonMonoxideSensor(this.name);
        break;
      case "alarm":
        this.debug && this.log("Add a Security System Accessory");
        //return new Service.SecuritySystem(this.name);
        // /* StatusFault option :
        // NO_FAULT = 0;
        // GENERAL_FAULT = 1;*/
        // this.statusFault = 0;
        break;
      default:
        this.debug && this.log("Add a default Switch Accessory");
        return new Service.Switch(name);
    } // end switchs
  } // end function createService


  /*
  bindService return the same accessory with the service needed
  'get' is called when HomeKit wants to retrieve the current state of the characteristic
  'set' is called when HomeKit wants to update the value of the characteristic
  */
  bindCharacteristic(accessory){
    /* DEBUG */
    this.debug && this.log("> Method bindCharacteristic");
    /* Switch to the correct service */
    if(accessory.getService(Service.Switch)){// || accessory.getService(Service.Switch) || type == "outlet"){
      accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOnCharacteristicHandler.bind(this)) ////ICI COMMENT CONTINUER ????
        .on('set', this.setOnCharacteristicHandler.bind(this));
    }
    return accessory;
  } // end bindCharacteristic function

  getOnCharacteristicHandler(callback){
    /* DEBUG */
    this.debug && this.log('calling getOnCharacteristicHandler');
    callback(null,true);
  } // end getOnCharacteristicHandler function

  setOnCharacteristicHandler(value, callback){
    /* DEBUG */
    this.debug && this.log('calling setOnCharacteristicHandler', value);
    callback(null)
  } // end setOnCharacteristicHandler function

} // End ZipAccessory Class


module.exports = ZipAccessory;
