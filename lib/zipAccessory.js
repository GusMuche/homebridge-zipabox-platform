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
  constructor(debug,log,zipabox,zAccessory,zService,zCharacteristic,accessoryJSON,uuidGen){
    /* Base variable initzialisation */
    this.debugPlatform = debug;
    this.log = log;
    this.zipabox = zipabox;
    this.platformAccessory = undefined;
    this.config = accessoryJSON;
    this.uuidGen = uuidGen; // uuid gen based on the first UUID
    Accessory = zAccessory;
    Service = zService;
    Characteristic = zCharacteristic;
    this.firstGet = true; // true for first launch, false after (avoid warning at startup)

    /* Devices information */
    this.deviceUUID = undefined;
    this.isOnSector = false;
    this.isActivated = true;
    this.deviceStatus = false;
    this.special = false;

    /* Services informations */
    this.services = [];
    this.servicesNames = []; //this.name + this.uuids[i];
    this.types = [];
    this.uuids = [];
    this.uuidbs = [];
    this.testValues = [];
    this.lastValues = [];
    this.reverseValues = [];
    this.nightModes = [];
    this.mins = [];
    this.maxs = [];
    this.ranges = [];
    this.nbServices = 0;
    this.backupValues = []; // for dimmer ???
    this.debugContextServices = [];

    /* Process value and information */
    this.getOnOngoing = false;

    /* Alarm options value */
    this.alarmPutTimer = undefined;
    this.getTimer = undefined;
    this.hasAlarm = false;
    this.statusFaults = [];
    this.isTampereds = [];

    /* Battery option */
    this.batteryBound = false; // tru if at least one service have the battery limit active
    this.batteryLevel = 100;
    this.firstBatteryRequest = true;

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

    /* LOAD CONFIG */

    this.name = this.config.name;
    this.firstType = this.config.services[0].type || undefined;
    if(this.firstType == undefined)
      this.log.error("[ZIPAC] Bad type inserted for the accessory", this.name, "Force to switch. Check config.json");
    this.firstType = "switch";
    this.debug = this.config.debug || false;
    this.debugContext = "[" + this.firstType + "/" + this.name + "]";
    if(this.debugPlatform || this.debug){
      this.debug = true;
      this.log.warn("[ZIPAC] Debug mode set for",this.debugContext);
    }

    /* New Accessory creation */
    this.platformAccessory = new Accessory(this.name,this.uuidGen);

    /* Add the config */
    this.configAccessory(this.config);

    /* Create all services */
    this.addServices(this.config.services);

    /* Bind all characteristics to the services */
    this.bindAllCharacteristics();

    /* Mark accessory as reachable */
    this.updateReachability(true);
  } // end constructor of ZipAccessory Class



  /*
  configAccessory check the config to validate all parameters
  and save it to the instanced accessory
  */
  configAccessory(config){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method configAccessory", this.debugContext);

    /* Accessory Informations */
    this.manufacturer = config["manufacturer"] || "zipato";
    this.model = config["model"] || "zipato";
    this.serial = config["serial"] || "zipato";

    /* Optional noStatus to avoid device request */
    this.noStatus = config["noStatus"] || false;
    if(this.noStatus != false && this.noStatus != true){
      this.debug && this.log("[ZIPAC] [configAccessory] Configuration error : noStatus fixed to false", this.debugContext);
      this.noStatus = false;
    }

    /* Optional Battery Limit */
    this.batteryLimit = config["batteryLimit"] || 0;
    if(this.batteryLimit > 100 || this.batteryLimit < 0){
      this.log.warn("[ZIPAC] [configAccessory] Configuration error : batteryLimit fixed to 0.", this.debugContext);
      this.batteryLimit = 0;
    }

    /* Custom Characteristic */
    this.useEve = config["useEve"] || false;
    if(this.useEve != true && this.useEve != false){
      this.log.warn("[ZIPAC] [configAccessory] Configuration error. Parameter useEve must be true or false. Forced to false", this.debugContext);
      this.useEve = false;
    }

    /* Optional hidden */
    this.hidden = config["hidden"] || false;
    if(this.hidden != true && this.hidden != false){
      this.log.warn("[ZIPAC] [configAccessory] Configuration error. Parameter hidden must be true or false. Forced to false", this.debugContext);
      this.hidden = false;
    }
  }


  /*
  addServices create all services based on a array of characteristics
  services : [
    {
      "type" : "xxx",
      "uuid" : "xxx",
      "uuidb" : xxx",
      "testValue" : 0,
      "reverseValue" : true,
      "nightMode" : true,
      "min" : 0,
      "max" : 0,
    }
  ]
  */
  addServices(services){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method addServices", this.debugContext);

    /* Base Information, Service AccessoryInformation */
    this.platformAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

    for (var i in services){
      /* DEBUG */
      this.debug && this.log("[ZIPAC] [addServices] Add next accessory", services[i].type, services[i].uuid, this.debugContext);
      this.servicesNames[i] = this.name + "-" + i;

      /* Type of the service */
      this.types[i] = services[i].type;
      if(!this.checkType(this.types[i])){
        this.log.error("[ZIPAC] [addServices] Bad types specified for accessory", this.name, this.types[i], this.debugContext, "Types set to switch");
        this.types[i] = "switch";
      }
      this.debugContextServices[i] = "[" + this.name  + "/" + this.types[i] + "]";

      if(this.types[i] == "door" || this.types[i] == "window" || this.types[i] == "switch"
      || this.types[i] == "light" || this.types[i] == "outlet" || this.noStatus)
        this.isOnSector = true;
      if(this.types[i] == "alarm"){
        this.hasAlarm = true;
        this.statusFaults[i] = 0;
        /* StatusFault option :
        NO_FAULT = 0;
        GENERAL_FAULT = 1;*/
        this.isTampereds[i] = 0;
      }else{
        this.statusFaults[i] = -1;
        this.isTampereds[i] = -1;
      }

      /* UUID's of the service */
      this.uuids[i] = services[i].uuid || null;
      if(this.uuids[i] == null)
        this.log.warn("[ZIPAC] [addServices] No uuid parameter find for the accessory. Please check config.json", services[i].type, services[i].UUID, this.debugContextServices[i]);
      this.uuidbs[i] = services[i].uuidb || null;
      if(this.uuidbs[i] != null)
        this.debug && this.log("[ZIPAC] [addServices] A second UUID was added:",this.uuidbs[i], this.debugContextServices[i])
      if(this.type == "battery" && this.uuidb == null)
        this.log.error("[ZIPAC] [addServices] No uuidb specified for the battery accessory : please check config.json.", this.debugContextServices[i]);

      /* NoStatus particularity */
      if(this.types[i] == "alarm")
        this.noStatus = true;

      /* Optional Test Value */
      this.testValues[i] = services[i].testValue || null;
      if(this.testValues[i] != null)
        this.log.warn("[ZIPAC] [addServices] Test value fixed by user at ", this.testValue, this.debugContextServices[i]);

      /* Optional reverse Value */
      this.reverseValues[i] = services[i].reverse || false;
      if(this.reverseValues[i] != false && this.reverseValues[i] != true){
        this.log.warn("[ZIPAC] [addServices] WARNING : Configuration error : reverse fixed to false.", this.debugContextServices[i]);
        this.reverseValues[i] = false;
      }
      if(this.types[i] == "alarm")
        this.reverseValues[i] = false;

      /* Optional nightMode alarm */
      this.nightModes[i] = services[i].nightMode || false;
      if(this.nightModes[i] != false && this.nightModes[i] != true){
        this.log.warn("[ZIPAC] [addServices] Configuration error : nightMode fixed to false", this.debugContextServices[i]);
        this.nightModes[i] = false;
      }

      /* Optional min/max values */
      this.mins[i] = services[i].min || 0;
      this.maxs[i] = services[i].max || 100;
      if(typeof(this.mins[i]) == "string")
        this.mins[i] = parseInt(this.mins[i]);
      if(typeof(this.maxs[i]) == "string")
        this.maxs[i] = parseInt(this.maxs[i]);
      this.ranges[i] = this.maxs[i]-this.mins[i];

      /* Optional special buttons */
      if(this.uuids[i] == "disconnectBox"){
        this.log.warn("[ZIPAC] [addServices] Special type ask by the user : Disconnect box button", this.debugContextServices[i]);
        this.noStatus = true;
        this.types[i] = "switch";
        this.isOnSector = true;
        this.special = true;
      }
      if(this.uuids[i] == "rebootBox"){
        this.log.warn("[ZIPAC] [addServices] Special type ask by the user : Reboot box button", this.debugContextServices[i]);
        this.noStatus = true;
        this.types[i] = "switch";
        this.isOnSector = true;
        this.special = true;
      }
      if(this.uuids[i]== "rebootHomebridge"){
        this.log.warn("[ZIPAC] [addServices] Special type ask by the user : Reboot Homebridge button", this.debugContextServices[i]);
        this.noStatus = true;
        this.types[i] = "switch";
        this.isOnSector = true;
        this.special = true;
      }

      var service;
      switch(this.types[i]){
        case "switch":
          this.debug && this.log("[ZIPAC] [addServices] Add a Switch service", this.debugContextServices[i]);
          service = new Service.Switch(this.servicesNames[i]);
          break;
        case "light":
          this.debug && this.log("[ZIPAC] [addServices] Add a LightBulb service", this.debugContextServices[i]);
          service = new Service.Lightbulb(this.servicesNames[i]);
          break;
        case "dimmer":
          this.debug && this.log("[ZIPAC] [addServices] Add a Dimmer service", this.debugContextServices[i]);
          service = new Service.Lightbulb(this.servicesNames[i]);
          break;
        case "outlet":
          this.debug && this.log("[ZIPAC] [addServices] Add a Outlet service", this.debugContextServices[i]);
          service = new Service.Outlet(this.servicesNames[i]);
          break;
        case "temperature":
          this.debug && this.log("[ZIPAC] [addServices] Add a Temperature Sensor service", this.debugContextServices[i]);
          service = new Service.TemperatureSensor(this.servicesNames[i]);
          break;
        case "ambient":
          this.debug && this.log("[ZIPAC] [addServices] Add a Light Sensor service", this.debugContextServices[i]);
          service = new Service.LightSensor(this.servicesNames[i]);
          break;
        case "motion":
          this.debug && this.log("[ZIPAC] [addServices] Add a Motion Sensor service", this.debugContextServices[i]);
          service = new Service.MotionSensor(this.servicesNames[i]);
          break;
        case "contact":
          this.debug && this.log("[ZIPAC] [addServices] Add a Contact Sensor service", this.debugContextServices[i]);
          service = new Service.ContactSensor(this.servicesNames[i]);
          break;
        case "window":
          this.debug && this.log("[ZIPAC] [addServices] Add a Window service", this.debugContextServices[i]);
          service = new Service.Window(this.servicesNames[i]);
          break;
        case "door":
          this.debug && this.log("[ZIPAC] [addServices] Add a Door service", this.debugContextServices[i]);
          service =  new Service.Door(this.servicesNames[i]);
          break;
        case "covering":
          this.debug && this.log("[ZIPAC] [addServices] Add a Window Covering service", this.debugContextServices[i]);
          service =  new Service.WindowCovering(this.servicesNames[i]);
          break;
        case "leak":
          this.debug && this.log("[ZIPAC] [addServices] Add a Leak Sensor service", this.debugContextServices[i]);
          service = new Service.LeakSensor(this.servicesNames[i]);
          break;
        case "co2":
          this.debug && this.log("[ZIPAC] [addServices] Add a Carbon Monoxide Sensor service", this.debugContextServices[i]);
          service = new Service.CarbonMonoxideSensor(this.servicesNames[i]);
          break;
        case "battery":
          this.debug && this.log("[ZIPAC] [addServices] Add a Battery service", this.debugContextServices[i]);
          service = new Service.BatteryService(this.servicesNames[i]);
          break;
        case "alarm":
          this.debug && this.log("[ZIPAC] [addServices] Add a Security System service", this.debugContextServices[i]);
          service = new Service.SecuritySystem(this.servicesNames[i]);
          break;
        default:
          this.log.warn("[ZIPAC] [addServices] Add a default Switch service - Check your configuration.", this.debugContextServices[i]);
          service = new Service.Switch(this.servicesNames[i]);
      } // end switch types
      this.platformAccessory.addService(service,this.servicesNames[i],this.uuids[i]);
      this.services[i] = service;
      this.nbServices++;
    } // end for services[i]

    /* Prevent for special accessories */
    if(this.special && this.nbServices > 1){
      this.log.error("[ZIPAC] [addServices] Avoid multiples services with special button. Only one. Check your configuration.", this.debugContext);
    }
  } // end addServices()


  /*
  bindAllCharacteristics loop inside the services to add the corresponding characteristics
  */
  bindAllCharacteristics(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method bindAllCharacteristics", this.debugContext);

    /* LOOP through the services of the accessory */
    for (var i in this.services){
      this.bindCharacteristic(i,this.types[i],this.uuids[i],this.servicesNames[i]);
      /* Link the battery Limit if specified */
      if(this.batteryLimit > 0){
        this.bindBatteryLowStatus(i,this.types[i]);
      }
    }

    /* Link the 'identify' event */
    this.platformAccessory.on('identify', function(paired, callback) {
      this.identifyZipAccessory();
      //callback(null);
    }.bind(this));
  }

  /*
  bindCharacteristic return the same accessory with the service needed
  'get' is called when HomeKit wants to retrieve the current state of the characteristic
  'set' is called when HomeKit wants to update the value of the characteristic
  If use after cache reload, fromCache must be true to recreate the based service
  */
  bindCharacteristic(index,type,uuid,serviceName){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method bindCharacteristic", this.debugContextServices[index]);
    this.debug && this.log("[ZIPAC] [bindCharacteristic] index", index, this.debugContextServices[index]);
    this.debug && this.log("[ZIPAC] [bindCharacteristic] type", type, this.debugContextServices[index]);
    this.debug && this.log("[ZIPAC] [bindCharacteristic] uuid", uuid, this.debugContextServices[index]);
    this.debug && this.log("[ZIPAC] [bindCharacteristic] serviceName", serviceName, this.debugContextServices[index]);

    /* Attach the correct service based on the type of accessory */
    switch(type){
      case "switch":
        /* Manage the special switchs */
        if(uuid=="disconnectBox" || uuid=="rebootBox" || uuid=="rebootHomebridge"){
          this.platformAccessory.getService(serviceName)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getSpecial.bind(this))
            .on('set', function(value, callback){this.setSpecial(index, value, callback);}.bind(this));
        }else{
          /* And a normal switch */
          this.platformAccessory.getService(serviceName)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
            .on('set', function(value, callback){this.setOn(index, value, callback);}.bind(this));
        }
        break;
      case "light":
        this.platformAccessory.getService(serviceName)
          .getCharacteristic(Characteristic.On)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
          .on('set', function(value, callback){this.setOn(index, value, callback);}.bind(this));
        break;
      case "dimmer":
        this.platformAccessory.getService(serviceName)
          .getCharacteristic(Characteristic.On)
          .on('get', function(callback){this.getOnRange(index, callback);}.bind(this))
          .on('set', function(value, callback){this.setOnRange(index, value, callback);}.bind(this));
        this.platformAccessory.getService(serviceName)
          .getCharacteristic(Characteristic.Brightness)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
          .on('set', function(value, callback){this.setOn(index, value, callback);}.bind(this));
        break;
      case "outlet":
        this.platformAccessory.getService(serviceName)
          .getCharacteristic(Characteristic.On)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
          .on('set', function(value, callback){this.setOn(index, value, callback);}.bind(this));
        this.platformAccessory.getService(serviceName)
          .getCharacteristic(Characteristic.OutletInUse)
          .on('get', function(callback){this.getOnB(index, callback);}.bind(this));
        break;
      case "temperature":
        this.platformAccessory.getService(serviceName) // Service.TemperatureSensor
          .getCharacteristic(Characteristic.CurrentTemperature)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
        break;
      case "ambient":
        this.platformAccessory.getService(serviceName) //Service.LightSensor
          .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
        break;
      case "motion":
        this.platformAccessory.getService(serviceName) // Service.MotionSensor
          .getCharacteristic(Characteristic.MotionDetected)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
        break;
      case "contact":
        this.platformAccessory.getService(serviceName) // Service.ContactSensor
          .getCharacteristic(Characteristic.ContactSensorState)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this))
        break;
      case "window": // at here to test
        this.platformAccessory.getService(serviceName) // Service.Window)
          .getCharacteristic(Characteristic.CurrentPosition)
          .on('get', this.getOn(uuid).bind(this));
          //.on('set', this.setOn.bind(this));
        this.platformAccessory.getService(serviceName) // Service.Window)
          .getCharacteristic(Characteristic.TargetPosition)
          .on('get', this.getOnLast(uuid).bind(this))
          .on('set', this.setOn(uuid).bind(this));
        this.platformAccessory.getService(serviceName) // Service.Window)
          .getCharacteristic(Characteristic.PositionState)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        this.platformAccessory.getService(serviceName) // Service.Window)
          .getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        break;
      case "door":
        this.platformAccessory.getService(serviceName) // Service.Door
          .getCharacteristic(Characteristic.CurrentPosition)
          .on('get', this.getOn(uuid).bind(this));
          //.on('set', this.setOn.bind(this));
        this.platformAccessory.getService(serviceName) // Service.Door
          .getCharacteristic(Characteristic.TargetPosition)
          .on('get', this.getOnLast(uuid).bind(this))
          .on('set', this.setOn(uuid).bind(this));
        this.platformAccessory.getService(serviceName) // Service.Door
          .getCharacteristic(Characteristic.PositionState)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        this.platformAccessory.getService(serviceName) // Service.Door
          .getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        break;
      case "covering":
        this.platformAccessory.getService(serviceName) // Service.WindowCovering
          .getCharacteristic(Characteristic.CurrentPosition)
          .on('get', this.getOn(uuid).bind(this));
          //.on('set', this.setOn.bind(this));
        this.platformAccessory.getService(serviceName) // Service.WindowCovering
          .getCharacteristic(Characteristic.TargetPosition)
          .on('get', this.getOnLast(uuid).bind(this))
          .on('set', this.setOn(uuid).bind(this));
        this.platformAccessory.getService(serviceName) // Service.WindowCovering
          .getCharacteristic(Characteristic.PositionState)
          .on('set', function(value,callback){callback(null);}) // Always return ok TODO : change for movement
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        this.platformAccessory.getService(serviceName) // Service.WindowCovering
          .getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        break;
      case "leak":
        this.platformAccessory.getService(serviceName) // Service.LeakSensor
          .getCharacteristic(Characteristic.LeakDetected)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this));
        break;
      case "co2":
        this.platformAccessory.getService(serviceName) // Service.CarbonMonoxideSensor
          .getCharacteristic(Characteristic.CarbonMonoxideDetected)
          .on('get', function(callback){this.getCharacteristicValue(index, callback);}.bind(this));
        break;
      case "battery":
        this.platformAccessory.getService(serviceName) // Service.BatteryService
          .getCharacteristic(Characteristic.BatteryLevel)
          .on('get', this.getOn(uuid).bind(this));
        this.platformAccessory.getService(serviceName) // Service.BatteryService
          .getCharacteristic(Characteristic.ChargingState)
          .on('get', this.getOnB(uuid).bind(this));
        break;
      case "alarm":
        this.platformAccessory.getService(serviceName) // Service.SecuritySystem
          .getCharacteristic(Characteristic.SecuritySystemCurrentState)
          .on('get', this.getOnSecurity(uuid).bind(this));
        this.platformAccessory.getService(serviceName) // Service.SecuritySystem
          .getCharacteristic(Characteristic.SecuritySystemTargetState)
          .on('set', this.setOnSecurity(uuid).bind(this))
          .on('get', this.getOnSecurity(uuid).bind(this));
        this.platformAccessory.getService(serviceName) // Service.SecuritySystem
          .getCharacteristic(Characteristic.StatusFault)
          .on('get', function(callback){this.getOnSecurityStatusFault(index, callback);}.bind(this));
        this.platformAccessory.getService(serviceName) // Service.SecuritySystem
          .getCharacteristic(Characteristic.StatusTampered)
          .on('get', function(callback){this.getOnSecurityStatusTampered(index, callback);}.bind(this));
        break;
      default:
        this.platformAccessory.getService(serviceName) // Service.Switch
          .getCharacteristic(Characteristic.On)
          .on('get', this.getOn(uuid).bind(this))
          .on('set', this.setOn(uuid).bind(this));
    } // end switch
  } // end bindCharacteristic function

  /*
  identifyZipAccessory is called when the user ask to identify the accessory
  */
  identifyZipAccessory(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method identifyZipAccessory", this.debugContext);

    /* Logging the accessory information */
    this.log.warn(this.debugContext,"------ Start Identify ------");
    this.log.warn(this.debugContext,"Name :",this.name);
    this.log.warn(this.debugContext,"Serial :",this.serial);
    this.log.warn(this.debugContext,"Manufacturer :",this.manufacturer);
    this.log.warn(this.debugContext,"Model :",this.model);
    this.log.warn(this.debugContext,"Device uuid :",this.deviceUUID);
    this.log.warn(this.debugContext,"Homebridge uuid :",this.uuidGen);
    this.log.warn(this.debugContext,"noStatus ? :",this.noStatus);
    this.log.warn(this.debugContext,"isOnSector ? :",this.isOnSector);
    this.log.warn(this.debugContext,"Battery Level :",this.batteryLevel);
    this.log.warn(this.debugContext,"Battery Limit :",this.batteryLimit);
    this.log.warn(this.debugContext,"Use Eve ? :",this.useEve);
    this.log.warn(this.debugContext,"Hidden ? :",this.hidden);
    this.log.warn(this.debugContext,"------ End Identify ------");
  }


  /*
  Function to add a battery low status for some accessory
  This will add the StatusLowBattery characteristic to the base service
  */
  bindBatteryLowStatus(index,type){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method bindBatteryLowStatus index", index, this.debugContext);

    /* Check for correct type */
    if (type != "battery" && type != "co2" && type != "contact" && type != "leak" && type != "light" && type != "motion" && type != "temperature")
      return;

    /* Bound the Get function */
    this.batteryBound = true;
    this.services[index].getCharacteristic(Characteristic.StatusLowBattery) // Normal = 0, Low = 1
      .on('get', this.getStatusBattery.bind(this));

    /* Bound the battery percentage function */
    if(this.useEve){
      if(this.services[index].testCharacteristic(ZHBatteryPercentage)){ // Only need an update
        this.services[index].getCharacteristic(ZHBatteryPercentage)
          .on('get', this.getBatteryLevel.bind(this));
      }else{
        this.services[index].addCharacteristic(ZHBatteryPercentage); // Need to add
        this.services[index].getCharacteristic(ZHBatteryPercentage)
          .on('get', this.getBatteryLevel.bind(this));
      }
    }
  } // end bindBatteryLowStatus

  /*
  allDirectGet loop through all services and launch get method
  */
  allDirectGet(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method allDirectGet", index, this.debugContext);

    /* LOOP through the services of the accessory */
    for (var i in this.services){
      this.directGet(i);
    }
  }

  /*
  directGet launch the get method to refresh the value of the accessory
  depend of his type
  */
  directGet(index){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method directGet", index, this.debugContext);

    /* Desactivation status */
    if(this.isActivated == false)
      return;

    /* Check index */
    if(index < 0 || index >= this.nbServices){
      this.log.error("[ZIPAC] [directGet] Bad index request :", index, this.debugContext);
      return;
    }
    /* get the information */
    var type = this.types[index];
    var service = this.services[index];

    switch(type){
      case "switch":
        service.getCharacteristic(Characteristic.On).getValue();
        break;
      case "light":
        service.getCharacteristic(Characteristic.On).getValue();
        break;
      case "dimmer":
        service.getCharacteristic(Characteristic.On).getValue();
        service.getCharacteristic(Characteristic.Brightness).getValue();
        break;
      case "outlet":
        service.getCharacteristic(Characteristic.On).getValue();
        service.getCharacteristic(Characteristic.OutletInUse).getValue();
        break;
      case "temperature":
        service.getCharacteristic(Characteristic.CurrentTemperature).getValue();
        break;
      case "ambient":
        service.getCharacteristic(Characteristic.CurrentAmbientLightLevel).getValue();
        break;
      case "motion":
        service.getCharacteristic(Characteristic.MotionDetected).getValue();
        break;
      case "contact":
        service.getCharacteristic(Characteristic.ContactSensorState).getValue();
        break;
      case "window":
        service.getCharacteristic(Characteristic.CurrentPosition).getValue();
        service.getCharacteristic(Characteristic.TargetPosition).getValue();
        service.getCharacteristic(Characteristic.PositionState)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        service.getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        break;
      case "door":
        service.getCharacteristic(Characteristic.CurrentPosition).getValue();
        service.getCharacteristic(Characteristic.TargetPosition).getValue();
        service.getCharacteristic(Characteristic.PositionState)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
        service.getCharacteristic(Characteristic.HoldPosition)
          .on('set', function(value,callback){callback(null);}) // Always return ok
          .on('get', function(callback){callback(null,false);}); // Always return false = free
        break;
      case "covering":
        service.getCharacteristic(Characteristic.CurrentPosition).getValue();
        service.getCharacteristic(Characteristic.TargetPosition).getValue();
        service.getCharacteristic(Characteristic.PositionState).getValue();
        service.getCharacteristic(Characteristic.HoldPosition).getValue();
        break;
      case "leak":
        service.getCharacteristic(Characteristic.LeakDetected).getValue();
        break;
      case "co2":
        service.getCharacteristic(Characteristic.CarbonMonoxideDetected).getValue();
        break;
      case "battery":
        service.getCharacteristic(Characteristic.BatteryLevel).getValue();
        service.getCharacteristic(Characteristic.ChargingState).getValue();
        break;
      case "alarm":
        service.getCharacteristic(Characteristic.SecuritySystemCurrentState).getValue();
        service.getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
        service.getCharacteristic(Characteristic.StatusFault).getValue();
        service.getCharacteristic(Characteristic.StatusTampered).getValue();
        break;
      default:
        this.log.error("[ZIPAC] [directGet] No type found for", type);
    } // end switch
  } // end function directGet

  /*
  directUpdate update the value in homebridge with updateCharacteristic method
  */
  directUpdate(index,value){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method directUpdate", index, value, this.debugContext);

    /* Desactivation status */
    if(this.isActivated == false)
      return;

    /* Check index */
    if(index < 0 || index >= this.nbServices){
      this.log.error("[ZIPAC] [directUpdate] Bad index request :", index, this.debugContext);
      return;
    }
    /* get the information */
    var type = this.types[index];
    var service = this.services[index];

    switch(type){
      case "switch":
        service.updateCharacteristic(Characteristic.On, value);
        break;
      case "light":
        service.updateCharacteristic(Characteristic.On, value);
        break;
      case "dimmer":
        service.updateCharacteristic(Characteristic.On, value==0);
        service.updateCharacteristic(Characteristic.Brightness, value);
        break;
      case "outlet":
        service.updateCharacteristic(Characteristic.On, value);
        service.updateCharacteristic(Characteristic.OutletInUse, value);
        break;
      case "temperature":
        service.updateCharacteristic(Characteristic.CurrentTemperature, value);
        break;
      case "ambient":
        service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, value);
        break;
      case "motion":
        service.updateCharacteristic(Characteristic.MotionDetected, value);
        break;
      case "contact":
        service.updateCharacteristic(Characteristic.ContactSensorState, value);
        break;
      // case "window":
      //   service.updateCharacteristic(Characteristic.CurrentPosition).getValue();
      //   service.updateCharacteristic(Characteristic.TargetPosition).getValue();
      //   service.getCharacteristic(Characteristic.PositionState)
      //     .on('set', function(value,callback){callback(null);}) // Always return ok
      //     .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
      //   service.getCharacteristic(Characteristic.HoldPosition)
      //     .on('set', function(value,callback){callback(null);}) // Always return ok
      //     .on('get', function(callback){callback(null,false);}); // Always return false = free
      //   break;
      // case "door":
      //   service.getCharacteristic(Characteristic.CurrentPosition).getValue();
      //   service.getCharacteristic(Characteristic.TargetPosition).getValue();
      //   service.getCharacteristic(Characteristic.PositionState)
      //     .on('set', function(value,callback){callback(null);}) // Always return ok
      //     .on('get', function(callback){callback(null,2);}); // Always return 2 = stopped
      //   service.getCharacteristic(Characteristic.HoldPosition)
      //     .on('set', function(value,callback){callback(null);}) // Always return ok
      //     .on('get', function(callback){callback(null,false);}); // Always return false = free
      //   break;
      // case "covering":
      //   service.getCharacteristic(Characteristic.CurrentPosition).getValue();
      //   service.getCharacteristic(Characteristic.TargetPosition).getValue();
      //   service.getCharacteristic(Characteristic.PositionState).getValue();
      //   service.getCharacteristic(Characteristic.HoldPosition).getValue();
      //   break;
      case "leak":
        service.updateCharacteristic(Characteristic.LeakDetected, value);
        break;
      case "co2":
        service.updateCharacteristic(Characteristic.CarbonMonoxideDetected, value);
        break;
      // case "battery":
      //   service.getCharacteristic(Characteristic.BatteryLevel).getValue();
      //   service.getCharacteristic(Characteristic.ChargingState).getValue();
      //   break;
      // case "alarm":
      //   service.getCharacteristic(Characteristic.SecuritySystemCurrentState).getValue();
      //   service.getCharacteristic(Characteristic.SecuritySystemTargetState).getValue();
      //   service.getCharacteristic(Characteristic.StatusFault).getValue();
      //   service.getCharacteristic(Characteristic.StatusTampered).getValue();
      //   break;
      default:
        this.log.error("[ZIPAC] [directGet] No type found for", type);
    } // end switch
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
  } // end function updateReachability

  /*
  desactivate is used to set the status of the instance to "delete"
  opposite method didnt exist
  */
  desactivate(){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method desactivate", this.debugContext);

    this.isActivated = false;
  } // end desactivate method

  /*
  isSpecial return true for special accessories
  */
  isSpecial(){
    return this.special;
  }

  /*
  isAlarm return true if one alarm service is configured
  false elsewhere
  */
  isAlarm(){
    return this.hasAlarm;
  }

  /*
  getUUID is a shortcut to have the context.uuid
  */
  getUUID(){
    return this.platformAccessory.UUID;
  } // end function getUUID

  /*
  getUUIDs is a shortcut to have the uuid of the attributes
  */
  getUUIDs(){
    return this.uuids;
  } // end function getUUIDs

  /*
  Return if noStatus
  */
  getNoStatus(){
    return this.noStatus;
  }

  /*
  Return device Status central version
  */
  getCentralDeviceStatus(){
    return this.deviceStatus;
  }

  /*
  Return the debug context to be used at Platform Level
  */
  getDebugContext(){
    return this.debugContext;
  }

  /*
  Return types of accessory
  */
  getTypes(){
    return this.types;
  }

  /*
  Return the type of the attribute with the parameter UUID
  */
  getType(attributeUUID){
    var typeToReturn = null;
    for (var i in this.uuids){
      if(this.uuids[i] == attributeUUID)
        typeToReturn = this.types[i];
    }
    return typeToReturn;
  }

  /*
  Used to set the status of a device from the central refresh
  */
  setCentralDeviceStatus(status){
    if(status != true && status != false){
      throw new Error("Incorrect state of status to set. Must be boolean");
    }else{
      if(this.noStatus == true){
        this.deviceStatus = true;
      }else{
        this.deviceStatus = status;
      }
    }
  }

  /*
  Just return the number of services
  */
  getNbServices(){
    return this.nbServices;
  }

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
    }else if(this.noStatus == true){ // no device Status available > return simply first uuid
        this.deviceUUID = this.uuids[0];
            // this.platformAccessory.context.deviceUUID = this.deviceUUID; // Save to archive
        this.isOnSector = true;
        resolve(this.deviceUUID);
      }else{
        this.zipabox.getDeviceUUID(this.uuids[0])
        .then(function giveDeviceUUID(deviceUUID){
          this.debug && this.log("[ZIPAC] [getDeviceUUID] Device UUID found in the box :",deviceUUID, this.debugContext);
              // this.platformAccessory.context.deviceUUID = this.deviceUUID; // Save to archive
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
            // /* Force to true for some accessories */
            // if(this.types[0] == "door" || this.types[0] == "window" || this.types[0] == "switch" || this.types[0] == "light" || this.types[0] == "outlet" || this.types[0] == "dimmer" || this.noStatus)
            //   this.isOnSector = true;
            this.debug && this.log("[ZIPAC] [getDeviceUUID] Is device on sector ?",isOnSector, this.debugContext);
            this.debug && this.log("[ZIPAC] [getDeviceUUID] DeviceUUID saved :",deviceUUID, this.debugContext);
            resolve(deviceUUID);
          }.bind(this));
        }.bind(this));
      } // End if else search for device
    }.bind(this)); // end returned Promise
  } // end getDeviceUUID function

  /*
  Return the device UUID without any promise
  */
  getDeviceUUIDfix(){
    return this.deviceUUID;
  }

  /*
  getStatusBattery give the battery status based on the level of a device and change
  the status (0 or 1) of battery if under the limit
  Depend of the choice of the user to use cache or not, the saved value is requested
  */
  getStatusBattery(callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getStatusBattery', this.debugContext);

    /* Is correctly request ? */
    if(this.deviceUUID == undefined && !this.firstBatteryRequest){
      this.log.error("[ZIPAC] [getStatusBattery] Bad request. device UUID is undefined", this.debugContext);
      callback(null,0);
      return;
    }
    if(this.isOnSector == true){
      // this.log.error("[ZIPAC] [getStatusBattery] Bad request. device is on sector.", this.debugContext);
      callback(null,0);
      return;
    }
    this.firstBatteryRequest = false; // Never avoir error launch after the first get

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
  Return the value for the specific characteristic, specified by the index
  */
  getCharacteristicValue(index, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getCharacteristicValue", index, this.debugContext);
    this.debug && this.log("[ZIPAC] [getCharacteristicValue] deviceStatus", this.deviceStatus, this.debugContext);
    this.debug && this.log("[ZIPAC] [getCharacteristicValue] noStatus", this.noStatus, this.debugContext);

    var error = null;
    if(this.deviceStatus == false && this.noStatus == false && this.isOnSector == false){
      error = "[ZIPAC] [getCharacteristicValue] Device not online";
      this.debug && this.log.error(error, index, this.debugContext);
    }
    // if(this.firstGet && (this.nbServices == (parseInt(index)+1))){ // avoid check the lastValue for error the first time
    //   this.firstGet = false;
    // }else{
    //   if(!this.firstGet && (this.lastValues[index] == null || this.lastValues[index] == undefined || index > this.nbServices )){
    //     error = "[ZIPAC] [getCharacteristicValue] Bad index request, no value found";
    //     this.debug && this.log.error(error, index, this.debugContext);
    //   }
    // }
    if(this.firstGet){ // if plugin launch first time, we need to wait a little bit to use the lastValues
      if(this.nbServices == (parseInt(index)+1)) // turn to false for last service get
        this.firstGet = false;
      callback(error, this.getEmptyValue(index));
    }else{ // not the First get
      if(this.lastValues[index] == null || this.lastValues[index] == undefined || index > this.nbServices ){
        error = "[ZIPAC] [getCharacteristicValue] Bad index request, no value found";
        this.debug && this.log.error(error, index, this.debugContext);
      }
      callback(error, this.lastValues[index]);
    }
    //callback(error, this.lastValues[index]);
  }

  /*
  getEmptyValue will return an empty value to avoid error during the first launch
  */
  getEmptyValue(index){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getEmptyValue", index, this.debugContext);

    var emptyValueToReturn = undefined;
    var type = this.types[index];
    switch (type) {
      case "switch":
        emptyValueToReturn = false;
        break;
      case "light":
        emptyValueToReturn = false;
        break;
      case "dimmer":
        emptyValueToReturn = false;
        break;
      case "outlet":
        emptyValueToReturn = false;
        break;
      case "temperature":
        emptyValueToReturn = 0;
        break;
      case "ambient":
        emptyValueToReturn = 0;
        break;
      case "motion":
        emptyValueToReturn = false;
        break;
      case "contact":
        emptyValueToReturn = false;
        break;
      case "window":
        emptyValueToReturn = false;
        break;
      case "door":
        emptyValueToReturn = false;
        break;
      case "covering":
        emptyValueToReturn = false;
        break;
      case "leak":
        emptyValueToReturn = false;
        break;
      case "co2":
        emptyValueToReturn = 0;
        break;
    }
    this.debug && this.log("[ZIPAC] [getEmptyValue] Valuye used here :", emptyValueToReturn, "for index", index, this.debugContext);
    return emptyValueToReturn;
  }

  /*
  translate attribute change the return of the box to a correct format
  based on the HomeKit request and the user configuration
  Choose the correct service with the uuid
  */
  translateAttribute(attribute,uuid){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method translateAttribute', this.debugContext);

    /* Reverse the value if requested by the configuration */
    //this.debug && this.log("[ZIPAC] [getOn] Accessory Value returned by callback:",accessoryValue);
    var returnedValue = attribute;
    /* Force boolean for remote access */
    if(returnedValue == "true")
      returnedValue = true;
    if(returnedValue == "false")
      returnedValue = false;
    /* Manage the reverse value */
    if(this.reverseValue == true){ // User ask to reverse
      if(typeof(returnedValue) != "boolean"){ // Check if returnedValue is a Boolean
        this.log.error("[ZIPAC] [translateAttribute] Coding error in getOn: returnedValue is not a boolean in reverseValue", this.debugContext);
      }else{
        if(returnedValue == true)
          returnedValue = false;
        else
          returnedValue = true;
      }
      this.debug && this.log("[ZIPAC] [translateAttribute] Configuration have request to reverse the value to :",returnedValue, this.debugContext)
    } // end reverse block

    /* Search the correct type for service uuid */
    var type = this.getType(uuid);
    this.debug && this.log("[ZIPAC] [translateAttribute] Type of service to translate :", type, this.debugContext)

    /* Adapt the scale for lux sensor */
    if(type == "ambient"){ // returned from % to scale
      returnedValue = Math.round(this.min + returnedValue/100 * this.range);
    } // end if ambient

    /* Adapt the result for windows and doors */
    if(type == "window" || type == "door"){ // Window type, need to return a digit between 0 and 100 and not boolean
      //this.debug && this.log("[ZIPAC] [getOn] Window or Door found in get Method. returnedValue :",returnedValue)
      if(returnedValue)
       returnedValue = 100;
      else
       returnedValue = 0;
    } // end if window || door

    /* Adapt the value for a battery */
    if(type == "battery"){
      if(returnedValue == undefined)
        this.log.error("[ZIPAC] [translateAttribute] Returned value for the battery level is undefined !", this.debugContext); // TODO add error manage
      else
        returnedValue = parseInt(accessoryValue);
    }
    return returnedValue;
  }

  /*
  getOnB for accessory with two uuid
  it's called each time you open the Home app or when you open control center
  callback should return (null, value) or (error, value)
  For the getB method we do not check the reaching possibility of the device
  */
  getOnB (index, callback) {
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnB', this.debugContextServices[index]);

    /* Shortcut out for outlet */
    if(this.types[index] == "outlet"){
      if(this.uuidbs[index] == null){
        this.debug && this.log("[ZIPAC] [getOnB] No uuidb configured. Return last value",this.lastValue, this.debugContextServices[index]);
        callback(null, this.lastValues[index]);
        return;
      }
    }

    var error = null;
    this.zipabox.getAttributesValue(this.uuidbs[index])
    .then(function (accessoryValue){
       this.debug && this.log("[ZIPAC] [getOnB] Accessory Value returned by callback B:",accessoryValue, this.debugContextServices[index]);
       var returnedValue = accessoryValue;
       /* BATTERY */
       if(this.types[index] == "battery"){
         this.debug && this.log("[ZIPAC] [getOnB] Battery to manage in getOnB. returnedValue :",returnedValue, this.debugContextServices[index]);
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
       if(this.types[index] == "outlet"){
         this.debug && this.log("[ZIPAC] [getOnB] Outlet to manage in getOnB. returnedValue :",returnedValue, this.debugContextServices[index]);
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
     this.log.error("[ZIPAC] [getOnB] Error on getOnB :",error, this.debugContextServices[index]);
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
  index is the adress of the service to choose
  */
  getOnRange(index, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method getOnRange", this.debugContextServices[index]);

    if(this.lastValues[index] == 0){
      this.debug && this.log("[ZIPAC] [getOnRange] Return false range is zero", this.debugContextServices[index]);
      callback(null,false);
    }else {
      this.debug && this.log("[ZIPAC] [getOnRange] Return true range is not zero", this.debugContextServices[index]);
      callback(null,true);
    }
  }

  /*
  setLast is used to fix the lastValue as the cache value
  If same, no action
  If new variable, box as changed, we need to updateCharacteristic
  */
  setLast(value,uuid){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method setLast :", value, uuid, this.debugContext);
    var find = false;
    for(var i in this.uuids){
      if(this.uuids[i] == uuid){
        find = true;
        if(this.lastValues[i] == value){
          this.debug && this.log("[ZIPAC] [setLast] Found that new value is same as previous.", value, uuid, this.debugContextServices[i]);
        }else{
          this.debug && this.log.warn("[ZIPAC] [setLast] Found that value as change. Update to homebridge.", value, uuid, this.debugContextServices[i]);
          this.directUpdate(i,value);
        }
        this.lastValues[i] = value;
      }
    }
    if(!find){
      this.debug && this.log.error("[ZIPAC] [setLast] Error : uuid not found for set the value", value, uuid, this.debugContext);
    }
  }


  /*
  setOn is used to change the value of a attribute
  Method is called when HomeKit wants to update the value of the characteristic as defined in our getServices() function
  The desired value is available in the `value` argument.
  The callback function should be called to return the value (that's in the example of homebridge, I return a null)
  The first argument in the function should be null unless and error occured
  */
  setOn(index, value, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method setOn", value, this.debugContext);
    /* Refresh state for some special accessories */
    if(this.types[index] == "window"){
      this.debug && this.log("[ZIPAC] [setOn] Set method for a Window NOT IMPLEMENTED > stop signal", this.debugContext);
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Window).getCharacteristic(Characteristic.TargetPosition).getValue();
      callback(null);
      return;
    }
    if(this.types[index] == "door"){
      this.debug && this.log("[ZIPAC] [setOn] Set method for a door NOT IMPLEMENTED > stop signal", this.debugContext);
      this.platformAccessory.getService(Service.Door).getCharacteristic(Characteristic.CurrentPosition).getValue();
      this.platformAccessory.getService(Service.Door).getCharacteristic(Characteristic.TargetPosition).getValue();
      callback(null);
      return;
    }
    var valueToPut = value;
    /* Manage reverse value */
    if(this.reverseValues[index]){
      if(typeof(value) == "boolean"){
        valueToPut = !value;
      }else{
        if(value == "true"){
          valueToPut = "false";
        }else if(value == "false"){
          valueToPut = "true"; // TODO Try to reverse 0 and 1 ?
        }else{
          this.log.error("[ZIPAC] [setOn] Impossible to reverse a non boolean value, please check config.json", this.debugContextServices[index]);
        }
      }
    }
    /* Send the request */
    this.zipabox.putAttributesValue(this.uuids[index],valueToPut)
    .then(function launchCallBack(resp){
      this.lastValues[index] = valueToPut;
      /* Update backup value for the last set for dimmer accessory */
      if(this.lastValues[index] != 0 && this.types[index] == "dimmer")
        this.backupValues[index] = valueToPut;
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
  setOnRange(index, value, callback){
    /* DEBUG */
    this.debug && this.log("[ZIPAC] > Method setOnRange", value, this.debugContextServices[index]);

    if(value){
      this.setOn(index, this.backupValues[index], callback);
    }else{
      this.setOn(index, 0, callback);
    }
  }

  /*
  getSpecial is used to always return false
  Special switch are like button. Push it and it release always
  */
  getSpecial (callback){
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method getSpecial', this.debugContext);

    callback(null, false);

    // /* Special switch are always stateless > false */
    // this.delay(1000,false)
    // .then(function launchcallback(value){
    //   callback(null, value);
    // })
  } // end method getSpecial

  /*
  setSpecial is used fur special Switch for special action
  "disconnectBox" > button to disconnect the box
  "rebootBox" > button to reboot the box
  */
  setSpecial (index, value, callback){
    /* Log to the console the value whenever this function is called */
    this.debug && this.log('[ZIPAC] > Method setSpecial', this.debugContext);

    /* Special type disconnectBox */
    if(this.uuids[index] == "disconnectBox"){
      if(value){ // Only for activation of the switch
        this.log.warn("[ZIPAC] [setSpecial] User ask to disconnect the box", this.debugContext);
        this.zipabox.logoutUser()
        .then(function giveAnswerOfLogout(response){
          if(response)
            this.log.warn("[ZIPAC] [setSpecial] User is log out", this.debugContext);
          this.directGet(index); // Will set the button to false
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
    if(this.uuids[index] == "rebootBox"){
      if(value){
        this.log.warn("[ZIPAC] [setSpecial] User ask to reboot the box", this.debugContext);
        this.zipabox.rebootTheBox()
        .then(function giveAnswerOfReboot(response){
          if(response)
            this.log.warn("[ZIPAC] [setSpecial] Box is rebooted", this.debugContext);
          this.directGet(index); // Will set the button to false
          callback(null);
        }.bind(this))
        .catch(function manageUnknowError(error){
          this.log.error("[ZIPAC] [setSpecial] Unknown error on setSpecial() :",error, this.debugContext);
          callback(error);
        }.bind(this)); // end promise chaining
      }else{ // return simply the state if user click quick
        /* User click very fast or error > setting to false do nothing */
        this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
        callback(null);
      }
    }
    /* Special type rebootHomebridge*/
    if(this.uuids[index] == "rebootHomebridge"){
      if(value){
        this.log.warn("[ZIPAC] [setSpecial] User ask to reboot Homebridge > create error", this.debugContext);
        error = "reboot" / 0;
      this.directGet(index); // Will set the button to false
      }else{ // return simply the state if user click quic
        /* User click very fast or error > setting to false do nothing */
        this.platformAccessory.getService(Service.Switch).getCharacteristic(Characteristic.On).getValue();
        callback(null);
      }
    }
  } // end method setSpecial

  /*
  getOnSecurity return the status of an alarm
  */
  getOnSecurity (callback) { // Use for get Alarm status
       /* Log to the console the value whenever this function is called */
       this.debug && this.log('[ZIPAC] > Method getOnSecurity', this.debugContext);

       var error = null;
       this.zipabox.getSecurityStatus(this.uuid,this.nightMode)
       .catch(function reConnectIfError(error){ // Check if disconnect, if then reconnect
         //return this.reconnectAfterError(error);
         return this.reconnectSecurity();
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
  getOnSecurityStatusFault (index, callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnSecurityStatusFault', index, this.debugContext);

    callback(null,this.statusFault[index]);
  } // end getOnSecurityStatusFault method

  /*
  getOnSecurityStatusTampered return if alarm is tripped with an TAMPER trip type
  If 1, Homebridge app wil specify that the accessory is tampered
  */
  getOnSecurityStatusTampered(index, callback){
    /* DEBUG */
    this.debug && this.log('[ZIPAC] > Method getOnSecurityStatusTampered', index, this.debugContext);

    callback(null,this.isTampered[index]);
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

  // /*
  // reconnectAfterError is used in a catch promise if an error is occured.
  // The method try to reconnect the plugin to the box to relaunch the last try
  // */
  // reconnectAfterError(error){
  //   /* DEBUG */
  //   this.debug && this.log("[ZIPAC] > Method reconnectAfterError for", error.message, this.debugContext);
  //
  //   return new Promise(function(resolve, reject){
  //     if (error.message == "Unauthorized"
  //     || error.message == "Unauthorized "
  //     || error.message.substr(0,38) == "request to https://my3.zipato.com:443/"
  //     || error.message.substr(0,42) == "invalid json response body at https://my3."
  //     || error.message == "No JSON" || error.type == 'invalid-json'){ // || error.message == "Bad Request " > for test
  //
  //       this.log.warn("[ZIPAC] [reconnectAfterError] Found Unauthorized error > need reconnection : ", "-"+ error.message + "-", this.debugContext);
  //
  //       if(this.centralRefresh){
  //         reject("Need central connection");
  //       }else{
  //         /* Try to reconnect the Box */
  //         return this.zipabox.connectUser()
  //         .then(this.zipabox.selectBox.bind(this.zipabox))
  //         .then(function manageAfterConnection(connectionLaunched){
  //           if(connectionLaunched == false){
  //             this.debug && this.log("[ZIPAC] [reconnectAfterError] Waiting for reconnection for device ", this.name, this.debugContext);
  //             return this.delay(7000,this.deviceUUID);
  //             //setTimeout(resolve, 7000, this.deviceUUID);
  //             // setTimeout(this.log("Waiting for reconnection."),7000);
  //             // resolve(this.uuidDevice);
  //           }else{
  //             // Error not managed > rethrow
  //             resolve(connectionLaunched);
  //           }
  //         }.bind(this))
  //       // .then(function reconnectForSecurity(deviceUUIDorUUID){
  //       //   if(this.type == "alarm"){
  //       //     this.debug && this.log("[ZIPAC] [reconnectAfterError] Alarm need a reconnection.", this.debugContext)
  //       //     return this.zipabox.connectSecurity();
  //       //   }else{
  //       //     return deviceUUIDorUUID; // same for previous Promise without alarm
  //       //   }
  //       // }.bind(this))
  //         .then(function checkStatus(){
  //           this.debug && this.log("[ZIPAC] [reconnectAfterError] Reconnection success > get Device Status", this.debugContext);
  //           !this.debug && this.log("[ZIPAC] [reconnectAfterError] The plugin has reconnect successfully to the box");
  //           this.updatePolling();
  //           return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus);
  //         }.bind(this))
  //         .catch(function manageError(error){
  //            reject(error);
  //         }); // End Unauthorized error manage
  //       }// end !this.centralRefresh
  //     }else if(error == "getOnOngoing" || error.message == "getOnOngoing"){ // TODO check if still used after 1.4.0
  //       this.debug && this.log("[ZIPAC] [reconnectAfterError] Found getOnOngoing error. Return last value.", this.debugContext)
  //       resolve(this.lastValue); // TODO : check if it's working
  //     }else if(error.message == "Not Found" || error.message == "Not Found "){
  //       this.log.warn("[ZIPAC] [reconnectAfterError] No status found. You can try with noStatus = true. Plugin try to force it. If not working change config.");
  //       this.noStatus = true;
  //       this.deviceUUID = this.uuid;
  //       resolve(true);
  //     }else{ // Rethrow error that we can't manage here
  //       this.log.error("[ZIPAC] [reconnectAfterError] Found error but not manage :", error, error.message, this.debugContext);
  //       // this.log.error("[ZIPAC] [reconnectAfterError] Test :", "Not Found" == error.message);
  //       throw error;
  //     }
  //   }.bind(this));// End Promise
  // } // end reconnectIfError method

  /*
  getDeviceStatus return the central status fixed by global refresh or
  ask to API to have the device status
  */
  getDeviceStatus(){
    if(this.centralRefresh){
      return new Promise(function(resolve,reject){
        resolve(this.deviceStatus);
      }.bind(this));
    }else{
      return this.zipabox.getDeviceStatus(this.deviceUUID,this.noStatus);
    }
  }

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
