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
    this.debugPlatform = debug;
    this.debug = undefined;
    this.log = log;
    this.zipabox = zipabox;
    this.platformAccessory = undefined;
    this.config = undefined;
    this.uuidGen = undefined;
    this.type = undefined;
    this.name = undefined;
    this.statusFault = undefined;
    this.lastValue = undefined;
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
    this.name = config.name;
    this.debug = config.debug || false;
    if(this.debugPlatform || this.debug){
      this.debug = true;
      this.log.warn("[ZIPAC] Debug mode set for",this.name);
    }
    this.debug && this.log("[ZIPAC] > Method createAccessory /",this.name,"/");
    /* Save parameters */
    this.uuidGen = uuidGen;
    this.type = config.type;
    /* New Accessory creation */
    this.platformAccessory = new Accessory(this.name,uuidGen);
    /* Add the context */
    this.fixContextFromConfig(config);
    /* Base Information */ // TODO : mode info needed ?
    this.platformAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);
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
    this.debug = accessory.context.debug;
    this.debug && this.log("[ZIPAC] > Method createAccessoryFromCache");
    /* reload instance variables from context */
    this.uuidGen = accessory.UUID;
    this.name = accessory.context.name;
    this.type = accessory.context.type;
    this.uuid = accessory.context.uuid;
    this.uuidb = accessory.context.uuidb;
    this.testValue = accessory.context.testValue;
    this.noStatus = accessory.context.noStatus;
    this.reverseValue = accessory.context.reverseValue;
    this.nightMode = accessory.context.nightMode;
    this.deviceUUID = accessory.context.deviceUUID;
    this.manufacturer = accessory.context.manufacturer;
    this.model = accessory.context.model;
    this.serial = accessory.context.serial;
    this.min = accessory.context.min;
    this.max = accessory.context.max;
    this.range = accessory.context.range;
    this.batteryLimit = accessory.context.batteryLimit;
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
    this.debug && this.log("[ZIPAC] > Method fixContextFromConfig");

    /* UUID's of accessory */
    this.uuid = config["uuid"] || null;
    if(this.uuid == null)
      this.log.warn("[ZIPAC] [fixContextFromConfig] No uuid parameter find for the accessory. Please check config.json");
    this.uuidb = config["uuidb"] || null;
    if(this.uuidb != null)
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] A second Characteristic was added with the uuid",this.uuidb)
    if(this.type == "battery" && this.uuidb == null)
      this.log.error("[ZIPAC] [fixContextFromConfig] No uuidb specified for the battery accessory : please check config.json.")
    /* Accessory Informations */
    this.manufacturer = config["manufacturer"] || "zipato";
    this.model = config["model"] || "zipato";
    this.serial = config["serial"] || "zipato";
    /* Optional Test Value */
    this.testValue = config["testValue"] || null;
    if(this.testValue != null)
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] Test value fixed by user at ", this.testValue);
    /* Optional noStatus to avoid device request */
    this.noStatus = config["noStatus"] || false;
    if(this.noStatus != false && this.noStatus != true){
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] Configuration error : noStatus fixed to false");
      this.noStatus = false;
    }
    if(this.type == "alarm")
      this.noStatus = true;
    /* Optional reverse Value */
    this.reverseValue = config["reverse"] || false;
    if(this.reverseValue != false && this.reverseValue != true){
      this.log.warn("[ZIPAC] [fixContextFromConfig] WARNING : Configuration error : reverse fixed to false. accessory :",this.name);
      this.reverseValue = false;
    }
    if(this.type == "alarm")
      this.reverseValue = false;
    /* Optional nightMode alarm */
    this.nightMode = config["nightMode"] || false;
    if(this.nightMode != false && this.nightMode != true){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Configuration error : nightMode fixed to false");
      this.nightMode = false;
    }
    /* Optional min/max values */
    this.min = config["min"] || 0;
    this.max = config["max"] || 100;
    if(typeof(this.min) == "string")
      this.min = parseInt(this.min);
    if(typeof(this.max) == "string")
      this.max = parseInt(this.max);
    this.range = this.max-this.min;
    /* Optional Battery Limit */
    this.batteryLimit = config["batteryLimit"] || 0;
    if(this.batteryLimit > 100 || this.batteryLimit < 0){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Configuration error : batteryLimit fixed to 0. accessory :",this.name);
      this.batteryLimit = 0;
    }
    if(this.type == "door" || this.type == "window")
      this.batteryLimit = 0;
    /* Optional special Types */
    if(this.uuid == "disconnectBox"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Disconnect box button");
      this.noStatus = true;
      this.batteryLimit = 0;
      this.type = "switch";
    }

    /* Empty values */
    this.deviceUUID = null;
    /* Save the config after check in the context of accessory */
    /* Compare with the reload of an accessory from cache in rechargeAccessoryFromCache() */
    this.platformAccessory.context.debug = this.debug;
    this.platformAccessory.context.uuidGen = this.uuidGen;
    this.platformAccessory.context.name = this.name;
    this.platformAccessory.context.type = this.type;
    this.platformAccessory.context.uuid = this.uuid;
    this.platformAccessory.context.uuidb = this.uuidb;
    this.platformAccessory.context.testValue = this.testValue;
    this.platformAccessory.context.noStatus = this.noStatus;
    this.platformAccessory.context.reverseValue = this.reverseValue;
    this.platformAccessory.context.nightMode = this.nightMode;
    this.platformAccessory.context.deviceUUID = this.deviceUUID;
    this.platformAccessory.context.manufacturer = this.manufacturer;
    this.platformAccessory.context.model = this.model;
    this.platformAccessory.context.serial = this.serial;
    this.platformAccessory.context.min = this.min;
    this.platformAccessory.context.max = this.max;
    this.platformAccessory.context.range = this.range;
    this.platformAccessory.context.batteryLimit = this.batteryLimit;
  }

  /*
  createService link the service to the selected types
  */
  createService(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method createService");
    /* Switch to the correct service */
    switch(this.type){
      case "switch":
        this.debug && this.log("[ZIPAC] [createService] Add a Switch Accessory for",this.name);
        return new Service.Switch(this.name);
        break;
      case "light":
        this.debug && this.log("[ZIPAC] [createService] Add a LightBulb Accessory for",this.name);
        return new Service.Lightbulb(this.name);
        break;
      case "outlet":
        this.debug && this.log("[ZIPAC] [createService] Add an Outlet Accessory for",this.name);
        var serviceToReturn = new Service.Outlet(this.name);
        return serviceToReturn;
        break;
      case "temperature":
        this.debug && this.log("[ZIPAC] [createService] Add an Temperature Sensor Accessory for",this.name);
        var serviceToReturn = new Service.TemperatureSensor(this.name);
        return serviceToReturn;
        break;
      case "ambient":
        this.debug && this.log("[ZIPAC] [createService] Add an Light Sensor Accessory for",this.name);
        var serviceToReturn = new Service.LightSensor(this.name);
        return serviceToReturn;
        break;
      case "motion":
        this.debug && this.log("[ZIPAC] [createService] Add an Motion Sensor Accessory for",this.name);
        var serviceToReturn = new Service.MotionSensor(this.name);
        return serviceToReturn;
        break;
      case "contact":
        this.debug && this.log("[ZIPAC] [createService] Add an Contact Sensor Accessory for",this.name);
        var serviceToReturn = new Service.ContactSensor(this.name);
        return serviceToReturn;
        break;
      case "window":
        this.debug && this.log("[ZIPAC] [createService] Add an Window Accessory for",this.name);
        var serviceToReturn = new Service.Window(this.name);
        return serviceToReturn;
        break;
      case "door":
        this.debug && this.log("[ZIPAC] [createService] Add an Door Accessory for",this.name);
        var serviceToReturn = new Service.Door(this.name);
        return serviceToReturn;
        break;
      case "leak":
        this.debug && this.log("[ZIPAC] [createService] Add a Leak Sensor Accessory for",this.name);
        var serviceToReturn = new Service.LeakSensor(this.name);
        return serviceToReturn;
        break;
      case "co2":
        this.debug && this.log("[ZIPAC] [createService] Add a Carbon Monoxide Sensor Accessory for",this.name);
        var serviceToReturn = new Service.CarbonMonoxideSensor(this.name);
        return serviceToReturn;
        break;
      case "battery":
        this.debug && this.log("[ZIPAC] [createService] Add a Battery Accessory for",this.name);
        var serviceToReturn = new Service.BatteryService(this.name);
        return serviceToReturn;
        break;
      case "alarm":
        this.debug && this.log("[ZIPAC] [createService] Add a Security System Accessory for",this.name);
        var serviceToReturn = new Service.SecuritySystem(this.name);
        /* StatusFault option :
        NO_FAULT = 0;
        GENERAL_FAULT = 1;*/
        this.statusFault = 0;
        return serviceToReturn;
        break;
      default:
        this.debug && this.log("[ZIPAC] [createService] Add a default Switch Accessory for ",this.name);
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
    this.debug && this.log("[ZIPAC] > Method bindCharacteristic");
    var service = undefined;
    /* Switch Service */
    if(this.platformAccessory.getService(Service.Switch)){
      if(this.uuid=="disconnectBox"){
        this.platformAccessory.getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getSpecial.bind(this))
          .on('set', this.setSpecial.bind(this));
      }else{
        this.platformAccessory.getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOnCharacteristicHandler.bind(this))
          .on('set', this.setOnCharacteristicHandler.bind(this));
      }
      service = this.platformAccessory.getService(Service.Switch);
    }
    /* Lightbulb Service */
    if(this.platformAccessory.getService(Service.Lightbulb)){
      this.platformAccessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOnCharacteristicHandler.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.Lightbulb);
    }
    /* Outlet Service */
    if(this.platformAccessory.getService(Service.Outlet)){
      this.platformAccessory.getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOnCharacteristicHandler.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.Outlet);
    }
    /* Temperature sensor Service */
    if(this.platformAccessory.getService(Service.TemperatureSensor)){
      this.platformAccessory.getService(Service.TemperatureSensor)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.TemperatureSensor);
    }
    /* Ambient sensor Service */
    if(this.platformAccessory.getService(Service.LightSensor)){
      this.platformAccessory.getService(Service.LightSensor)
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.LightSensor);
    }
    /* Motion sensor Service */
    if(this.platformAccessory.getService(Service.MotionSensor)){
      this.platformAccessory.getService(Service.MotionSensor)
        .getCharacteristic(Characteristic.MotionDetected)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.MotionSensor);
    }
    /* Contact sensor Service */
    if(this.platformAccessory.getService(Service.ContactSensor)){
      this.platformAccessory.getService(Service.ContactSensor)
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.ContactSensor);
    }
    /* Window Service */
    if(this.platformAccessory.getService(Service.Window)){
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getOnCharacteristicHandler.bind(this));
        //.on('set', this.setOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getOnCharacteristicCopyLast.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.PositionState)
        .on('set', this.setOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.HoldPosition)
        .on('get', function(callback){callback(null,true);});
      service = this.platformAccessory.getService(Service.Window);
    }
    /* Door Service */
    if(this.platformAccessory.getService(Service.Door)){
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getOnCharacteristicHandler.bind(this));
        //.on('set', this.setOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getOnCharacteristicCopyLast.bind(this))
        .on('set', this.setOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.PositionState)
        .on('set', this.setOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.HoldPosition)
        .on('get', function(callback){callback(null,true);});
      service = this.platformAccessory.getService(Service.Door);
    }
    /* Leak Sensor */
    if(this.platformAccessory.getService(Service.LeakSensor)){
      this.platformAccessory.getService(Service.LeakSensor)
        .getCharacteristic(Characteristic.LeakDetected)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.LeakSensor);
    }
    /* CO2 Sensor */
    if(this.platformAccessory.getService(Service.CarbonMonoxideSensor)){
      this.platformAccessory.getService(Service.CarbonMonoxideSensor)
        .getCharacteristic(Characteristic.CarbonMonoxideDetected)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      service = this.platformAccessory.getService(Service.CarbonMonoxideSensor);
    }
    /* Battery Service */
    if(this.platformAccessory.getService(Service.BatteryService)){
      this.platformAccessory.getService(Service.BatteryService)
        .getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getOnCharacteristicHandler.bind(this));
      this.platformAccessory.getService(Service.BatteryService)
        .getCharacteristic(Characteristic.ChargingState)
        .on('get', this.getOnCharacteristicHandlerB.bind(this));
    }
    /* Alarm Service */
    if(this.platformAccessory.getService(Service.SecuritySystem)){
      this.platformAccessory.getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .on('get', this.getOnSecurityCurrentHandler.bind(this));
      this.platformAccessory.getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .on('set', this.setOnSecurityTargetHandler.bind(this))
        .on('get', this.getOnSecurityCurrentHandler.bind(this));
      this.platformAccessory.getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.StatusFault)
        .on('get', this.getOnSecurityStatusFault.bind(this));
      service = this.platformAccessory.getService(Service.SecuritySystem);
    }
    // /* Link the 'identify' event */
    // this.platformAccessory.on('identify', function(paired, callback) {
    //   this.identifyZipAccessory();
    //   callback();
    // }.bind(this));

    /* Handle the battery level status */
    if(this.batteryLimit != 0 && service != undefined){
      service.getCharacteristic(Characteristic.StatusLowBattery) // Normal = 0, Low = 1
        .on('get', this.getStatusBatteryCharacteristic.bind(this));
    }

  } // end bindCharacteristic function

  /*
  updatePolling launch the get method to refresh the value of the accessory
  depend of his type
  */
  updatePolling(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method updatePolling Accessory", this.name);
    /* Update based on type of service */
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
    if(this.platformAccessory.getService(Service.MotionSensor))
      this.platformAccessory.getService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected).getValue();
    if(this.platformAccessory.getService(Service.ContactSensor))
      this.platformAccessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).getValue();
    if(this.platformAccessory.getService(Service.Window)){
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.TargetPosition).getValue();
    }
    if(this.platformAccessory.getService(Service.Door)){
      this.platformAccessory.getService(Service.Door).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Door).getCharacteristic(Characteristic.TargetPosition).getValue();
    }
    if(this.platformAccessory.getService(Service.LeakSensor))
      this.platformAccessory.getService(Service.LeakSensor).getCharacteristic(Characteristic.LeakDetected).getValue();
    if(this.platformAccessory.getService(Service.CarbonMonoxideSensor))
      this.platformAccessory.getService(Service.CarbonMonoxideSensor).getCharacteristic(Characteristic.CarbonMonoxideDetected).getValue();
    if(this.platformAccessory.getService(Service.BatteryService)){
      this.platformAccessory.getService(Service.BatteryService).getCharacteristic(Characteristic.BatteryLevel).getValue();
      this.platformAccessory.getService(Service.BatteryService).getCharacteristic(Characteristic.ChargingState).getValue();
    }
    if(this.platformAccessory.getService(Service.SecuritySystem)){
      this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemCurrentState).getValue();
      this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
      this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusFault).getValue();
    }
  } // end function updatePolling

  /*
  updateReachability
  Set the rechability to true or false. False if error
  */
  updateReachability(isReachable){
    if(isReachable != true && isReachable != false){
      this.log.warn("[ZIPAC] [updateReachability] AddError in isReachable > forced to false. Was : ", isReachable);
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
    this.debug && this.log("[ZIPAC] > Method manageDeviceUUID");
    return new Promise(function (resolve,reject){
      /* Check if already know */
      if(this.deviceUUID){
        this.debug && this.log("[ZIPAC] [manageDeviceUUID] Device already know :",this.deviceUUID);
        resolve(this.deviceUUID);
      /* If not e check if it's allow to search one */
      }else if(this.noStatus == true){ // no device Status available > return simple uuid
        this.deviceUUID = this.uuid;
        resolve(this.uuid);
      }else{
        this.zipabox.getDeviceUUID(this.uuid)
        .then(function giveDeviceUUID(deviceUUID){
          this.debug && this.log("[ZIPAC] [manageDeviceUUID] Device UUID found in the box :",deviceUUID);
          this.deviceUUID = deviceUUID;
          resolve(deviceUUID);
        }.bind(this));
      }
    }.bind(this)); // end returned Promise
  } // end manageDeviceUUID function

  /*
  getStatusBatteryCharacteristic give the battery level of a device and change
  the status (0 or 1) of battery if under the limit
  The function will try to reconnect the box if the device is not found
  */
  getStatusBatteryCharacteristic (callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getStatusBatteryCharacteristic');

    var error = null;
    this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
      return this.reconnectAfterError(error);
    }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
        //this.debug && this.log("Test Value in manage Status : ",deviceStatus);
        this.debug && this.log("[ZIPAC] [getStatusBatteryCharacteristic] Type of Test Value in manage Status : ",typeof(deviceStatus));
        if(deviceStatus == true){ // Device is Online
          resolve(this.deviceUUID);
        }else{ // Device is not online
          error = "Device not online";
          reject(error);
        }
      }.bind(this)) // end promise
    }.bind(this)) // end then
    .then(this.zipabox.getDeviceBatteryLevel.bind(this.zipabox))
    .then(function (batteryValue){
      var underLevel = 0;
      if(batteryValue < this.batteryLimit)
        underLevel = 1;
      this.debug && this.log("[ZIPAC] [getStatusBatteryCharacteristic] Battery status returned to callback:",underLevel);
      callback(error,underLevel);
    }.bind(this))
    .catch(function manageError(error){
      //this.log("Test Value in manage Error : ",deviceStatus);
      this.log("[ZIPAC] [getStatusBatteryCharacteristic] Error on getOnCharacteristicHandler :",error);
      callback(error,undefined);
       //throw new Error(error);
    }.bind(this));
    //callback(null,0);
  }


  /*
  getOnCharacteristicHandler is called when HomeKit wants to retrieve the current state of the characteristic
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  */
  getOnCharacteristicHandler(callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOnCharacteristicHandler");

    var error = null;
    this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
      return this.reconnectAfterError(error);
    }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
        //this.debug && this.log("[ZIPAC] [getOnCharacteristicHandler] Test Value in manage Status : ",deviceStatus);
        this.debug && this.log("[ZIPAC] [getOnCharacteristicHandler] Type of Test Value in manage Status : ",typeof(deviceStatus));
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
      /* Reverse the value if requested by the configuration */
      //this.debug && this.log("[ZIPAC] [getOnCharacteristicHandler] Accessory Value returned by callback:",accessoryValue);
      var returnedValue = accessoryValue;
      /* Force boolean for remote access */
      if(returnedValue == "true")
        returnedValue = true;
      if(returnedValue == "false")
        returnedValue = false;
      /* Manage the reverse value */
      if(this.reverseValue == true){ // User ask to reverse
        if(typeof(returnedValue) != "boolean"){ // Check if returnedValue is a Boolean
          var error = new Error("[ZIPAC] [getOnCharacteristicHandler] Coding error in getOnCharacteristicHandler: returnedValue is not a boolean in reverseValue");
          this.log(error);
          throw error;
        }else{
          if(returnedValue == true)
            returnedValue = false;
          else
            returnedValue = true;
        }
        this.debug && this.log("[ZIPAC] [getOnCharacteristicHandler] Configuration have request to reverse the value to :",returnedValue)
      } // end reverse block

      /* Adapt the scale for lux sensor */
      if(this.type == "ambient"){ // returned from % to scale
        returnedValue = Math.round(this.min + returnedValue/100 * this.range);
      } // end if ambient

      /* Adapt the result for windows and doors */
      if(this.type == "window" || this.type == "door"){ // Window type, need to return a digit between 0 and 100
        //this.debug && this.log("[ZIPAC] [getOnCharacteristicHandler] Window or Door found in get Method. returnedValue :",returnedValue)
        if(returnedValue)
         returnedValue = 100;
        else
         returnedValue = 0;
      } // end if window || door

      /* Adapt the value for a battery */
      if(this.type == "battery"){
        if(accessoryValue == undefined)
          this.log.error("[ZIPAC] [getOnCharacteristicHandler] Returned value for the battery level is undefined !"); // TODO add error manage
        else
          returnedValue = parseInt(accessoryValue);
      }
      /* Save the lastValue before give it to homebridge */
      this.lastValue = returnedValue;
      callback(error,returnedValue);
    }.bind(this))
    .catch(function manageError(error){
      //this.log("Test Value in manage Error : ",deviceStatus);
      this.log.error("[ZIPAC] [getOnCharacteristicHandler] Error on getOnCharacteristicHandler :",error);
      callback(error,undefined);
       //throw new Error(error);
    }.bind(this));
  } // end getOnCharacteristicHandler function

  /*
  getOnCharacteristicHandlerB for accessory with two uuid (in fact only Battery Service)
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  For the getB method we do not check the reaching possibility of the device
  */
  getOnCharacteristicHandlerB (callback) {
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnCharacteristicHandlerB');

    var error = null;
    this.zipabox.getAttributesValue(this.uuidb)
    .then(function (accessoryValue){
       this.debug && this.log("[ZIPAC] [getOnCharacteristicHandlerB] Accessory Value returned by callback B:",accessoryValue);
       var returnedValue = accessoryValue;
       if(this.type == "battery"){
         this.debug && this.log("[ZIPAC] [getOnCharacteristicHandlerB] Battery to manage in getOnCharacteristicHandlerB. returnedValue :",returnedValue)
         /* ChargingState Property - enum of Int
         0 - none - The battery isn’t charging.
         1 - inProgress - The battery is charging.
         2 - notChargeable - The battery can’t be charged. [ZIPAC] > Not managed by the plugin
         ----
         Zipato :
         0 - Normal > 1
         1 - Discharging > 0
         */
         if(returnedValue == 0)
          returnedValue = 1;
         else
          returnedValue = 0;
       }
       callback(error,returnedValue);
     }.bind(this)) // end then function
    .catch(function manageError(error){
     //this.log("[ZIPAC] [getOnCharacteristicHandlerB] Test Value in manage Error : ",deviceStatus);
     this.log.error("[ZIPAC] [getOnCharacteristicHandlerB] Error on getOnCharacteristicHandlerB :",error);
     callback(error,undefined);
        //throw new Error(error);
    }.bind(this)); // end promise block
  } // end getOnCharacteristicHandlerB

  /*
  getOnCharacteristicCopyLast give the last get ou set value
  This is used for different Characteristic who need same request to the box
  This avoid multiple request to the box
  */
  getOnCharacteristicCopyLast (callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOnCharacteristicCopyLast");

    this.delay(2000,this.lastValue)
    .then(function sendTheCallback() { // here value is the lastValue
      var error = null;
      if(this.lastValue == undefined){
        error = "[ZIPAC] [getOnCharacteristicCopyLast] Method request without a setted value. Retry later."
        this.log.error(error);
      }
      callback(error, this.lastValue);
    }.bind(this));
  } // end getOnCharacteristicCopyLast

  /*
  setOnCharacteristicHandler is used to change the value of a attribute
  Method is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function
  The desired value is available in the `value` argument.
  The callback function should be called to return the value (that's in the example of homebridge, I return a null)
  The first argument in the function should be null unless and error occured
  */
  setOnCharacteristicHandler(value, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method setOnCharacteristicHandler", value);
    /* Refresh state for some special accessories */
    if(this.type == "window"){
      this.debug && this.log("[ZIPAC] [setOnCharacteristicHandler] Set method for a Window NOT IMPLEMENTED > stop signal");
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.TargetPosition).getValue();
      callback(null);
      return;
    }
    if(this.type == "door"){
      this.debug && this.log("[ZIPAC] [setOnCharacteristicHandler] Set method for a door NOT IMPLEMENTED > stop signal");
      this.platformAccessory.getService(Service.Door).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Door).getCharacteristic(Characteristic.TargetPosition).getValue();
      callback(null);
      return;
    }
    /* Send the request */
    this.zipabox.putAttributesValueRequest(this.uuid,value)
    .then(function launchCallBack(resp){
      this.lastValue = value;
      callback(resp);
    })
    .catch(function manageError(error) {
      throw new Error(error);
      callback(error);
    });
  } // end setOnCharacteristicHandler function

  /*
  getSpecial is used to always return false
  Special switch are like button. Push it and it release always
  */
  getSpecial (callback){
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method getSpecial');

    /* Special switch are always stateless > false */
    this.delay(1000,false)
    .then(function launchcallback(value){
      callback(null, value);
    })
  } // end method getSpecial

  /*
  setSpecial is used fur special Switch for special action
  "disconnectBox" > button to disconnect the box
  */
  setSpecial (value, callback){
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method setSpecial');

    /* Special type disconnectBox */
    if(this.uuid == "disconnectBox"){
      if(value){
        this.log.warn("[ZIPAC] [setSpecial] User ask to disconnect the box")
        this.zipabox.logoutUser()
        .then(function giveAnswerOfLogout(response){
          if(response)
            this.log.warn("[ZIPAC] [setSpecial] User is log out")
          this.updatePolling(); // Will set the button to false
          callback(null);
        }.bind(this))
        .catch(function manageUnknowError(error){
          this.log.error("[ZIPAC] [setSpecial] Unknown error on setSpecial() :",error);
          callback(error);
        }.bind(this)); // end promise chaining
      }else{
        /* User click very fast or error > setting to false do nothing */
        this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
        callback(null);
      }
    }
  } // end method setSpacial

  /*
  getOnSecurityCurrentHandler return the status of an alarm
  */
  getOnSecurityCurrentHandler (callback) { // Use for get Alarm status
       /* Log to the console the value whenever this function is called */
       this.debug && this.log('[ZIPAC] > Method getOnSecurityCurrentHandler');

       var error = null;
       this.zipabox.getSecurityStatus(this.uuid,this.nightMode)
       .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
         return this.reconnectAfterError(error);
       }.bind(this)) // end catch if disconnect
       .then(function manageCallback(securityCurrentState){
         this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusFault).getValue();
         callback(error,securityCurrentState);
       }.bind(this))
       .catch(function manageError(error){
         this.log("[ZIPAC] [getOnSecurityCurrentHandler] Error on getOnSecurityCurrentHandler :",error);
         callback(error,undefined);
          //throw new Error(error);
       }.bind(this));
  } // end getOnSecurityCurrentHandler

  /*
  setOnSecurityTargetHandler method is used to change the state of an alarm
  */
  setOnSecurityTargetHandler (value, callback){ // set method for alarm Type (SecuritySystem)
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method setOnCharacteristicHandler', value);

    this.zipabox.putSecuritySystem(this.uuid,value)
    .then(function checkIfTrue(putBooleanResponse){
      this.debug && this.log("[ZIPAC] [setOnCharacteristicHandler] return of putBooleanResponse :",putBooleanResponse);
      this.debug && this.log("[ZIPAC] [setOnCharacteristicHandler] type of putBooleanResponse :",typeof(putBooleanResponse));
      if(putBooleanResponse == false){ // The Box have return an issue in arming the Security System
        var error = new Error("[ZIPAC] [setOnCharacteristicHandler] Alarm is not ready to arm. StatusFault set to false");
        this.statusFault = 1;
        this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusFault).getValue();
        this.log.error(error);
        callback(error,undefined);
      }else{
        //if(this.timePolling == 0) // User has no request to check alarm refresh > force get Status after change TODO : do we need this additional test ?
        this.statusFault = 0;
        this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemCurrentState).getValue();
        if(value == 0 && this.nightMode){ // Set on Stay (=Home), but nightMode configured
          this.log.warn("[ZIPAC] [setOnCharacteristicHandler] User set alarm on STAY / HOME but nightMode is on true. Force to NIGHT")
          this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        }
        if(value == 2 && !this.nightMode){ // Set on Night, but nightMode configured
          this.log.warn("[ZIPAC] [setOnCharacteristicHandler] User set alarm on NIGHT but nightMode is on false. Force to HOME.")
          this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        }
        callback(null);
      }
    }.bind(this))
    .catch(function manageError(error) {
      throw new Error("[ZIPAC] [setOnCharacteristicHandler] Undefined error :", error);
    });
  } // Fin methode setOnSecurityTargetHandler

  /*
  getOnSecurityStatusFault return the status of the accessory
  If 1, Homebridge app will specify that the accessory "did'nt response"
  */
  getOnSecurityStatusFault (callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnSecurityStatusFault');

    callback(null,this.statusFault);
  } // end getOnSecurityStatusFault method

  /*
  reconnectAfterError is used in a catch promise if an error is occured.
  The method try to reconnect the plugin to the box to relaunch the last try
  */
  reconnectAfterError(error){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method reconnectAfterError", error.message);

    return new Promise(function(resolve, reject){
      if (error.message == "Unauthorized" || error.message == "Unauthorized "){ // || error.message == "Bad Request " > for test
        this.log.warn("[ZIPAC] [reconnectAfterError] Found Unauthorized error > need reconnection : ", "-"+ error.message + "-");
        /* Try to reconnect the Box */
        return this.zipabox.connectUser()
        .then(function manageAfterConnection(connectionLaunched){
          if(connectionLaunched == false){
            this.debug && this.log("[ZIPAC] [reconnectAfterError] Waiting for reconnection for device ", this.name);
            return this.delay(7000,this.deviceUUID);
            //setTimeout(resolve, 7000, this.deviceUUID);
            // setTimeout(this.log("Waiting for reconnection."),7000);
            // resolve(this.uuidDevice);
          }else{
            // Error not managed > rethrow
            resolve(connectionLaunched);
          }
        }.bind(this))
        .then(function reconnectForSecurity(deviceUUIDorUUID){
          if(this.type == "alarm"){
            this.debug && this.log("[ZIPAC] [reconnectAfterError] Alarm need a reconnection.")
            return this.zipabox.connectSecurity();
          }else{
            return deviceUUIDorUUID; // same for previous Promise without alarm
          }
        }.bind(this))
        .then(function checkStatus(){
          this.debug && this.log("[ZIPAC] [reconnectAfterError] Reconnection success > get Device Status");
          !this.debug && this.log("[ZIPAC] [reconnectAfterError] The plugin has reconnect successfully to the box");
          this.updatePolling();
          return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus);
        }.bind(this))
        .catch(function manageError(error){
           reject(error);
        }); // End Unauthorized error manage
      }else{ // Rethrow error that we can't manage here
        this.log.error("[ZIPAC] [reconnectAfterError] Found error but not manage :", error.message + "-");
        throw error;
      }
    }.bind(this));// End Promise
  } // end reconnectIfError method

  /*
  Function delay give some time between promises
  time in milliseconds
  value tu return on the promise
  */
  delay(time,value){
    return new Promise(function(resolve){
      setTimeout(resolve.bind(null, value), time)
    });
  } // end delay method

} // End ZipAccessory Class


module.exports = ZipAccessory;
