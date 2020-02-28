'use strict';

/* Link this module to homebridge. */
let Accessory;
let Service;
let Characteristic;

/*
Class ZipAccessory manage the accessory compatible with the Zipabox
it's not an accessory, it's a gateway or group of method
The accessory for HomeBridge is the platformAccessory object
*/
class ZipAccessory{
  constructor(debug,log,zipabox,zAccessory,zService,zCharacteristic){
    /* Base variable initzialisation */
    this.debug = debug;
    this.log = log;
    this.zipabox = zipabox;
    this.platformAccessory = undefined;
    this.config = undefined;
    this.uuidGen = undefined;
    this.type = undefined;
    this.name = undefined;
    Accessory = zAccessory;
    Service = zService;
    Characteristic = zCharacteristic;
  } // end constructor of ZipAccessory Class

  /*
  createAccessory method return a new accessory based on the configuration
  config need to be a item of accessories[] from config file
  */
  createAccessory(config,uuidGen){
    /* DEBUG */
    this.debug && this.log("> Method createAccessory");
    /* Save parameters */
    this.uuidGen = uuidGen;
    this.type = config.type;
    this.name = config.name;
    /* New Accessory creation */
    this.platformAccessory = new Accessory(this.name,uuidGen);
    /* Add the context */
    this.fixContextFromConfig(config);
    /* Base Information */ // TODO : mode info needed ?
    this.platformAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);
    /* Add the service requested by user */
    this.platformAccessory.addService(this.createService());
    this.bindCharacteristic();
    /* Return the created platformAccessory */
    return this.platformAccessory;
  } // end function createAccessory

  /*
  rechargeAccessoryFromCache(platformAccessory)
  Complete the instance value based on the accessory
  Rebind the characteristic method
  */
  rechargeAccessoryFromCache(accessory){
    /* DEBUG */
    this.debug && this.log("> Method createAccessoryFromCache");
    /* reload instance variables from context */
    this.uuidGen = accessory.UUID;
    this.name = accessory.context.name;
    this.type = accessory.context.type;
    this.uuid = accessory.context.uuid;
    this.uuidb = accessory.context.uuidb;
    this.testValue = accessory.context.testValue;
    this.noStatus = accessory.context.noStatus;
    this.reverseValue = accessory.context.reverseValue;
    this.deviceUUID = accessory.context.deviceUUID;
    this.manufacturer = accessory.context.manufacturer;
    this.model = accessory.context.model;
    this.serialNumber = accessory.context.serialNumber;
    /* save the platformAccessory */
    this.platformAccessory = accessory;
    /* If we create from cahe, we need to rebind characteristics */
    this.bindCharacteristic();
  } // end function rechargeAccessoryFromCache

  /*
  fixContextFromConfig check the config to validate all parameters
  The validated config is saved inside the context of the platformAccessory
  */
  fixContextFromConfig(config){
    /* DEBUG */
    this.debug && this.log("> Method fixContextFromConfig");

    /* UUID's of accessory */
    this.uuid = config["uuid"] || null;
    if(this.uuid == null)
      this.log.warn("No uuid parameter find for the accessory. Please check config.json");
    this.uuidb = config["uuidb"] || null;
    if(this.uuib != null)
      this.debug && this.log("A second Characteristic was added with the uuid",this.uuidb)
    /* Accessory Informations */
    this.manufacturer = config["manufacturer"] || "zipato";
    this.model = config["model"] || "zipato";
    this.serialNumber = config["serial"] || "zipato";
    /* Optional Test Value */
    this.testValue = config["testValue"] || null;
    if(this.testValue != null)
      this.debug && this.log("Test value fixed by user at ", this.testValue);
    /* Optional noStatus to avoid device request */
    this.noStatus = config["noStatus"] || false;
    if(this.noStatus != false && this.noStatus != true){
      this.debug && this.log("Configuration error : noStatus fixed to false");
      this.noStatus = false;
    }
    /* Optional reverse Value */
    this.reverseValue = config["reverse"] || false;
    if(this.reverseValue != false && this.reverseValue != true){
      this.log("WARNING : Configuration error : reverse fixed to false");
      this.reverseValue = false;
    }
    /* Empty values */
    this.deviceUUID = null;
    /* Save the config after check in the context of accessory */
    /* Compare with the reload of an accessory from cache in rechargeAccessoryFromCache() */
    this.platformAccessory.context.uuidGen = this.uuidGen;
    this.platformAccessory.context.name = this.name;
    this.platformAccessory.context.type = this.type;
    this.platformAccessory.context.uuid = this.uuid;
    this.platformAccessory.context.uuidb = this.uuidb;
    this.platformAccessory.context.testValue = this.testValue;
    this.platformAccessory.context.noStatus = this.noStatus;
    this.platformAccessory.context.reverseValue = this.reverseValue;
    this.platformAccessory.context.deviceUUID = this.deviceUUID;
    this.platformAccessory.context.manufacturer = this.manufacturer;
    this.platformAccessory.context.model = this.model;
    this.platformAccessory.context.serialNumber = this.serialNumber;
  }

  /*
  createService link the service to the selected types
  */
  createService(){
    /* DEBUG */
    this.debug && this.log("> Method createService");
    /* Switch to the correct service */
    switch(this.type){
      case "switch":
        this.debug && this.log("Add a Switch Accessory for",this.name);
        return new Service.Switch(this.name);
        break;
      case "light":
        this.debug && this.log("Add a LightBulb Accessory for",this.name);
        return new Service.Lightbulb(this.name);
        break;
      case "outlet":
        this.debug && this.log("Add an Outlet Accessory for",this.name);
        var serviceToReturn = new Service.Outlet(this.name);
        return serviceToReturn;
        break;
      case "temperature":
        this.debug && this.log("Add an Temperature Sensor Accessory for ",this.name);
        var serviceToReturn = new Service.TemperatureSensor(this.name);
        return serviceToReturn;
        break;
      case "ambient":
        this.debug && this.log("Add an Light Sensor Accessory for ",this.name);
        var serviceToReturn = new Service.LightSensor(this.name);
        return serviceToReturn;
        break;
      case "motion":
        this.debug && this.log("Add an Motion Sensor Accessory for ",this.name);
        //return new Service.MotionSensor(this.name);
        break;
      case "contact":
        this.debug && this.log("Add an Contact Sensor Accessory for ",this.name);
        //return new Service.ContactSensor(this.name);
        break;
      case "window":
        this.debug && this.log("Add an Window Accessory for ",this.name);
        //return new Service.Window(this.name);
        break;
      case "door":
        this.debug && this.log("Add an Door Accessory for ",this.name);
        //return new Service.Door(this.name);
        break;
      case "leak":
        this.debug && this.log("Add a Leak Sensor Accessory for ",this.name);
        //return new Service.LeakSensor(this.name);
        break;
      case "battery":
        this.debug && this.log("Add a Battery Accessory for ",this.name);
        //return new Service.BatteryService(this.name);
        break;
      case "co2":
        this.debug && this.log("Add a Carbon Monoxide Sensor Accessory for ",this.name);
        //return new Service.CarbonMonoxideSensor(this.name);
        break;
      case "alarm":
        this.debug && this.log("Add a Security System Accessory for ",this.name);
        //return new Service.SecuritySystem(this.name);
        // /* StatusFault option :
        // NO_FAULT = 0;
        // GENERAL_FAULT = 1;*/
        // this.statusFault = 0;
        break;
      default:
        this.debug && this.log("Add a default Switch Accessory for ",this.name);
        return new Service.Switch(this.name);
    } // end switchs
  } // end function createService


  /*
  bindService return the same accessory with the service needed
  'get' is called when HomeKit wants to retrieve the current state of the characteristic
  'set' is called when HomeKit wants to update the value of the characteristic
  */
  bindCharacteristic(){
    /* DEBUG */
    this.debug && this.log("> Method bindCharacteristic");
    /* Switch Service */
    if(this.platformAccessory.getService(Service.Switch)){
      this.platformAccessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOnCharacteristicHandler.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
    }
    /* Lightbulb Service */
    if(this.platformAccessory.getService(Service.Lightbulb)){
      this.platformAccessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOnCharacteristicHandler.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
    }
    /* Outlet Service */
    if(this.platformAccessory.getService(Service.Outlet)){
      this.platformAccessory.getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOnCharacteristicHandler.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
    }
    /* Temperature sensor Service */
    if(this.platformAccessory.getService(Service.TemperatureSensor)){
      this.platformAccessory.getService(Service.TemperatureSensor)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getOnCharacteristicHandler.bind(this));
    }
    /* Ambient sensor Service */
    if(this.platformAccessory.getService(Service.LightSensor)){
      this.platformAccessory.getService(Service.LightSensor)
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getOnCharacteristicHandler.bind(this));
    }
    /* Handle the 'identify' event */
    /* This is used to blink or switch an accessory to identify them */
    this.platformAccessory.on('identify', function(paired, callback) {
      this.log(accessory.displayName, "Identify!!!");
      callback();
    }.bind(this));
  } // end bindCharacteristic function

  /*
  updatePolling launch the get method to refresh the value of the accessory
  depend of his type
  */
  updatePolling(){
    /* DEBUG */
    this.debug && this.log("> Method updatePolling Accessory", this.name);
    if(this.platformAccessory.getService(Service.Switch))
      this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
    if(this.platformAccessory.getService(Service.Lightbulb))
      this.platformAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).getValue();
    if(this.platformAccessory.getService(Service.Outlet))
      this.platformAccessory.getService(Service.Outlet).getCharacteristic(Characteristic.On).getValue();
    if(this.platformAccessory.getService(Service.TemperatureSensor))
      this.platformAccessory.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature).getValue();
    if(this.platformAccessory.getService(Service.LightSensor))
      this.platformAccessory.getService(Service.LightSensor).getCharacteristic(Characteristic.CurrentAmbientLightLevel).getValue();
  } // end function updatePolling

  /*
  updateReachability
  Set the rechability to true or false. False if error
  */
  updateReachability(isReachable){
    if(isReachable != true && isReachable != false){
      this.log.warn("Error in isReachable > forced to false. Was : ", isReachable);
      isReachable = false;
    }
    this.platformAccessory.updateReachability(isReachable);
    // TODO : check if need to update the cache
  } // end function updateReachability

  /*
  getUUID is a shortcut to have the context.uuid
  */
  getUUID(){
    return this.platformAccessory.UUID;
  } // end function getUUID

  /*
  return a promise who resolve the Device UUID
  if noStatus is true, will resolve same uuid as attribute
  The box need to be given for one unique connection
  */
  getDeviceUUID(){
    /* DEBUG */
    this.debug && this.log("> Method manageDeviceUUID");
    return new Promise(function (resolve,reject){
      /* Check if already know */
      if(this.deviceUUID){
        this.debug && this.log("Device already know :",this.deviceUUID);
        resolve(this.deviceUUID);
      /* If not e check if it's allow to search one */
      }else if(this.noStatus == true){ // no device Status available > return simple uuid
        this.deviceUUID = uuid;
        resolve(uuid);
      }else{
        this.zipabox.getDeviceUUID(this.uuid)
        .then(function giveDeviceUUID(deviceUUID){
          this.debug && this.log("Device UUID found :",deviceUUID);
          this.deviceUUID = deviceUUID;
          resolve(deviceUUID);
        }.bind(this));
      }
    }.bind(this)); // end returned Promise
  } // end manageDeviceUUID function

  /*
  getOnCharacteristicHandler is called when HomeKit wants to retrieve the current state of the characteristic
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  */
  getOnCharacteristicHandler(callback){
    /* DEBUG */
    this.debug && this.log("> Method getOnCharacteristicHandler");

    var error = null;
    this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    // .catch(function(error){ // Check if disconnect, if then reconnect
    //   if (error.message == "Unauthorized" || error.message == "Unauthorized "){ // || error.message == "Bad Request " > for test
    //     this.log("Found Unauthorized error > need reconnection : ", "-"+ error.message + "-");
    //     /* Try to reconnect the Box */
    //     return this.connectTheBox()
    //     .catch(function manageError(error){
    //        throw new Error(error);
    //     })
    //     .then(function checkStatus(){// Checkstatus didn't return a string but only UUID of attribute or device // connectionAnswer){
    //       // if(connectionAnswer != "success"){
    //       //   this.log("Reconnection failed. Error :",error)
    //       //   throw error;
    //       //   //return ("testErrorChaining"); // For test with chaining after error
    //       // }else{
    //         this.debug && this.log("Reconnection success > get Device Status");
    //         return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus); // regive the status
    //       //}
    //     }.bind(this)) // End Unauthorized error manage
    //     .catch(function manageError(error){
    //        throw new Error(error);
    //     });
    //   }else{ // Rethrow error that we can't manage here
    //     this.log("Found error, not manage :", error.message + "-");
    //     throw error;
    //   }
    // }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
        this.debug && this.log("Test Value in manage Status : ",deviceStatus);
        this.debug && this.log("Type of Test Value in manage Status : ",typeof(deviceStatus));
        if(deviceStatus == true){ // Device is Online
          resolve(this.uuid);
        }else{ // Device is not online
          error = "Device not online";
          reject(error);
        }
      }.bind(this)) // end promise
    }.bind(this)) // end then
    .then(this.zipabox.getAttributesValue.bind(this.zipabox))
    .then(function (accessoryValue){
      // Reverse the value if requested by the configuration
      this.debug && this.log("Accessory Value returned by callback:",accessoryValue);
      var returnedValue = accessoryValue;
      if(this.reverseValue == true){ // User ask to reverse
        if(typeof(returnedValue) != "boolean"){ // Check if returnedValue is a Boolean
          var error = new Error("Coding error in getOnCharacteristicHandler: returnedValue is not a boolean in reverseValue");
          this.log(error);
          throw error;
        }else{
          if(returnedValue == true)
            returnedValue = false;
          else
            returnedValue = true;
        }
        this.debug && this.log("Configuration have request to reverse the value to :",returnedValue)
      } // end reverse block
      if(this.type == "window" || this.type == "door"){ // Window type, need to return a digit between 0 and 100
        this.debug && this.log("Window or Door found in get Method. returnedValue :",returnedValue)
        if(returnedValue)
         returnedValue = 100;
        else
         returnedValue = 0;
      }
      callback(error,returnedValue);
    }.bind(this))
    .catch(function manageError(error){
      //this.log("Test Value in manage Error : ",deviceStatus);
      this.log("Error on getOnCharacteristicHandler :",error);
      callback(error,undefined);
       //throw new Error(error);
    }.bind(this));
  } // end getOnCharacteristicHandler function

  /*
  setOnCharacteristicHandler is used to change the value of a attribute
  Method is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function
  The desired value is available in the `value` argument.
  The callback function should be called to return the value (that's in the example of homebridge, I return a null)
  The first argument in the function should be null unless and error occured
  */
  setOnCharacteristicHandler(value, callback){
    /* DEBUG */
    this.debug && this.log("> Method setOnCharacteristicHandler", value);
    /*Refresh state after some accessories */
    if(this.type == "window" || this.type == "door"){
      this.debug && this.log("Set method for a Window or Door > stop signal");
      //var error = new Error("Not implemented yet.");
      // this.service.getCharacteristic(Characteristic.CurrentPosition).getValue();
      // this.service.getCharacteristic(Characteristic.TargetPosition).getValue();
      callback(null);
      return;
    }
    /* Send the request */
    this.zipabox.putAttributesValueRequest(this.uuid,value)
    .then(function launchCallBack(resp){
      callback(resp);
    })
    .catch(function manageError(error) {
      throw new Error(error);
    });
  } // end setOnCharacteristicHandler function

} // End ZipAccessory Class


module.exports = ZipAccessory;
