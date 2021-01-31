'use strict';

var inherits = require('util').inherits;

/* Link this module to homebridge. */
let Accessory;
let Service;
let Characteristic;

/* CUSTOM */
let ZHBatteryPercentage;

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
    this.isTampered = 0;
    this.lastValue = undefined;
    this.getOnOngoing = false;
    this.isOnSector = undefined;
    this.alarmPutTimer = undefined;
    this.useCache = false;
    this.getTimer = undefined;
    this.batteryBound = false;
    this.isActivated = true;
    this.batteryLevel = 100;
    this.basedService = undefined;
    this.refreshCount = 10; // Use to know how many times we call for the battery status
    this.backupValue = 100;
    Accessory = zAccessory;
    Service = zService;
    Characteristic = zCharacteristic;

    /* CUSTOM CHARACTERISTIC */

    /* Battery Percentage showed in EVE App */
    ZHBatteryPercentage = function() {
  		// Characteristic.call(this, 'CustomGS', 'E863F10D-079E-48FF-8F27-9C2605A29F52'); // Voltage
  		Characteristic.call(this, 'Battery level', 'E863F11B-079E-48FF-8F27-9C2605A29F52'); // Battery Percentage
  		this.setProps({
  			format: Characteristic.Formats.UINT16,
  			unit: 'percent',
  			maxValue: 100,
  			minValue: 0,
  			minStep: 1,
  			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  		});
  		this.value = this.getDefaultValue();
  	};
  	inherits(ZHBatteryPercentage, Characteristic);
    ZHBatteryPercentage.UUID = 'E863F11B-079E-48FF-8F27-9C2605A29F52';

  } // end constructor of ZipAccessory Class

  /*
  desactivate is used to set the status of the instance to "delete"
  Stop polling and get update method
  */
  desactivate(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method desactivate", this.debugContext);

    this.timePolling = 0;
    this.isActivated = false;
  } // end desactivate method

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
    this.platformAccessory.addService(this.createService(this.type));
    this.bindCharacteristic(this.type);
    // /* Check for additional sub accessories */
    // this.subaccessories = config.subaccessories[] || false;
    // if(!this.subaccessories){
    //   this.debug && this.log("[ZIPAC] [createAccessory] Multiples detected. Create the children know.", this.debugContext);
    //   this.debug && this.log("[ZIPAC] [createAccessory] Number of accessories :", this.subaccessories.length);
    //   for (var index = 0; index < this.subaccessories.length; index++){
    //     if(this.checkType(this.subaccessories[index].type)){
    //       this.platformAccessory.addService(this.createService(this.subaccessories[index].type));
    //     }
    //   }
    // }else{
    //   this.debug && this.log("[ZIPAC] [createAccessory] No multiples detected. This poor accessory is alone.", this.debugContext);
    // }

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
    this.batteryLevel = accessory.context.batteryLevel;
    this.isOnSector = accessory.context.isOnSector;
    this.timePolling = accessory.context.timePolling;
    this.useCache = accessory.context.useCache;
    this.hidden = accessory.context.hidden;
    this.backupValue = accessory.context.backupValue;
    /* save the platformAccessory */
    this.platformAccessory = accessory;
    /* If we create from cahe, we need to rebind characteristics */
    this.bindCharacteristic(this.type,true);
  } // end function rechargeAccessoryFromCache

  /*
  fixContextFromConfig check the config to validate all parameters
  The validated config is saved inside the context of the platformAccessory
  */
  fixContextFromConfig(config){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method fixContextFromConfig", this.debugContext);
    // if(fromCache){
    if(config["debug"] != this.debug){
      this.debug = config["debug"];
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] debug change to",this.debug, this.debugContext)
    }
    // }

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
    if(this.type == "door" || this.type == "window" || this.type == "switch" || this.type == "light" || this.type == "outlet" || this.noStatus)
      this.isOnSector = true;
    /* Optional Refresh for timePolling */
    this.timePolling = config["refresh"] || 0;
    if(this.timePolling != 0)
      this.debug && this.log("[ZIPAC] [fixContextFromConfig] User request to refresh the value after (seconds)",this.timePolling, this.debugContext);
    this.timePolling = this.timePolling * 1000; // turn to milliseconds
    this.timeOut = null; // will be launch after connection

    /* OPtional useCache option */
    this.useCache = config["useCache"] || false;
    if(this.useCache != true && this.useCache != false){
      this.log.warn("Configuration error. Parameter use cache must be true or false. Forced to false.");
      this.useCache = false;
    }
    if(this.useCache && this.timePolling < 100){
      this.log.warn("Using cache with no refresh will not refresh the value of the accessory. Using Cache is forced to false.", this.debugContext);
      this.useCache = false;
    }

    /* Custom Characteristic */
    this.useEve = config["useEve"] || false;
    if(this.useEve != true && this.useEve != false){
      this.log.warn("Configuration error. Parameter useEve must be true or false. Forced to false", this.debugContext);
      this.useEve = false;
    }

    /* Optional hidden */
    this.hidden = config["hidden"] || false;
    if(this.hidden != true && this.hidden != false){
      this.log.warn("Configuration error. Parameter hidden must be true or false. Forced to false", this.debugContext);
      this.hidden = false;
    }

    /* Optional special buttons */
    if(this.uuid == "disconnectBox"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Disconnect box button", this.debugContext);
      this.noStatus = true;
      // this.batteryLimit = 0;
      this.type = "switch";
      this.timePolling = 0;
      this.isOnSector = true;
    }
    if(this.uuid == "rebootBox"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Reboot box button", this.debugContext);
      this.noStatus = true;
      // this.batteryLimit = 0;
      this.type = "switch";
      this.timePolling = 0;
      this.isOnSector = true;
    }
    if(this.uuid == "rebootHomebridge"){
      this.log.warn("[ZIPAC] [fixContextFromConfig] Special type ask by the user : Reboot Homebridge button", this.debugContext);
      this.noStatus = true;
      // this.batteryLimit = 0;
      this.type = "switch";
      this.timePolling = 0;
      this.isOnSector = true;
    }
    /* Set the debug Context for debugging */
    this.debugContext = "[" + this.type + "/" + this.name + "]";

    // /* Empty values */
    // if(!fromCache)
    //   this.deviceUUID = null; // if we now we keep it from cache

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
    this.platformAccessory.context.batteryLevel = this.batteryLevel;
    this.platformAccessory.context.isOnSector = this.isOnSector;
    this.platformAccessory.context.timePolling = this.timePolling;
    this.platformAccessory.context.useEve = this.useEve;
    this.platformAccessory.context.useCache = this.useCache;
    this.platformAccessory.context.hidden = this.hidden;
    this.platformAccessory.context.backupValue = this.backupValue;
  }

  /*
  createService link the service to the selected types
  */
  createService(typeOfAccessory){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method createService", this.debugContext);
    /* Switch to the correct service */
    switch(typeOfAccessory){
      case "switch":
        this.debug && this.log("[ZIPAC] [createService] Add a Switch Accessory", this.debugContext);
        this.basedService = new Service.Switch(this.name)
        return this.basedService;
        break;
      case "light":
        this.debug && this.log("[ZIPAC] [createService] Add a LightBulb Accessory", this.debugContext);
        this.basedService = new Service.Lightbulb(this.name);
        return this.basedService;
        break;
      case "dimmer":
        this.debug && this.log("[ZIPAC] [createService] Add a Dimmer Accessory", this.debugContext);
        this.basedService = new Service.Lightbulb(this.name);
        return this.basedService;
        break;
      case "outlet":
        this.debug && this.log("[ZIPAC] [createService] Add a Outlet Accessory", this.debugContext);
        this.basedService = new Service.Outlet(this.name);
        return this.basedService;
        break;
      case "temperature":
        this.debug && this.log("[ZIPAC] [createService] Add a Temperature Sensor Accessory", this.debugContext);
        this.basedService = new Service.TemperatureSensor(this.name);
        return this.basedService;
        break;
      case "ambient":
        this.debug && this.log("[ZIPAC] [createService] Add a Light Sensor Accessory", this.debugContext);
        this.basedService = new Service.LightSensor(this.name);
        return this.basedService;
        break;
      case "motion":
        this.debug && this.log("[ZIPAC] [createService] Add a Motion Sensor Accessory", this.debugContext);
        this.basedService = new Service.MotionSensor(this.name);
        return this.basedService;
        break;
      case "contact":
        this.debug && this.log("[ZIPAC] [createService] Add a Contact Sensor Accessory", this.debugContext);
        this.basedService = new Service.ContactSensor(this.name);
        return this.basedService;
        break;
      case "window":
        this.debug && this.log("[ZIPAC] [createService] Add a Window Accessory", this.debugContext);
        this.basedService = new Service.Window(this.name);
        return this.basedService;
        break;
      case "door":
        this.debug && this.log("[ZIPAC] [createService] Add a Door Accessory", this.debugContext);
        this.basedService =  new Service.Door(this.name);
        return this.basedService;
        break;
      case "covering":
        this.debug && this.log("[ZIPAC] [createService] Add a Window Covering Accessory", this.debugContext);
        this.basedService =  new Service.WindowCovering(this.name);
        return this.basedService;
        break;
      case "leak":
        this.debug && this.log("[ZIPAC] [createService] Add a Leak Sensor Accessory", this.debugContext);
        this.basedService = new Service.LeakSensor(this.name);
        return this.basedService;
        break;
      case "co2":
        this.debug && this.log("[ZIPAC] [createService] Add a Carbon Monoxide Sensor Accessory", this.debugContext);
        this.basedService = new Service.CarbonMonoxideSensor(this.name);
        return this.basedService;
        break;
      case "battery":
        this.debug && this.log("[ZIPAC] [createService] Add a Battery Accessory", this.debugContext);
        this.basedService = new Service.BatteryService(this.name);
        return this.basedService;
        break;
      case "alarm":
        this.debug && this.log("[ZIPAC] [createService] Add a Security System Accessory", this.debugContext);
        this.basedService = new Service.SecuritySystem(this.name);
        /* StatusFault option :
        NO_FAULT = 0;
        GENERAL_FAULT = 1;*/
        this.statusFault = 0;
        return this.basedService;
        break;
      default:
        this.log.warn("[ZIPAC] [createService] Add a default Switch Accessory - Check your configuration.", this.debugContext);
        this.basedService = new Service.Switch(this.name);
        return this.basedService;
    } // end switchs
  } // end function createService


  /*
  bindService return the same accessory with the service needed
  'get' is called when HomeKit wants to retrieve the current state of the characteristic
  'set' is called when HomeKit wants to update the value of the characteristic
  If use after cache reload, fromCache must be true to recreate the based service
  */
  bindCharacteristic(type,fromCache = false){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method bindCharacteristic", this.debugContext);
    var service = undefined;

    /* Attach the correct service based on the type of accessory */
    switch(type){
      case "switch":
        /* Manage the special switchs */
        if(this.uuid=="disconnectBox" || this.uuid=="rebootBox" || this.uuid=="rebootHomebridge"){
          this.platformAccessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getSpecial.bind(this))
            .on('set', this.setSpecial.bind(this));
        }else{
          /* And a normal switch */
          this.platformAccessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));
        }
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Switch);
        break;
      case "light":
        this.platformAccessory.getService(Service.Lightbulb)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Lightbulb);
        break;
      case "dimmer":
        this.platformAccessory.getService(Service.Lightbulb)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOnRange.bind(this))
          .on('set', this.setOnRange.bind(this));
        this.platformAccessory.getService(Service.Lightbulb)
          .getCharacteristic(Characteristic.Brightness)
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Lightbulb);
        break;
      case "outlet":
        this.platformAccessory.getService(Service.Outlet)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        this.platformAccessory.getService(Service.Outlet)
          .getCharacteristic(Characteristic.OutletInUse)
          .on('get', this.getOnB.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Outlet);
        break;
      case "temperature":
        this.platformAccessory.getService(Service.TemperatureSensor)
          .getCharacteristic(Characteristic.CurrentTemperature)
          .on('get', this.getOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.TemperatureSensor);
        break;
      case "ambient":
        this.platformAccessory.getService(Service.LightSensor)
          .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
          .on('get', this.getOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.LightSensor);
        break;
      case "motion":
        this.platformAccessory.getService(Service.MotionSensor)
          .getCharacteristic(Characteristic.MotionDetected)
          .on('get', this.getOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.MotionSensor);
        break;
      case "contact":
        this.platformAccessory.getService(Service.ContactSensor)
          .getCharacteristic(Characteristic.ContactSensorState)
          .on('get', this.getOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.ContactSensor);
        break;
      case "window":
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
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        this.platformAccessory.getService(Service.Window)
          .getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Window);
        break;
      case "door":
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
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        this.platformAccessory.getService(Service.Door)
          .getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Door);
        break;
      case "covering":
        this.platformAccessory.getService(Service.WindowCovering)
          .getCharacteristic(Characteristic.CurrentPosition)
          .on('get', this.getOn.bind(this));
          //.on('set', this.setOn.bind(this));
        this.platformAccessory.getService(Service.WindowCovering)
          .getCharacteristic(Characteristic.TargetPosition)
          .on('get', this.getOnLast.bind(this))
          .on('set', this.setOn.bind(this));
        this.platformAccessory.getService(Service.WindowCovering)
          .getCharacteristic(Characteristic.PositionState)
          .on('set', function(value,callback){callback(null);}) // Always return ok TODO : change for movement
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        this.platformAccessory.getService(Service.WindowCovering)
          .getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.WindowCovering);
        break;
      case "leak":
        this.platformAccessory.getService(Service.LeakSensor)
          .getCharacteristic(Characteristic.LeakDetected)
          .on('get', this.getOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.LeakSensor);
        break;
      case "co2":
        this.platformAccessory.getService(Service.CarbonMonoxideSensor)
          .getCharacteristic(Characteristic.CarbonMonoxideDetected)
          .on('get', this.getOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.CarbonMonoxideSensor);
        break;
      case "battery":
        this.platformAccessory.getService(Service.BatteryService)
          .getCharacteristic(Characteristic.BatteryLevel)
          .on('get', this.getOn.bind(this));
        this.platformAccessory.getService(Service.BatteryService)
          .getCharacteristic(Characteristic.ChargingState)
          .on('get', this.getOnB.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.BatteryService);
        break;
      case "alarm":
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
        this.platformAccessory.getService(Service.SecuritySystem)
          .getCharacteristic(Characteristic.StatusTampered)
          .on('get', this.getOnSecurityStatusTampered.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.SecuritySystem);
        break;
      default:
        this.platformAccessory.getService(Service.Switch)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        if(fromCache)
          this.basedService = this.platformAccessory.getService(Service.Switch);
    } // end switch

    /* Link the 'identify' event */
    this.platformAccessory.on('identify', function(paired, callback) {
      this.identifyZipAccessory();
      //callback(null);
    }.bind(this));

    /* Launch the status polling after all */
    if(this.timePolling > 0)
      this.statusPolling();

  } // end bindCharacteristic function

  /*
  Function called at the first getOn after knowing if device is on sector or not
  This will add the StatusLowBattery characteristic to the base service
  */
  bindBatteryLowStatus(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method bindBatteryLowStatus", this.debugContext);

    /* Bound the Get function */
    this.batteryBound = true;
    this.basedService.getCharacteristic(Characteristic.StatusLowBattery) // Normal = 0, Low = 1
      .on('get', this.getStatusBattery.bind(this));

    /* Bound the battery percentage function */
    if(this.useEve){
      if(this.basedService.testCharacteristic(ZHBatteryPercentage)){ // Only need an update
        this.basedService.getCharacteristic(ZHBatteryPercentage)
          .on('get', this.getBatteryLevel.bind(this));
      }else{
        this.basedService.addCharacteristic(ZHBatteryPercentage); // Need to add
        this.basedService.getCharacteristic(ZHBatteryPercentage)
          .on('get', this.getBatteryLevel.bind(this));
      }
    }
  } // end bindBatteryLowStatus

  /*
  identifyZipAccessory is called when the user ask to identify the accessory
  */
  identifyZipAccessory(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method identifyZipAccessory", this.debugContext);

    /* Logging the accessory information */
    this.log.warn(this.debugContext,"------ Start Identify ------");
    this.log.warn(this.debugContext,"Name :",this.name);
    this.log.warn(this.debugContext,"Type :",this.type);
    this.log.warn(this.debugContext,"Serial :",this.serial);
    this.log.warn(this.debugContext,"Manufacturer :",this.manufacturer);
    this.log.warn(this.debugContext,"Model :",this.model);
    this.log.warn(this.debugContext,"State uuid :",this.uuid);
    this.log.warn(this.debugContext,"Device uuid :",this.deviceUUID);
    this.log.warn(this.debugContext,"Homebridge uuid :",this.uuidGen);
    this.log.warn(this.debugContext,"noStatus ? :",this.noStatus);
    this.log.warn(this.debugContext,"isOnSector ? :",this.isOnSector);
    this.log.warn(this.debugContext,"Last Value :",this.lastValue);
    this.log.warn(this.debugContext,"Battery Level :",this.batteryLevel);
    this.log.warn(this.debugContext,"Battery Limit :",this.batteryLimit);
    this.log.warn(this.debugContext,"Use Eve ? :",this.useEve);
    this.log.warn(this.debugContext,"Hidden ? :",this.hidden);
    this.log.warn(this.debugContext,"------ End Identify ------");
  }

  /*
  statusPolling refresh all accessory after the parameter seconds
  Same as for the platform but only for this accessory
  */
  statusPolling(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method statusPolling", this.debugContext);

    /* Block to stop polling for desactivated devices */
    if(this.isActivated == false){
      this.debug && this.log("[ZIPAC] [statusPolling] Stopping refresh for desactivated device", this.debugContext);
      return;
    }

    /* Block for no polling */
    if(this.timePolling < 100){
      this.debug && this.log("[ZIPAC] [statusPolling] Refresh to low - stopping", this.debugContext);
      return;
    }

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

    /* Desactivation status */
    if(this.isActivated == false)
      return;

    /* Update based on type of service */
    if(this.platformAccessory.getService(Service.Switch))
      this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
    if(this.platformAccessory.getService(Service.Lightbulb)){
      this.platformAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).getValue();
      if(this.type == "dimmer")
        this.platformAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).getValue();
    }
    if(this.platformAccessory.getService(Service.Outlet)){
      this.platformAccessory.getService(Service.Outlet).getCharacteristic(Characteristic.On).getValue();
      this.platformAccessory.getService(Service.Outlet).getCharacteristic(Characteristic.OutletInUse).getValue();
    }
    if(this.platformAccessory.getService(Service.TemperatureSensor))
      this.platformAccessory.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature).getValue();
    if(this.platformAccessory.getService(Service.LightSensor))
      this.platformAccessory.getService(Service.LightSensor).getCharacteristic(Characteristic.CurrentAmbientLightLevel).getValue();
    if(this.platformAccessory.getService(Service.MotionSensor)){
      this.platformAccessory.getService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected).getValue();
      // this.platformAccessory.getService(Service.MotionSensor).getCharacteristic(Characteristic.StatusActive).getValue();
    }
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
    if(this.platformAccessory.getService(Service.WindowCovering)){
      this.platformAccessory.getService(Service.WindowCovering).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.WindowCovering).getCharacteristic(Characteristic.TargetPosition).getValue();
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
      this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusTampered).getValue();
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
  return a promise who resolve the Device UUID and check if is on sector or not
  if noStatus is true, will resolve same uuid as attribute
  The method ask only once the API for this information
  */
  getDeviceUUID(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getDeviceUUID", this.debugContext);
    return new Promise(function (resolve,reject){
      /* Check if already know */
      if(this.deviceUUID){
        this.debug && this.log("[ZIPAC] [getDeviceUUID] Device already know :",this.deviceUUID, this.debugContext);
        resolve(this.deviceUUID);
      /* If not e check if it's allow to search one */
      }else if(this.noStatus == true){ // no device Status available > return simple uuid
        this.deviceUUID = this.uuid;
        this.platformAccessory.context.deviceUUID = this.deviceUUID; // Save to archive
        this.isOnSector = true;
        resolve(this.uuid);
      }else{
        this.zipabox.getDeviceUUID(this.uuid)
        .then(function giveDeviceUUID(deviceUUID){
          this.debug && this.log("[ZIPAC] [getDeviceUUID] Device UUID found in the box :",deviceUUID, this.debugContext);
          this.platformAccessory.context.deviceUUID = this.deviceUUID; // Save to archive
          this.deviceUUID = deviceUUID;
          return deviceUUID
          // resolve(deviceUUID); // before to resolve the deviceUUID, we use it to know if we are on battery or not
        }.bind(this))
        .then(function setIfIsOnSector(deviceUUID){
          this.zipabox.isOnSector(deviceUUID)
          .then(function checkValueSector(isOnSector){
            /* Set the isOnSector from API */
            if(typeof(isOnSector) == "boolean")
              this.isOnSector = isOnSector;
            /* Force to true for some accessories */
            if(this.type == "door" || this.type == "window" || this.type == "switch" || this.type == "light" || this.type == "outlet" || this.type == "dimmer" || this.noStatus)
              this.isOnSector = true;
            this.debug && this.log("[ZIPAC] [getDeviceUUID] Is device on sector ?",isOnSector, this.debugContext);
            this.debug && this.log("[ZIPAC] [getDeviceUUID] DeviceUUID saved :",deviceUUID, this.debugContext);
            resolve(deviceUUID);
          }.bind(this));
        }.bind(this));
      } // End if else search for device
    }.bind(this)); // end returned Promise
  } // end getDeviceUUID function

  /*
  getStatusBattery give the battery status based on the level of a device and change
  the status (0 or 1) of battery if under the limit
  Depend of the choice of the user to use cache or not, the saved value is requested
  */
  getStatusBattery(callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getStatusBattery', this.debugContext);

    /* Is correctly request ? */
    if(this.deviceUUID == undefined){
      this.log.error("[ZIPAC] [getStatusBattery] Bad request. device UUID is undefined", this.debugContext);
      callback(null,0);
      return;
    }
    if(this.isOnSector == true){
      // this.log.error("[ZIPAC] [getStatusBattery] Bad request. device is on sector.", this.debugContext);
      callback(null,0);
      return;
    }

    var statusBattery = 0;
    var error = null;
    /* Get level based on cache or request the value */
    if(this.useCache){
      if(this.batteryLimit > this.batteryValue)
        statusBattery = 1
      callback(error, statusBattery);
    }else{
      this.getStatusBatteryAPI()
      .then(function sendCallBack(returnOfApiStatus){
        if(this.batteryLimit > this.batteryValue)
          statusBattery = 1
        callback(error, statusBattery);
      }.bind(this))
    }

  } // end method getStatusBattery

  /*
  getStatusBatteryAPI give the battery level of a device and change
  the status (0 or 1) of battery if under the limit
  The function will try to reconnect the box if the device is not found
  */
  getStatusBatteryAPI(){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getStatusBatteryAPI', this.debugContext);

    // /* Is correctly request ? */
    // if(this.deviceUUID == undefined){
    //   this.log.error("[ZIPAC] [getStatusBatteryAPI] Bad request. device UUID is undefined", this.debugContext);
    //   callback(null,0);
    //   return;
    // }

    // var error = null;
    return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
      return this.reconnectAfterError(error);
    }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
        //this.debug && this.log("Test Value in manage Status : ",deviceStatus);
        this.debug && this.log("[ZIPAC] [getStatusBatteryAPI] Type of Test Value in manage Status : ",typeof(deviceStatus), this.debugContext);
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
      this.debug && this.log("[ZIPAC] [getStatusBatteryAPI] Battery value :",batteryValue, this.debugContext);
      this.batteryLevel = batteryValue;
      if(batteryValue < this.batteryLimit)
        underLevel = 1;
      this.debug && this.log("[ZIPAC] [getStatusBatteryAPI] Battery status returned to callback:",underLevel, this.debugContext);
      // callback(error,underLevel);
      return underLevel;
    }.bind(this))
    .catch(function manageError(error){
      if(error.message == "Not Found"){
        this.log.warn("[ZIPAC] [getStatusBatteryAPI] The battery level was not found. Please check config for noStatus = true. Plugin will force on sector.", this.debugContext);
        this.isOnSector = true;
        // callback(null,0);
        return 0;
      }else{
        //this.log("Test Value in manage Error : ",deviceStatus);
        this.log.error("[ZIPAC] [getStatusBatteryAPI] Error not manage :",this.debugContext,error);
        // callback(error,undefined);
        return undefined;
         //throw new Error(error);
       }
    }.bind(this));
    //callback(null,0);
  } // end function getStatusBatteryAPI

  /*
  The method return the battery level stored inside the class instance.
  No request to API
  */
  getBatteryLevel(callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getBatteryLevel", this.debugContext);

    callback(null,this.batteryLevel);
  } // end method getBatteryLevel


  /*
  Return the lastValue or update it if needed
  */
  getOn(callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOn", this.debugContext);

    var error = null;

    /* Limit to only one get during box response */
    if(this.getOnOngoing == true){
      this.debug && this.log.warn("[ZIPAC] [getOn] Already getOn process launched. Maybe lower the refresh. Return last value", this.debugContext);
      // callback(null,this.lastValue);
      // return;
    }else{
      //this.getOnOngoing = true;
    }

    /* Manage the timer for reconnection */
    var needApiResquest = false;
    var now = new Date().getTime();
    if(this.useCache && !this.getOnOngoing){
      if(this.getTimer == undefined){ // First launch > initiate the timer
        this.getTimer = now;
        this.debug && this.log("[ZIPAC] [getOn] New getTimer initate :",this.getTimer,this.debugContext);
        needApiResquest = true;
      }else{
        var timeDown = Math.floor(((now - this.getTimer) % (1000 * 60)) / (1000)) + 1; // seconds
        this.debug && this.log("[ZIPAC] [getOn] Time since last get (s) :",timeDown,this.debugContext);
        if(timeDown >= this.timePolling / (1000) - 1){
          needApiResquest = true;
          this.debug && this.log("[ZIPAC] [getOn] Time since last get too long, need refresh :",timeDown,this.debugContext);
          this.getTimer = now;
        }else{
          this.debug && this.log("[ZIPAC] [getOn] No refresh needed. Use cached value :",timeDown,this.debugContext);
        }
      }
    } // End if useCache

    /* Get level based on cache or request the value */
    // Firstly use Cache for quick request or no use of API
    if(this.getOnOngoing || (!needApiResquest && this.useCache)){ // useCache without reconnection needed
      this.debug && this.log("[ZIPAC] [getOn] Using cache. Return cached value", this.lastValue, this.debugContext);
      this.getOnOngoing = false;
      callback(null, this.lastValue);
    // no cache use or reconnection needed
    }else{
      this.getOnOngoing = true;
      this.getOnAPI()
      .then(function sendCallBack(returnOfApi){
        this.getOnOngoing = false;
        this.debug && this.log("[ZIPAC] [getOn] Callback the new value",this.lastValue, this.debugContext);
        callback(null, this.lastValue);
      }.bind(this))
      .catch(function manageError(error){
        if(error == "Device not online"){
          this.debug && this.log.warn("[ZIPAC] [getOn] Callback error for device not online", this.debugContext);
          this.getOnOngoing = false;
          callback(false);
        }
      }.bind(this));
      // ICI AJOUTER UN CATCH DE NON CONNECTION
    }
  }

  /*
  getOnAPI is called when HomeKit wants to retrieve the current state of the characteristic
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  */
  getOnAPI(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOnAPI", this.debugContext);
    //this.debug && this.log("[ZIPAC] [getOn] device UUID and nostatus :",this.deviceUUID,this.noStatus,this.isOnG);+

    /* Before getting the value, we launch the battery check if needed */
    if(this.refreshCount >= 10 && this.batteryLimit > 0){
      this.debug && this.log("[ZIPAC] [getOnAPI] RefreshCount =",this.refreshCount, this.debugContext);
      this.refreshCount = 0;
      if(!this.isOnSector){
        if(!this.batteryBound){ // We already have it bound
          this.bindBatteryLowStatus();
        }
        this.debug && this.log("[ZIPAC] [getOnAPI] Getting the battery state",this.debugContext);
        this.basedService.getCharacteristic(Characteristic.StatusLowBattery).getValue();
        if(this.useEve){
          this.basedService.getCharacteristic(ZHBatteryPercentage).getValue();
        }
      }
    }else{
      this.refreshCount++;
    }

    var error = null;

    /* Debug for unhandled error */
    this.debug && this.log("[ZIPAC] [getOnAPI] Device UUID",this.deviceUUID,this.debugContext);

    /* Starting the get process */
    this.debug && this.log("[ZIPAC] [getOnAPI] Starting get process",this.debugContext);
    return this.getDeviceUUID()
    .then(function launchStatus(deviceUUID){
      return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus)
    }.bind(this))
    .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
      return this.reconnectAfterError(error);
    }.bind(this)) // end catch if disconnect
    .then(function manageStatus(deviceStatus){
      return new Promise(function(resolve,reject){
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
          var error = new Error("[ZIPAC] [getOnAPI] Coding error in getOn: returnedValue is not a boolean in reverseValue", this.debugContext);
          this.log.error(error);
          throw error;
        }else{
          if(returnedValue == true)
            returnedValue = false;
          else
            returnedValue = true;
        }
        this.debug && this.log("[ZIPAC] [getOnAPI] Configuration have request to reverse the value to :",returnedValue, this.debugContext)
      } // end reverse block

      /* Adapt the scale for lux sensor */
      if(this.type == "ambient"){ // returned from % to scale
        returnedValue = Math.round(this.min + returnedValue/100 * this.range);
      } // end if ambient

      /* Adapt the result for windows and doors */
      if(this.type == "window" || this.type == "door"){ // Window type, need to return a digit between 0 and 100 and not boolean
        //this.debug && this.log("[ZIPAC] [getOn] Window or Door found in get Method. returnedValue :",returnedValue)
        if(returnedValue)
         returnedValue = 100;
        else
         returnedValue = 0;
      } // end if window || door

      /* Adapt the value for a battery */
      if(this.type == "battery"){
        if(accessoryValue == undefined)
          this.log.error("[ZIPAC] [getOnAPI] Returned value for the battery level is undefined !", this.debugContext); // TODO add error manage
        else
          returnedValue = parseInt(accessoryValue);
      }
      /* Save the lastValue before give it to homebridge */
      this.lastValue = returnedValue;
      /* Save the backup value for a dimmer accessory */
      if(this.lastValue != 0)
        this.backupValue = this.lastValue;
      //this.getOnOngoing = false;
      // callback(error,returnedValue);
      return returnedValue;
    }.bind(this))
    .catch(function manageError(error){
      /* getOnOngoing true error */
      if(error == "getOnOngoing"){
        this.debug && this.log.warn("[ZIPAC] [getOnAPI] New get Request before get the previously one. By-passed. Reduce the refresh rate to avoir this.", this.debugContext);
        //this.getOnOngoing = false;
        // callback(null,this.lastValue);
        return this.lastValue;
      }else if(error == "Device not online"){
        this.debug && this.log.warn("[ZIPAC] [getOnAPI] Found that the device is not online.", this.debugContext);
        this.log.error("[ZIPAC] [getOnAPI] Device is not online.",this.debugContext);
        throw error;
      }else{
        //this.log("Test Value in manage Error : ",deviceStatus);
        this.log.error("[ZIPAC] [getOnAPI] Error on getOn :",error, this.debugContext);
        //this.getOnOngoing = false;
        // callback(error,undefined);
        return this.lastValue;
         //throw new Error(error);
      }
    }.bind(this));
  } // end getOn function

  /*
  getOnB for accessory with two uuid
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  For the getB method we do not check the reaching possibility of the device
  */
  getOnB (callback) {
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnB', this.debugContext);

    /* Shortcut out for outlet */
    if(this.type == "outlet"){
      if(this.uuidb == null){
        this.debug && this.log("[ZIPAC] [getOnB] No uuidb configured. Return last value",this.lastValue, this.debugContext);
        callback(null, this.lastValue);
        return;
      }
    }

    var error = null;
    this.zipabox.getAttributesValue(this.uuidb)
    .then(function (accessoryValue){
       this.debug && this.log("[ZIPAC] [getOnB] Accessory Value returned by callback B:",accessoryValue, this.debugContext);
       var returnedValue = accessoryValue;
       /* BATTERY */
       if(this.type == "battery"){
         this.debug && this.log("[ZIPAC] [getOnB] Battery to manage in getOnB. returnedValue :",returnedValue, this.debugContext);
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
       /* OUTLET */
       if(this.type == "outlet"){
         this.debug && this.log("[ZIPAC] [getOnB] Outlet to manage in getOnB. returnedValue :",returnedValue, this.debugContext);
         if(parseInt(accessoryValue) <= 0.1){
           returnedValue = false;
         }else{
           returnedValue = true;
         }
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
        error = "[ZIPAC] [getOnLast] Method request without a value set. Retry later."
        this.log.warn(error, this.debugContext);
      }
      callback(error, this.lastValue);
    }.bind(this));
  } // end getOnLast

  /*
  getOnRange get true if value is not 0
  */
  getOnRange(callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOnRange", this.debugContext);

    if(this.lastValue == 0){
      this.debug && this.log("[ZIPAC] [getOnRange] Return false range is zero", this.debugContext);
      callback(null,false);
    }else {
      this.debug && this.log("[ZIPAC] [getOnRange] Return true range is not zero", this.debugContext);
      callback(null,true);
    }
  }

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
    var valueToPut = value;
    /* Manage reverse value */
    if(this.reverseValue){
      if(typeof(value) == "boolean"){
        valueToPut = !value;
      }else{
        if(value == "true"){
          valueToPut = "false";
        }else if(value == "false"){
          valueToPut = "true";
        }else{
          this.log.error("[ZIPAC] [setOn] Impossible to reverse a non boolean value, please check config.json", this.debugContext);
        }
      }
    }
    /* Send the request */
    this.zipabox.putAttributesValue(this.uuid,valueToPut)
    .then(function launchCallBack(resp){
      this.lastValue = value;
      /* Update backup value for the last set for dimmer accessory */
      if(this.lastValue != 0 && this.type == "dimmer")
        this.backupValue = this.lastValue;
      callback(resp);
    }.bind(this))
    .catch(function manageError(error) {
      throw new Error(error);
      callback(error);
    });
  } // end setOn function

  /*
  setOnRange set value to 0 or 100 based on the status requested
  */
  setOnRange(value, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method setOnRange", value, this.debugContext);

    if(value){
      this.setOn(this.backupValue, callback);
    }else{
      this.setOn(0,callback);
    }
  }

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
       .then(function manageTampered(securityDrawState){
         if(securityDrawState >= 10){ // TAMPERED
           this.isTampered = 1;
           this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusTampered).getValue();
           return securityDrawState-10;
         }else{ // NOT TAMPERED
           this.isTampered = 0;
           return securityDrawState;
         }
       }.bind(this))
       .then(function manageCallback(securityFinalState){
         this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusFault).getValue();
         callback(error,securityFinalState);
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
    this.debug && this.log('[ZIPAC] > Method setOnSecurity', value, this.debugContext);

    this.reconnectSecurity()
    .then(function launchPut(notUsedReturn){
      this.debug && this.log("[ZIPAC] [setOnSecurity] Launch putSecurity", this.debugContext);
      return this.zipabox.putSecuritySystem(this.uuid,value);
    }.bind(this))
    .then(function checkIfTrue(putBooleanResponse){
      this.debug && this.log("[ZIPAC] [setOnSecurity] return of putBooleanResponse :",putBooleanResponse, this.debugContext);
      this.debug && this.log("[ZIPAC] [setOnSecurity] type of putBooleanResponse :",typeof(putBooleanResponse), this.debugContext);
      if(putBooleanResponse == false){ // The Box have return an issue in arming the Security System
        var error = new Error("[ZIPAC] [setOnSecurity] Alarm is not ready to arm. StatusFault set to false");
        this.statusFault = 1;
        this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.StatusFault).getValue();
        this.log.error(error);
        callback(error,undefined);
      }else{
        //if(this.timePolling == 0) // User has no request to check alarm refresh > force get Status after change TODO : do we need this additional test ?
        this.statusFault = 0;
        this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemCurrentState).getValue();
        if(value == 0 && this.nightMode){ // Set on Stay (=Home), but nightMode configured
          this.log.warn("[ZIPAC] [setOnSecurity] User set alarm on STAY / HOME but nightMode is on true. Force to NIGHT", this.debugContext)
          this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        }
        if(value == 2 && !this.nightMode){ // Set on Night, but nightMode configured
          this.log.warn("[ZIPAC] [setOnSecurity] User set alarm on NIGHT but nightMode is on false. Force to HOME.", this.debugContext)
          this.platformAccessory.getService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        }
        callback(null);
      }
    }.bind(this))
    .catch(function manageError(error) {
      this.log.error("[ZIPAC] [setOn] Undefined error :", error, this.debugContext);
      reject(error);
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
  getOnSecurityStatusTampered return if alarm is tripped with an TAMPER trip type
  If 1, Homebridge app wil specify that the accessory is tampered
  */
  getOnSecurityStatusTampered(callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnSecurityStatusTampered', this.debugContext);

    callback(null,this.isTampered);
  }// end getOnSecurityStatusTampered method

  /*
  This method must be called before putting a state in an alarm
  She calculate the time since the last put to ensure that the user is still connected
  If not the user will be reconnected
  return a Promise
  */
  reconnectSecurity(){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method reconnectSecurity', this.debugContext);

    /* Manage the timer for reconnection */
    var needReconnection = false;
    var now = new Date().getTime();
    if(this.alarmPutTimer == undefined){ // First launch > initiate the timer
      this.alarmPutTimer = now;
      this.debug && this.log("[ZIPAC] [reconnectSecurity] New timer initate :",this.alarmPutTimer);
      needReconnection = true;
    }else{
      var timeDown = Math.floor(((now - this.alarmPutTimer) % (1000 * 60 * 60)) / (1000 * 60));
      this.debug && this.log("[ZIPAC] [reconnectSecurity] Time since last put :",timeDown);
      if(timeDown >= 5){
        needReconnection = true;
        this.debug && this.log("[ZIPAC] [reconnectSecurity] Time since last connection too long, need reconnection :",timeDown);
        this.alarmPutTimer = now;
      }else{
        this.debug && this.log("[ZIPAC] [reconnectSecurity] No reconnection needed, go further. Time since last :",timeDown);
        // this.alarmPutTimer = now;
      }
    }

    /* Return the connection promise if needed, true if not */
    return new Promise(function(resolve,reject){
      if(needReconnection){
        resolve(this.zipabox.connectSecurity());
      }else{
        resolve(true);
      }
    }.bind(this)); // end Promise
  } // end reconnectSecurity

  /*
  reconnectAfterError is used in a catch promise if an error is occured.
  The method try to reconnect the plugin to the box to relaunch the last try
  */
  reconnectAfterError(error){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method reconnectAfterError for", error.message, this.debugContext);

    return new Promise(function(resolve, reject){
      if (error.message == "Unauthorized" || error.message == "Unauthorized " || error.message.substr(0,38) == "request to https://my3.zipato.com:443/" || error.message.substr(0,42) == "invalid json response body at https://my3."){ // || error.message == "Bad Request " > for test
        this.log.warn("[ZIPAC] [reconnectAfterError] Found Unauthorized error > need reconnection : ", "-"+ error.message + "-", this.debugContext);
        /* Try to reconnect the Box */
        return this.zipabox.connectUser()
        .then(this.zipabox.selectBox.bind(this.zipabox))
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
        // .then(function reconnectForSecurity(deviceUUIDorUUID){
        //   if(this.type == "alarm"){
        //     this.debug && this.log("[ZIPAC] [reconnectAfterError] Alarm need a reconnection.", this.debugContext)
        //     return this.zipabox.connectSecurity();
        //   }else{
        //     return deviceUUIDorUUID; // same for previous Promise without alarm
        //   }
        // }.bind(this))
        .then(function checkStatus(){
          this.debug && this.log("[ZIPAC] [reconnectAfterError] Reconnection success > get Device Status", this.debugContext);
          !this.debug && this.log("[ZIPAC] [reconnectAfterError] The plugin has reconnect successfully to the box");
          this.updatePolling();
          return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus);
        }.bind(this))
        .catch(function manageError(error){
           reject(error);
        }); // End Unauthorized error manage
      }else if(error == "getOnOngoing" || error.message == "getOnOngoing"){ // TODO check if still used after 1.4.0
        this.debug && this.log("[ZIPAC] [reconnectAfterError] Found getOnOngoing error. Return last value.", this.debugContext)
        resolve(this.lastValue); // TODO : check if it's working
      }else if(error.message == "Not Found" || error.message == "Not Found "){
        this.log.warn("[ZIPAC] [reconnectAfterError] No status found. You can try with noStatus = true. Plugin try to force it. If not working change config.");
        this.noStatus = true;
        this.deviceUUID = this.uuid;
        resolve(true);
      }else{ // Rethrow error that we can't manage here
        this.log.error("[ZIPAC] [reconnectAfterError] Found error but not manage :", error, error.message, this.debugContext);
        // this.log.error("[ZIPAC] [reconnectAfterError] Test :", "Not Found" == error.message);
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
    }.bind(this));
  } // end delay method

  /*
  getPlatformAccessory just return the platformAccessory stored in the zipAccesory
  */
  getPlatformAccessory(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getPlatformAccessory", this.debugContext);

    return this.platformAccessory;
  }

  /*
  isHidden() return true is accessory is hidden
  */
  isHidden(){
    return this.hidden;
  }

  /*
  checkType retur true is the type is configurable or not. False elsewhere
  */
  checkType(type){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method checkType", this.debugContext);

    var isOk = false;
    var okStrings = ["switch","light","dimmer","outlet","temperature","ambient","motion","contact","window","door","covering","leak","co2","battery","alarm"];

    for (var index = 0; index < okStrings.length; index++){
      if (type == okStrings[index]){
        isOk = true;
      }
    }
    this.debug && this.log("[ZIPAC] [checkType] Type is recognized :", type, isOk, this.debugContext);

    return isOk;
  }
} // End ZipAccessory Class

module.exports = ZipAccessory;
