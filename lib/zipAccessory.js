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
    this.debugContext = undefined;
    this.log = log;
    this.zipabox = zipabox;
    this.platformAccessory = undefined;
    this.config = undefined;
    this.uuidGen = undefined;
    this.type = undefined;
    this.name = undefined;
    this.statusFault = undefined;
    this.lastValue = undefined;
    this.getOnOngoing = false;
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
    this.type = config.type;
    this.debug = config.debug || false;
    this.debugContext = "[" + this.type + "/" + this.name + "]";
    if(this.debugPlatform || this.debug){
      this.debug = true;
      this.log.warn("[ZIPAC] Debug mode set for",this.debugContext);
    }
    this.debug && this.log("[ZIPAC] > Method createAccessory", this.debugContext);
    /* Save parameters */
    this.uuidGen = uuidGen;
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
    /* reload instance variables from context */
    this.uuidGen = accessory.UUID;
    this.name = accessory.context.name;
    this.type = accessory.context.type;
    this.debugContext = "[" + this.type + "/" + this.name + "]";
    this.debug && this.log("[ZIPAC] > Method createAccessoryFromCache", this.debugContext);
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
    this.timePolling = accessory.context.timePolling;
    /* save the platformAccessory */
    this.platformAccessory = accessory;
    /* If we create from cahe, we need to rebind characteristics */
    this.bindCharacteristic();
  } // end function rechargeAccessoryFromCache

  /*
  fixContextFromConfig check the config to validate all parameters
  The validated config is saved inside the context of the platformAccessory
  */
  fixContextFromConfig(config, fromCache = false){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method fixContextFromConfig", this.debugContext);
    if(fromCache){
      if(config["debug"] != this.debug){
        this.debug = config["debug"];
        this.debug && this.log("[ZIPAC] [fixContextFromConfig] debug change to",this.debug, this.debugContext)
      }
    }

    /* UUID's of accessory */
    this.uuid = config["uuid"] || null;
    if(this.uuid == null)
      this.log.warn("[ZIPAC] [fixContextFromConfig] No uuid parameter find for the accessory. Please check config.json", this.debugContext);
    this.uuidb = config["uuidb"] || null;
    if(this.uuidb != null)
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] A second Characteristic was added with the uuid",this.uuidb, this.debugContext)
    if(this.type == "battery" && this.uuidb == null)
      this.log.error("[ZIPAC] [fixContextFromConfig] No uuidb specified for the battery accessory : please check config.json.", this.debugContext)
    /* Accessory Informations */
    this.manufacturer = config["manufacturer"] || "zipato";
    this.model = config["model"] || "zipato";
    this.serial = config["serial"] || "zipato";
    /* Optional Test Value */
    this.testValue = config["testValue"] || null;
    if(this.testValue != null)
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] Test value fixed by user at ", this.testValue, this.debugContext);
    /* Optional noStatus to avoid device request */
    this.noStatus = config["noStatus"] || false;
    if(this.noStatus != false && this.noStatus != true){
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] Configuration error : noStatus fixed to false", this.debugContext);
      this.noStatus = false;
    }
    if(this.type == "alarm")
      this.noStatus = true;
    /* Optional reverse Value */
    this.reverseValue = config["reverse"] || false;
    if(this.reverseValue != false && this.reverseValue != true){
      this.log.warn("[ZIPAC] [fixContextFromConfig] WARNING : Configuration error : reverse fixed to false. accessory :",this.name, this.debugContext);
      this.reverseValue = false;
    }
    if(this.type == "alarm")
      this.reverseValue = false;
    /* Optional nightMode alarm */
    this.nightMode = config["nightMode"] || false;
    if(this.nightMode != false && this.nightMode != true){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Configuration error : nightMode fixed to false", this.debugContext);
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
      this.log.warn("[ZIPAC] [fixContextFromConfig] Configuration error : batteryLimit fixed to 0.", this.debugContext);
      this.batteryLimit = 0;
    }
    if(this.type == "door" || this.type == "window")
      this.batteryLimit = 0;
    /* Refresh for timePolling */
    this.timePolling = config["refresh"] || 0;
    if(this.timePolling != 0)
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] User request to refresh the value after (seconds)",this.timePolling, this.debugContext);
    this.timePolling = this.timePolling * 1000; // turn to milliseconds
    this.timeOut = null; // will be launch after connection
    /* Optional special Types */
    if(this.uuid == "disconnectBox"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Disconnect box button", this.debugContext);
      this.noStatus = true;
      this.batteryLimit = 0;
      this.type = "switch";
      this.timePolling = 0;
    }
    if(this.uuid == "rebootBox"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Reboot box button", this.debugContext);
      this.noStatus = true;
      this.batteryLimit = 0;
      this.type = "switch";
      this.timePolling = 0;
    }
    if(this.uuid == "rebootHomebridge"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Reboot Homebridge button", this.debugContext);
      this.noStatus = true;
      this.batteryLimit = 0;
      this.type = "switch";
      this.timePolling = 0;
    }
    /* Set the debug Context for debugging */
    this.debugContext = "[" + this.type + "/" + this.name + "]";

    /* Empty values */
    if(!fromCache)
      this.deviceUUID = null; // if we now we keep it from cache

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
    this.platformAccessory.context.timePolling = this.timePolling;
  }

  /*
  createService link the service to the selected types
  */
  createService(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method createService", this.debugContext);
    /* Switch to the correct service */
    switch(this.type){
      case "switch":
        this.debug && this.log("[ZIPAC] [createService] Add a Switch Accessory", this.debugContext);
        return new Service.Switch(this.name);
        break;
      case "light":
        this.debug && this.log("[ZIPAC] [createService] Add a LightBulb Accessory", this.debugContext);
        return new Service.Lightbulb(this.name);
        break;
      case "outlet":
        this.debug && this.log("[ZIPAC] [createService] Add an Outlet Accessory", this.debugContext);
        var serviceToReturn = new Service.Outlet(this.name);
        return serviceToReturn;
        break;
      case "temperature":
        this.debug && this.log("[ZIPAC] [createService] Add an Temperature Sensor Accessory", this.debugContext);
        var serviceToReturn = new Service.TemperatureSensor(this.name);
        return serviceToReturn;
        break;
      case "ambient":
        this.debug && this.log("[ZIPAC] [createService] Add an Light Sensor Accessory", this.debugContext);
        var serviceToReturn = new Service.LightSensor(this.name);
        return serviceToReturn;
        break;
      case "motion":
        this.debug && this.log("[ZIPAC] [createService] Add an Motion Sensor Accessory", this.debugContext);
        var serviceToReturn = new Service.MotionSensor(this.name);
        return serviceToReturn;
        break;
      case "contact":
        this.debug && this.log("[ZIPAC] [createService] Add an Contact Sensor Accessory", this.debugContext);
        var serviceToReturn = new Service.ContactSensor(this.name);
        return serviceToReturn;
        break;
      case "window":
        this.debug && this.log("[ZIPAC] [createService] Add an Window Accessory", this.debugContext);
        var serviceToReturn = new Service.Window(this.name);
        return serviceToReturn;
        break;
      case "door":
        this.debug && this.log("[ZIPAC] [createService] Add an Door Accessory", this.debugContext);
        var serviceToReturn = new Service.Door(this.name);
        return serviceToReturn;
        break;
      case "leak":
        this.debug && this.log("[ZIPAC] [createService] Add a Leak Sensor Accessory", this.debugContext);
        var serviceToReturn = new Service.LeakSensor(this.name);
        return serviceToReturn;
        break;
      case "co2":
        this.debug && this.log("[ZIPAC] [createService] Add a Carbon Monoxide Sensor Accessory", this.debugContext);
        var serviceToReturn = new Service.CarbonMonoxideSensor(this.name);
        return serviceToReturn;
        break;
      case "battery":
        this.debug && this.log("[ZIPAC] [createService] Add a Battery Accessory", this.debugContext);
        var serviceToReturn = new Service.BatteryService(this.name);
        return serviceToReturn;
        break;
      case "alarm":
        this.debug && this.log("[ZIPAC] [createService] Add a Security System Accessory", this.debugContext);
        var serviceToReturn = new Service.SecuritySystem(this.name);
        /* StatusFault option :
        NO_FAULT = 0;
        GENERAL_FAULT = 1;*/
        this.statusFault = 0;
        return serviceToReturn;
        break;
      default:
        this.debug && this.log("[ZIPAC] [createService] Add a default Switch Accessory", this.debugContext);
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
    this.debug && this.log("[ZIPAC] > Method bindCharacteristic", this.debugContext);
    var service = undefined;
    /* Switch Service */
    if(this.platformAccessory.getService(Service.Switch)){
      if(this.uuid=="disconnectBox" || this.uuid=="rebootBox" || this.uuid=="rebootHomebridge"){
        this.platformAccessory.getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getSpecial.bind(this))
          .on('set', this.setSpecial.bind(this));
      }else{
        this.platformAccessory.getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
      }
      service = this.platformAccessory.getService(Service.Switch);
    }
    /* Lightbulb Service */
    if(this.platformAccessory.getService(Service.Lightbulb)){
      this.platformAccessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));
      service = this.platformAccessory.getService(Service.Lightbulb);
    }
    /* Outlet Service */
    if(this.platformAccessory.getService(Service.Outlet)){
      this.platformAccessory.getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));
      service = this.platformAccessory.getService(Service.Outlet);
    }
    /* Temperature sensor Service */
    if(this.platformAccessory.getService(Service.TemperatureSensor)){
      this.platformAccessory.getService(Service.TemperatureSensor)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getOn.bind(this));
      service = this.platformAccessory.getService(Service.TemperatureSensor);
    }
    /* Ambient sensor Service */
    if(this.platformAccessory.getService(Service.LightSensor)){
      this.platformAccessory.getService(Service.LightSensor)
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getOn.bind(this));
      service = this.platformAccessory.getService(Service.LightSensor);
    }
    /* Motion sensor Service */
    if(this.platformAccessory.getService(Service.MotionSensor)){
      this.platformAccessory.getService(Service.MotionSensor)
        .getCharacteristic(Characteristic.MotionDetected)
        .on('get', this.getOn.bind(this));
      service = this.platformAccessory.getService(Service.MotionSensor);
    }
    /* Contact sensor Service */
    if(this.platformAccessory.getService(Service.ContactSensor)){
      this.platformAccessory.getService(Service.ContactSensor)
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getOn.bind(this));
      service = this.platformAccessory.getService(Service.ContactSensor);
    }
    /* Window Service */
    if(this.platformAccessory.getService(Service.Window)){
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getOn.bind(this));
        //.on('set', this.setOn.bind(this));
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getOnLast.bind(this))
        .on('set', this.setOn.bind(this));
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.PositionState)
        .on('set', this.setOn.bind(this));
      this.platformAccessory.getService(Service.Window)
        .getCharacteristic(Characteristic.HoldPosition)
        .on('get', function(callback){callback(null,true);});
      service = this.platformAccessory.getService(Service.Window);
    }
    /* Door Service */
    if(this.platformAccessory.getService(Service.Door)){
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getOn.bind(this));
        //.on('set', this.setOn.bind(this));
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getOnLast.bind(this))
        .on('set', this.setOn.bind(this));
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.PositionState)
        .on('set', this.setOn.bind(this));
      this.platformAccessory.getService(Service.Door)
        .getCharacteristic(Characteristic.HoldPosition)
        .on('get', function(callback){callback(null,true);});
      service = this.platformAccessory.getService(Service.Door);
    }
    /* Leak Sensor */
    if(this.platformAccessory.getService(Service.LeakSensor)){
      this.platformAccessory.getService(Service.LeakSensor)
        .getCharacteristic(Characteristic.LeakDetected)
        .on('get', this.getOn.bind(this));
      service = this.platformAccessory.getService(Service.LeakSensor);
    }
    /* CO2 Sensor */
    if(this.platformAccessory.getService(Service.CarbonMonoxideSensor)){
      this.platformAccessory.getService(Service.CarbonMonoxideSensor)
        .getCharacteristic(Characteristic.CarbonMonoxideDetected)
        .on('get', this.getOn.bind(this));
      service = this.platformAccessory.getService(Service.CarbonMonoxideSensor);
    }
    /* Battery Service */
    if(this.platformAccessory.getService(Service.BatteryService)){
      this.platformAccessory.getService(Service.BatteryService)
        .getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getOn.bind(this));
      this.platformAccessory.getService(Service.BatteryService)
        .getCharacteristic(Characteristic.ChargingState)
        .on('get', this.getOnB.bind(this));
    }
    /* Alarm Service */
    if(this.platformAccessory.getService(Service.SecuritySystem)){
      this.platformAccessory.getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .on('get', this.getOnSecurity.bind(this));
      this.platformAccessory.getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .on('set', this.setOnSecurity.bind(this))
        .on('get', this.getOnSecurity.bind(this));
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
        .on('get', this.getStatusBattery.bind(this));
    }

    /* Launch the status polling after all */
    if(this.timePolling > 0)
      this.statusPolling();

  } // end bindCharacteristic function

  /*
  statusPolling refresh all accessory after the parameter seconds
  Same as for the platform but only for this accessory
  */
  statusPolling(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method statusPolling", this.debugContext);

    this.timeOut = setTimeout(function refreshStatus(){
      this.updatePolling();
      this.statusPolling();
    }.bind(this),this.timePolling)// end function of timeout
  } // end statusPolling function

  /*
  updatePolling launch the get method to refresh the value of the accessory
  depend of his type
  */
  updatePolling(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method updatePolling", this.debugContext);
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
    this.debug && this.log("[ZIPAC] > Method manageDeviceUUID", this.debugContext);
    return new Promise(function (resolve,reject){
      /* Check if already know */
      if(this.deviceUUID){
        this.debug && this.log("[ZIPAC] [manageDeviceUUID] Device already know :",this.deviceUUID, this.debugContext);
        resolve(this.deviceUUID);
      /* If not e check if it's allow to search one */
      }else if(this.noStatus == true){ // no device Status available > return simple uuid
        this.deviceUUID = this.uuid;
        this.platformAccessory.context.deviceUUID = this.deviceUUID; // Save to archive
        resolve(this.uuid);
      }else{
        this.zipabox.getDeviceUUID(this.uuid)
        .then(function giveDeviceUUID(deviceUUID){
          this.debug && this.log("[ZIPAC] [manageDeviceUUID] Device UUID found in the box :",deviceUUID, this.debugContext);
          this.platformAccessory.context.deviceUUID = this.deviceUUID; // Save to archive
          this.deviceUUID = deviceUUID;
          resolve(deviceUUID);
        }.bind(this));
      }
    }.bind(this)); // end returned Promise
  } // end manageDeviceUUID function

  /*
  getStatusBattery give the battery level of a device and change
  the status (0 or 1) of battery if under the limit
  The function will try to reconnect the box if the device is not found
  */
  getStatusBattery (callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getStatusBattery');

    var error = null;
    this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
      return this.reconnectAfterError(error);
    }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
        //this.debug && this.log("Test Value in manage Status : ",deviceStatus);
        this.debug && this.log("[ZIPAC] [getStatusBattery] Type of Test Value in manage Status : ",typeof(deviceStatus), this.debugContext);
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
      this.debug && this.log("[ZIPAC] [getStatusBattery] Battery status returned to callback:",underLevel, this.debugContext);
      callback(error,underLevel);
    }.bind(this))
    .catch(function manageError(error){
      //this.log("Test Value in manage Error : ",deviceStatus);
      this.log.error("[ZIPAC] [getStatusBattery] Error on getOn :",error, this.debugContext);
      callback(error,undefined);
       //throw new Error(error);
    }.bind(this));
    //callback(null,0);
  }


  /*
  getOn is called when HomeKit wants to retrieve the current state of the characteristic
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  */
  getOn(callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOn", this.debugContext);
    //this.debug && this.log("[ZIPAC] [getOn] device UUID and nostatus :",this.deviceUUID,this.noStatus,this.isOnG);+

    var error = null;
    /* Check for unhandled error */
    if(this.deviceUUID == undefined || this.deviceUUID == null){
      error = "[ZIPAC] [getOn] -this is- forgot. Unhandled error > try reset cachedAccessories.";
      this.log.error(error, this.debugContext);
      callback(error,this.lastValue);
      return;
    }

    this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    .then(function checKIfAlreadyOngoing(deviceStatus){
      return new Promise(function(resolve,reject){
        if(this.getOnOngoing == true){
          reject("getOnOngoing"); // Need a returned rejection to pass all the next then
        }else{
          this.getOnOngoing = true;
          resolve(deviceStatus);
        }// same as above
      }.bind(this))
    }.bind(this))
    .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
      return this.reconnectAfterError(error);
    }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
        //this.debug && this.log("[ZIPAC] [getOn] Test Value in manage Status : ",deviceStatus);
        //this.debug && this.log("[ZIPAC] [getOn] Type of Test Value in manage Status : ",typeof(deviceStatus));
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
      //this.debug && this.log("[ZIPAC] [getOn] Accessory Value returned by callback:",accessoryValue);
      var returnedValue = accessoryValue;
      /* Force boolean for remote access */
      if(returnedValue == "true")
        returnedValue = true;
      if(returnedValue == "false")
        returnedValue = false;
      /* Manage the reverse value */
      if(this.reverseValue == true){ // User ask to reverse
        if(typeof(returnedValue) != "boolean"){ // Check if returnedValue is a Boolean
          var error = new Error("[ZIPAC] [getOn] Coding error in getOn: returnedValue is not a boolean in reverseValue", this.debugContext);
          this.log.error(error);
          throw error;
        }else{
          if(returnedValue == true)
            returnedValue = false;
          else
            returnedValue = true;
        }
        this.debug && this.log("[ZIPAC] [getOn] Configuration have request to reverse the value to :",returnedValue, this.debugContext)
      } // end reverse block

      /* Adapt the scale for lux sensor */
      if(this.type == "ambient"){ // returned from % to scale
        returnedValue = Math.round(this.min + returnedValue/100 * this.range);
      } // end if ambient

      /* Adapt the result for windows and doors */
      if(this.type == "window" || this.type == "door"){ // Window type, need to return a digit between 0 and 100
        //this.debug && this.log("[ZIPAC] [getOn] Window or Door found in get Method. returnedValue :",returnedValue)
        if(returnedValue)
         returnedValue = 100;
        else
         returnedValue = 0;
      } // end if window || door

      /* Adapt the value for a battery */
      if(this.type == "battery"){
        if(accessoryValue == undefined)
          this.log.error("[ZIPAC] [getOn] Returned value for the battery level is undefined !", this.debugContext); // TODO add error manage
        else
          returnedValue = parseInt(accessoryValue);
      }
      /* Save the lastValue before give it to homebridge */
      this.lastValue = returnedValue;
      this.getOnOngoing = false;
      callback(error,returnedValue);
    }.bind(this))
    .catch(function manageError(error){
      /* getOnOngoing true error */
      if(error == "getOnOngoing"){
        this.debug && this.log.warn("[ZIPAC] [getOn] New get Request before get the previously one. By-passed. Reduce the refresh rate to avoir this.", this.debugContext);
        this.getOnOngoing = false;
        callback(null,this.lastValue);
      }else{
        //this.log("Test Value in manage Error : ",deviceStatus);
        this.log.error("[ZIPAC] [getOn] Error on getOn :",error, this.debugContext);
        this.getOnOngoing = false;
        callback(error,undefined);
         //throw new Error(error);
      }
    }.bind(this));
  } // end getOn function

  /*
  getOnB for accessory with two uuid (in fact only Battery Service)
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  For the getB method we do not check the reaching possibility of the device
  */
  getOnB (callback) {
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnB', this.debugContext);

    var error = null;
    this.zipabox.getAttributesValue(this.uuidb)
    .then(function (accessoryValue){
       this.debug && this.log("[ZIPAC] [getOnB] Accessory Value returned by callback B:",accessoryValue, this.debugContext);
       var returnedValue = accessoryValue;
       if(this.type == "battery"){
         this.debug && this.log("[ZIPAC] [getOnB] Battery to manage in getOnB. returnedValue :",returnedValue, this.debugContext)
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
     //this.log("[ZIPAC] [getOnB] Test Value in manage Error : ",deviceStatus);
     this.log.error("[ZIPAC] [getOnB] Error on getOnB :",error, this.debugContext);
     callback(error,undefined);
        //throw new Error(error);
    }.bind(this)); // end promise block
  } // end getOnB

  /*
  getOnLast give the last get ou set value
  This is used for different Characteristic who need same request to the box
  This avoid multiple request to the box
  */
  getOnLast (callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOnLast", this.debugContext);

    this.delay(2000,this.lastValue)
    .then(function sendTheCallback() { // here value is the lastValue
      var error = null;
      if(this.lastValue == undefined){
        error = "[ZIPAC] [getOnLast] Method request without a setted value. Retry later."
        this.log.warn(error, this.debugContext);
      }
      callback(error, this.lastValue);
    }.bind(this));
  } // end getOnLast

  /*
  setOn is used to change the value of a attribute
  Method is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function
  The desired value is available in the `value` argument.
  The callback function should be called to return the value (that's in the example of homebridge, I return a null)
  The first argument in the function should be null unless and error occured
  */
  setOn(value, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method setOn", value, this.debugContext);
    /* Refresh state for some special accessories */
    if(this.type == "window"){
      this.debug && this.log("[ZIPAC] [setOn] Set method for a Window NOT IMPLEMENTED > stop signal", this.debugContext);
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.TargetPosition).getValue();
      callback(null);
      return;
    }
    if(this.type == "door"){
      this.debug && this.log("[ZIPAC] [setOn] Set method for a door NOT IMPLEMENTED > stop signal", this.debugContext);
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
    }.bind(this))
    .catch(function manageError(error) {
      throw new Error(error);
      callback(error);
    });
  } // end setOn function

  /*
  getSpecial is used to always return false
  Special switch are like button. Push it and it release always
  */
  getSpecial (callback){
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method getSpecial', this.debugContext);

    /* Special switch are always stateless > false */
    this.delay(1000,false)
    .then(function launchcallback(value){
      callback(null, value);
    })
  } // end method getSpecial

  /*
  setSpecial is used fur special Switch for special action
  "disconnectBox" > button to disconnect the box
  "rebootBox" > button to reboot the box
  */
  setSpecial (value, callback){
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method setSpecial', this.debugContext);

    /* Special type disconnectBox */
    if(this.uuid == "disconnectBox"){
      if(value){ // Only for activation of the switch
        this.log.warn("[ZIPAC] [setSpecial] User ask to disconnect the box", this.debugContext);
        this.zipabox.logoutUser()
        .then(function giveAnswerOfLogout(response){
          if(response)
            this.log.warn("[ZIPAC] [setSpecial] User is log out", this.debugContext);
          this.updatePolling(); // Will set the button to false
          callback(null);
        }.bind(this))
        .catch(function manageUnknowError(error){
          this.log.error("[ZIPAC] [setSpecial] Unknown error on setSpecial() :",error, this.debugContext);
          callback(error);
        }.bind(this)); // end promise chaining
      }else{
        /* User click very fast or error > setting to false do nothing */
        this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
        callback(null);
      }
    }
    /* Special type rebootBox */
    if(this.uuid == "rebootBox"){
      if(value){
        this.log.warn("[ZIPAC] [setSpecial] User ask to reboot the box", this.debugContext);
        this.zipabox.rebootTheBox()
        .then(function giveAnswerOfReboot(response){
          if(response)
            this.log.warn("[ZIPAC] [setSpecial] Box is rebooted", this.debugContext);
          this.updatePolling(); // Will set the button to false
          callback(null);
        }.bind(this))
        .catch(function manageUnknowError(error){
          this.log.error("[ZIPAC] [setSpecial] Unknown error on setSpecial() :",error, this.debugContext);
          callback(error);
        }.bind(this)); // end promise chaining
      }else{ // return simply the state if user click quic
        /* User click very fast or error > setting to false do nothing */
        this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
        callback(null);
      }
    }
    /* Special type rebootHomebridge*/
    if(this.uuid == "rebootHomebridge"){
      if(value){
        this.log.warn("[ZIPAC] [setSpecial] User ask to reboot Homebridge > create error", this.debugContext);
        error = "reboot" / 0;
        this.updatePolling(); // Will set the button to false
      }else{ // return simply the state if user click quic
        /* User click very fast or error > setting to false do nothing */
        this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
        callback(null);
      }
    }
  } // end method setSpacial

  /*
  getOnSecurity return the status of an alarm
  */
  getOnSecurity (callback) { // Use for get Alarm status
       /* Log to the console the value whenever this function is called */
       this.debug && this.log('[ZIPAC] > Method getOnSecurity', this.debugContext);

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
         this.log("[ZIPAC] [getOnSecurity] Error on getOnSecurity :",error, this.debugContext);
         callback(error,undefined);
          //throw new Error(error);
       }.bind(this));
  } // end getOnSecurity

  /*
  setOnSecurity method is used to change the state of an alarm
  */
  setOnSecurity (value, callback){ // set method for alarm Type (SecuritySystem)
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method setOn', value, this.debugContext);

    this.zipabox.putSecuritySystem(this.uuid,value)
    .then(function checkIfTrue(putBooleanResponse){
      this.debug && this.log("[ZIPAC] [setOn] return of putBooleanResponse :",putBooleanResponse, this.debugContext);
      this.debug && this.log("[ZIPAC] [setOn] type of putBooleanResponse :",typeof(putBooleanResponse), this.debugContext);
      if(putBooleanResponse == false){ // The Box have return an issue in arming the Security System
        var error = new Error("[ZIPAC] [setOn] Alarm is not ready to arm. StatusFault set to false");
        this.statusFault = 1;
        this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusFault).getValue();
        this.log.error(error);
        callback(error,undefined);
      }else{
        //if(this.timePolling == 0) // User has no request to check alarm refresh > force get Status after change TODO : do we need this additional test ?
        this.statusFault = 0;
        this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemCurrentState).getValue();
        if(value == 0 && this.nightMode){ // Set on Stay (=Home), but nightMode configured
          this.log.warn("[ZIPAC] [setOn] User set alarm on STAY / HOME but nightMode is on true. Force to NIGHT", this.debugContext)
          this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        }
        if(value == 2 && !this.nightMode){ // Set on Night, but nightMode configured
          this.log.warn("[ZIPAC] [setOn] User set alarm on NIGHT but nightMode is on false. Force to HOME.", this.debugContext)
          this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        }
        callback(null);
      }
    }.bind(this))
    .catch(function manageError(error) {
      throw new Error("[ZIPAC] [setOn] Undefined error :", error, this.debugContext);
    }.bind(this));
  } // Fin methode setOnSecurity

  /*
  getOnSecurityStatusFault return the status of the accessory
  If 1, Homebridge app will specify that the accessory "did'nt response"
  */
  getOnSecurityStatusFault (callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnSecurityStatusFault', this.debugContext);

    callback(null,this.statusFault);
  } // end getOnSecurityStatusFault method

  /*
  reconnectAfterError is used in a catch promise if an error is occured.
  The method try to reconnect the plugin to the box to relaunch the last try
  */
  reconnectAfterError(error){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method reconnectAfterError", error.message, this.debugContext);

    return new Promise(function(resolve, reject){
      if (error.message == "Unauthorized" || error.message == "Unauthorized "){ // || error.message == "Bad Request " > for test
        this.log.warn("[ZIPAC] [reconnectAfterError] Found Unauthorized error > need reconnection : ", "-"+ error.message + "-", this.debugContext);
        /* Try to reconnect the Box */
        return this.zipabox.connectUser()
        .then(function manageAfterConnection(connectionLaunched){
          if(connectionLaunched == false){
            this.debug && this.log("[ZIPAC] [reconnectAfterError] Waiting for reconnection for device ", this.name, this.debugContext);
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
            this.debug && this.log("[ZIPAC] [reconnectAfterError] Alarm need a reconnection.", this.debugContext)
            return this.zipabox.connectSecurity();
          }else{
            return deviceUUIDorUUID; // same for previous Promise without alarm
          }
        }.bind(this))
        .then(function checkStatus(){
          this.debug && this.log("[ZIPAC] [reconnectAfterError] Reconnection success > get Device Status", this.debugContext);
          !this.debug && this.log("[ZIPAC] [reconnectAfterError] The plugin has reconnect successfully to the box");
          this.updatePolling();
          return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus);
        }.bind(this))
        .catch(function manageError(error){
           reject(error);
        }); // End Unauthorized error manage
      }else if(error.message == "getOnOngoing"){
        this.debug && this.log("[ZIPAC] [reconnectAfterError] Found getOnOngoing error. Return last value.", this.debugContext)
        return Promise.reject(this.lastValue); // TODO : check if it's working
      }else{ // Rethrow error that we can't manage here
        this.log.error("[ZIPAC] [reconnectAfterError] Found error but not manage :", error.message + "-", this.debugContext);
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
