'use strict';

/*
  Crypto module for user connection
  Try to require cryto
  https://nodejs.org/api/crypto.html#crypto_determining_if_crypto_support_is_unavailable
*/
let crypto;
try {
  crypto = require('crypto');
} catch (err) {
  console.log('WARNING : crypto support is disabled! Login impossible');
}

/* nodefetch and fetch-cookie for API connection*/
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie')(nodeFetch)
const myInitGet = { // used for all get fetch command
  method: 'get',
  cache: 'no-cache',
  keepalive: 'true',
  credentials: 'same-origin'
};

/*
  Class Zipabox manage the API request for each accessory
*/
class ZipaboxApi{
  constructor(debug,url,log,user,password){
    /* Base variable initialisation */
    this.debug = debug;
    if(this.debug == "FULL"){
      this.debug = true;
      this.debugFull = true;
    }else{
      this.debugFull = false;
    }
    this.baseURL = url;
    this.log = log;
    this.user = user;
    this.password = password;
    this.secureSessionId = null;
    this.inConnection = false;
    this.pin = null; // will be set at first security connection
    if(this.debug)
      this.log.warn("[BOXAPI] Debug mode activated for API request.")
    /* Remote or not cause API answer is not the same...*/
    this.isRemote = false;
    if(this.baseURL == "https://my.zipato.com:443/zipato-web/v2/")
      this.isRemote = true;
  } // end constructor of Zipabox Class

  /*
  connectUser regroup the init and connect method of the API
  Return a promise with rsove true after connection, false if error
  */
  connectUser(){
    return new Promise(function(resolve, reject){
      /* DEBUG */
      this.debug && this.log("[BOXAPI] > Method connectUser()");
      /* Check if box is already in connection mode */
      if(this.inConnection == false){
        this.debug && this.log("[BOXAPI] [connectUser] Connection launched.")
        this.inConnection = true;
        resolve(this.initUser().then(this.loginUser.bind(this)));
      }else{
        this.debug && this.log("[BOXAPI] [connectUser] Reconnection already request.")
        var error = new Error("reconnectionOnTheWay");
        resolve(false);
      }

    }.bind(this)); // end returned promise
  } // end connectUser method

  /*
  initUser implement the API request /user/init (GET)
  chain through a Promise
  */
  initUser(){
    return new Promise(function(resolve, reject) {
      this.debug && this.log("[BOXAPI] > Method initUser()");
      this.debug && this.log("[BOXAPI] [initUser] URL pour init : " + this.baseURL +'user/init');
      fetch(this.baseURL +'user/init', myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function fgetNonce(jsonResponse){ //FIXME : two newxt method can be quicker coded
        return new Promise(function(resolve,reject){
          resolve(jsonResponse.nonce);
        });
      })// end function fgetNonce
      .then(function resolveTheNonce(nonce){
        resolve(nonce); // To be directly used with loginUser
      })
      .catch(function manageError(error) {
        console.log('[BOXAPI] [initUser] Error occurred :', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  } // end initUser

  /*
  loginUser implement the API request /user/login (GET)
  */
  loginUser(nonce){
    return new Promise(function(resolve,reject){
      this.debug && this.log("[BOXAPI] > Method loginUser()");
      this.debug && this.log("[BOXAPI] [loginUser] Nonce for connect :",nonce);
      /* Calculate the token */
      var passwordHash = crypto.createHash('sha1').update(this.password).digest('hex');
      var token = crypto.createHash('sha1').update(nonce + passwordHash).digest('hex');
      this.debug && this.log("[BOXAPI] [loginUser] URL pour login: " + this.baseURL +'user/login?username='+this.user+'&token='+token);
      /* Login the user */
      fetch(this.baseURL +'user/login?username='+this.user+'&token='+token,myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function giveResult(jsonReponse){
        this.debug && this.log("[BOXAPI] [loginUser] jsonresponse for login : ",jsonReponse);
        this.inConnection = false;
        resolve(jsonReponse.success);
      }.bind(this))
      .catch(function manageError(error) {
        this.inConnection = false;
        reject(error);
      }.bind(this));// end fetch chaining
    }.bind(this)); // end Promise
  } // end function loginUser

  /*
  logoutUser  will send the request to logout the actual user /user/logout (GET)
  */
  logoutUser(){
    return new Promise(function (resolve, reject){
      this.debug && this.log("[BOXAPI] > Method logoutUser()");
      /* Logout the user */
      fetch(this.baseURL +'user/logout',myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function giveResult(jsonReponse){
        this.debug && this.log("[BOXAPI] [logoutUser] jsonresponse for logout : ",jsonReponse);
        this.inConnection = false;
        resolve(jsonReponse.success);
      }.bind(this))
      .catch(function manageError(error) {
        this.inConnection = false;
        reject(error);
      }.bind(this));// end fetch chaining
      resolve(true);
    }.bind(this)) // end returned Promise
  } // end function logoutUser

  /*
  rebootTheBox will send the request to reboot the actual box/reboot
  */
  rebootTheBox(){
    return new Promise(function (resolve, reject){
      this.debug && this.log("[BOXAPI] > Method rebootTheBox()");
      /* Logout the user */
      fetch(this.baseURL +'box/reboot',myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function giveResult(jsonReponse){
        this.debug && this.log("[BOXAPI] [rebootTheBox] jsonresponse for reboot : ",jsonReponse);
        this.inConnection = false;
        resolve(jsonReponse.success);
      }.bind(this))
      .catch(function manageError(error) {
        this.inConnection = false;
        reject(error);
      }.bind(this));// end fetch chaining
      resolve(true);
    }.bind(this)) // end returned Promise
  } // end function rebootTheBox
  /*
  getDeviceUUID give the device UUID of the attribute requested as attributeUUID
  implement the API request /attributes/_uuid_ ?network=f(...) (GET) > device.uuid
  */
  getDeviceUUID(attributeUUID){
    return new Promise(function(resolve, reject){
      var attributeRequest = '?network=false&device=true&endpoint=false&clusterEndpoint=false&definition=false&config=false&room=false&icons=false&value=false&parent=false&children=false&full=false&type=false';
      this.debug && this.log("[BOXAPI] > Method getDeviceUUID()");
      //this.debug && this.log("[BOXAPI] [getDeviceUUID] URL device :",this.baseURL + 'attributes/' + attributeUUID + attributeRequest);
      // Check if uuid is a device or not
        // TODO ADD CHECK METHOD
      // Get the id with fetch
      fetch(this.baseURL + 'attributes/' + attributeUUID + attributeRequest,myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function giveDeviceUUID(jsonResponse){
        //this.debug && this.log("[BOXAPI] [getDeviceUUID] Response of getDeviceUUID. UUID source :", attributeUUID);
        //this.debug && this.log("[BOXAPI] [getDeviceUUID] Device UUID : ",jsonResponse.device.uuid);
        resolve(jsonResponse.device.uuid);
      }.bind(this))
      .catch(function manageError(error) {
        reject(error);
      });// End fetch chaining
    }.bind(this));//end Promise
  } // end getDeviceUUID

  /*
  connectFirstSecurity is used for the first connection in case of alarm
  Will save the pin to the instance object
  Return the promise chaining of init > login (with loginSecurity)
  */
  connectFirstSecurity(pin){
    /* DEBUG */
    this.debug && this.log("[BOXAPI] > Method connectFirstSecurity()");
    /* Save PIN for next use (reconnection after first connection) */
    this.pin = pin;
    /* Return the promise chaining for security connection */
    return this.connectSecurity();
  } // end method connectFirstSecurity

  /*
  connectSecurity can be used after first connection (pin is knowed)
  Return the promise chaining of init > login
  */
  connectSecurity(){
    /* DEBUG */
    this.debug && this.log("[BOXAPI] > Method connectSecurity()");

    return this.initSecurity()
    .then(this.loginSecurity.bind(this));
    // .then(this.keepAlive.bind(this));
  } // end connectSecurity method

  /*
  initSecurity give the parameter nonce, sessionID and salt through a promise
  implement the session/init api request with a knowed pin
  First step in the connection process for security partition
  */
  initSecurity(){
    return new Promise(function(resolve, reject) {
      /* DEBUG */
      this.debug && this.log("[BOXAPI] > Method initSecurity()");
      this.debug && this.log("[BOXAPI] [initSecurity] URL pour init : " + this.baseURL +'security/session/init/');
      /* Check if pin knowed */
      if(this.pin == null || this.pin == undefined){
        var message = "[BOXAPI] [initSecurity] No PIN specified. Check the code.";
        this.log.error(message);
        throw new Error(message);
      }
      /* Request to init */
      fetch(this.baseURL +'security/session/init/', myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function fixAllInfos(jsonResponse){
        let secureSessionId = jsonResponse.response.secureSessionId;
        let nonce = jsonResponse.response.nonce;
        let salt = jsonResponse.response.salt;
        resolve([secureSessionId, nonce, salt, this.pin]);
      }.bind(this))
      .catch(function manageError(error) {
        console.log('[BOXAPI] [initSecurity] Error occurred in initSecurity :', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  } // end initSecurity

  /*
  loginSecurity will calculate the token to connect to the partition
  implement session/login
  second step of the connection to security process
  */
  loginSecurity([secureSessionId, nonce, salt, pin]){
    // Request the connection
    return new Promise(function(resolve,reject){
      this.debug && this.log("[BOXAPI] > Method loginSecurity()");
      /* Calculate saltPin */
      if(pin == "noPin"){
        var error = "[BOXAPI] [loginSecurity] No Pin specified - Connection to security not possible."
        this.log.error(error);
        reject(error)
      }
      var saltPin = salt + pin;
      this.debug && this.log("[BOXAPI] [loginSecurity] saltPin :" + saltPin);
      /* Calculate the token */
      var saltPinHash = crypto.createHash('sha1').update(saltPin).digest('hex');
      this.debug && this.log("[BOXAPI] [loginSecurity] saltPinHash : " + saltPinHash);
      var token = crypto.createHash('sha1').update(nonce + saltPinHash).digest('hex');
      this.debug && this.log("[BOXAPI] [loginSecurity] Token : " + token);
      this.debug && this.log("[BOXAPI] [loginSecurity] URL pour loginSecurity: " + this.baseURL +'security/session/login/'+secureSessionId+'?token='+token);
      /* Save secureSessionId for use in putSecuritySystem */
      this.secureSessionId = secureSessionId;
      /* Connect the Security */
      fetch(this.baseURL +'security/session/login/'+secureSessionId+'?token='+token,myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function giveResult(jsonReponse){
        this.debugFull && this.log("Result loginSecurity",jsonReponse);
        this.debug && this.log("[BOXAPI] [loginSecurity] Request to the loginSecurity : ",jsonReponse.success);
        if(jsonReponse.response.success == false)
          this.log.error("[BOXAPI] [loginSecurity] Connection to the loginSecurity : ",jsonReponse.response.success); // TODO manage error if false
        else
          this.debug && this.log("[BOXAPI] [loginSecurity] Connection to the loginSecurity : ",jsonReponse.response.success);
        resolve(jsonReponse.success);
      }.bind(this))
      .catch(function manageError(error) {
        reject(error);
      });// end fetch chaining
    }.bind(this)); // end Promise
  } // end loginSecurity

  // /*
  //
  // */
  // keepAlive(isLogged){
  //   // Request the connection
  //   return new Promise(function(resolve,reject){
  //     this.debug && this.log("[BOXAPI] > Method keepAlive()");
  //     this.debug && this.log("[BOXAPI] [keepAlive] SecuressionId :",this.secureSessionId);
  //
  //     fetch(this.baseURL +'security/session/keepalive/'+this.secureSessionId,myInitGet)
  //     .then(this.fstatus.bind(this))
  //     .then(fjson)
  //     .then(function giveResult(jsonReponse){
  //       this.debugFull && this.log("[BOXAPI] [keepAlive] Result keepAlive",jsonReponse);
  //       this.debug && this.log("[BOXAPI] [keepAlive] Request success : ",jsonReponse.success);
  //       if(jsonReponse.response.success == false)
  //         this.log.error("[BOXAPI] [keepAlive] keepAlive : ",jsonReponse.response.error); // TODO manage error if false
  //       else
  //         this.debug && this.log("[BOXAPI] [keepAlive] Keepinglive security session : ",jsonReponse.response.success);
  //       resolve(jsonReponse.response.success);
  //     }.bind(this))
  //     .catch(function manageError(error) {
  //       reject(error);
  //     });// end fetch chaining
  //   }.bind(this)); // end Promise
  // }// end keepAlive

  /*
  The method getAllAttributes is used to list all attributes available in the box
  */
  getAllAttributes(){
    /* DEBUG*/
    this.debug && this.log("[BOXAPI] > Methode getAllAttributes()");
    return new Promise(function(resolve,reject){
      fetch(this.baseURL + 'attributes',myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function returnArrayOfUUID(jsonResponse){
        this.debugFull && this.log("[BOXAPI] [getDeviceStatus] jsonResponse of getAllAttributes :", jsonResponse);
        resolve(jsonResponse);
      }.bind(this))
      .catch(function manageError(error) {
        reject(error);
      });// end fetch chaining
    }.bind(this)); // end promise
  } // end getAllAttributes

  /*
  getDeviceStatus give the device status of the attribute requested as uuidDevice
  implement the API request /devices/_uuid_/status (GET) > state.online
  Return true if noStatus is true
  */
  getDeviceStatus(uuidDevice,noStatus){ // Return the device Status
    /* DEBUG */
    this.debug && this.log("[BOXAPI] > Methode getDeviceStatus()");
    this.debugFull && this.log("[BOXAPI] [getDeviceStatus] Parameters : ", uuidDevice, noStatus);
    if(noStatus){ //config say that no device is available > return true
      return new Promise(function(resolve,reject){
        resolve(true);
      });
    }else{
      return new Promise(function(resolve, reject) {
        fetch(this.baseURL + 'devices/' + uuidDevice + '/status',myInitGet)
        .then(this.fstatus.bind(this))
        .then(fjson)
        .then(function returnDeviceStatus(jsonResponse){
          this.debug && this.log("[BOXAPI] [getDeviceStatus] Response of getDeviceStatus :", uuidDevice);
          this.debugFull && this.log("[BOXAPI] [getDeviceStatus] jsonResponse :", jsonResponse);
          var stateOnline = null;
          var stateTrouble = null
          if(this.isRemote){
            stateOnline = jsonResponse.online;
            stateTrouble = jsonResponse.trouble;
          }else{
            stateOnline = jsonResponse.state.online;
            stateTrouble = jsonResponse.state.trouble;
          }
          var deviceStatus = true;
          if(!stateOnline || stateTrouble)
            deviceStatus = false;
          this.debug && this.log("[BOXAPI] [getDeviceStatus] Device status mix :", deviceStatus);
          resolve(deviceStatus);
        }.bind(this))
        .catch(function manageError(error) {
          reject(error);
        });// end fetch chaining
      }.bind(this));// End Promise
    }
  } // end getDeviceStatus

  /*
  isOnSector return true if the accessory have no battery, false elsewhere
  implement the API request /devices/_uuid_/status (GET) > mainsPower
  */
  isOnSector(uuidDevice){
    return new Promise(function(resolve,reject){
      this.debug && this.log("[BOXAPI] > Methode isOnSector()");
      fetch(this.baseURL + 'devices/' + uuidDevice + '/status',myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function returnDeviceStatus(jsonResponse){
        this.debug && this.log("[BOXAPI] [isOnSector] Response of request for", uuidDevice);
        this.debug && this.log("[BOXAPI] [isOnSector] Device is on sector ?",jsonResponse.mainsPower);
        var mainsPower = undefined;
        if(this.isRemote){
          mainsPower = jsonResponse.mainsPower;
        }else{
          mainsPower = jsonResponse.state.mainsPower;
        }
        resolve(mainsPower);
      }.bind(this))
      .catch(function manageError(error) {
        console.log('[BOXAPI] [isOnSector] Error occurred :', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining

    }.bind(this)); // end returned Promise
  }

  /*
  getDeviceBatteryLevel give the battery level for a specified device
  implement the API request /devices/_uuid_/status (GET) > state.batteryLevel
  */
  getDeviceBatteryLevel(uuidDevice){ // Return the device Battery Level
    return new Promise(function(resolve, reject) {
      this.debug && this.log("[BOXAPI] > Methode getDeviceBatteryLevel()");
      fetch(this.baseURL + 'devices/' + uuidDevice + '/status',myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function returnDeviceStatus(jsonResponse){
        this.debug && this.log("[BOXAPI] [getDeviceBatteryLevel] Response of getDeviceBatteryLevel :", uuidDevice);
        this.debug && this.log("[BOXAPI] [getDeviceBatteryLevel] Device battery level :",jsonResponse.batteryLevel);
        var batteryLevel = undefined;
        if(this.isRemote){
          batteryLevel = jsonResponse.batteryLevel;
        }else{
          batteryLevel = jsonResponse.state.batteryLevel;
        }
        resolve(batteryLevel);
      }.bind(this))
      .catch(function manageError(error) {
        this.debug && this.log('[BOXAPI] [getDeviceBatteryLevel] Error occurred :', error);// TODO ADD gestion Error
        reject(error);
      }.bind(this));// end fetch chaining
    }.bind(this));// End Promise
  } // end getDeviceBatteryLevel

  /*
  getAttributesValue return the value of a specified attribute
  implement the API request /attributes/_uuid_/value (GET)
  */
  getAttributesValue(uuidAttributes){ // Just method to maintain the request, not the value (need to be done)
    return new Promise(function(resolve, reject){
      this.debug && this.log("[BOXAPI] > Methode getAttributesValue()");
      this.debugFull && this.log("[BOXAPI] [getAttributesValue] request : ", this.baseURL + 'attributes/' + uuidAttributes + '/value');
      fetch(this.baseURL + 'attributes/' + uuidAttributes + '/value',myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function returnDeviceStatus(jsonResponse){
        this.debug && this.log("[BOXAPI] [getAttributesValue] Response of :", uuidAttributes);
        this.debug && this.log("[BOXAPI] [getAttributesValue] Response :",jsonResponse.value);
        resolve(jsonResponse.value);
      }.bind(this))
      .catch(function manageError(error) {
        console.log('[BOXAPI] [getAttributesValue] Error occurred on getAttributesValue  :', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  }// End getAttributesValue

  /*
  getSecurityStatus give the status of a partition
  implement the alarm/partitions/-uuid-(...) api request
  */
  getSecurityStatus(uuidPartition,nightMode){
    /* SecuritySystemCurrentState Property - enum of Int in Homebridge :
    STAY_ARM = 0; > Armée présent
    AWAY_ARM = 1; > Armée absent
    NIGHT_ARM = 2; > Armée nuit
    DISARMED = 3; > Désarmée
    ALARM_TRIGGERED = 4; > zone
    ----
    Zipato :
      armMode :
        DISARMED -> Désarmé >> 3
        AWAY -> Armement total >> 1
        HOME -> Armement partiel >> 0 ou 2
      tripped :
        true || false >> 4 if true
    */
    return new Promise(function(resolve,reject){
      /* DEBUG */
      this.debug && this.log("[BOXAPI] > Method getSecurityStatus()");
      this.debug && this.log("[BOXAPI] [getSecurityStatus] getSecurityStatus request : ",this.baseURL + "alarm/partitions/" + uuidPartition + "?alarm=fals(...)");
      /* Fetch request construction */
      fetch(this.baseURL + "alarm/partitions/" + uuidPartition + "?alarm=false&zones=false&control=false&attributes=false&config=false&state=true&full=false",myInitGet)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function returnIntStatus(jsonResponse){
        let armMode = jsonResponse.state.armMode;
        let tripped = jsonResponse.state.tripped;
        let tripType = jsonResponse.state.tripType;
        // console.log("[BOXAPI] [getSecurityStatus] Response of getSecurityStatus :", uuidPartition);
        // console.log("[BOXAPI] [getSecurityStatus] armMode :",armMode);
        // console.log("[BOXAPI] [getSecurityStatus] tripped :",tripped);
        // console.log("[BOXAPI] [getSecurityStatus] tripType :",tripType);
        // console.log("[BOXAPI] [getSecurityStatus] Type of tripped :",typeof(tripped));

        // console.log("[BOXAPI] [getSecurityStatus] Test force error on connection");
        // var err = new Error("Unauthorized");
        // reject(err);

        var intToReturn = -1;
        /* Select arm type */
        if(tripped == true)
          intToReturn = 4;
        if(armMode == "HOME"){
          if(nightMode)
            intToReturn = 2; // NIGHT_ARM
          else
            intToReturn = 0; // STAY_ARM
        }
        if(armMode == "AWAY")
          intToReturn = 1; // AWAY_ARM
        if(armMode == "DISARMED")
          intToReturn = 3; // DISARMED

        /* Add 10 if tripped with tripType = Tampered */
        if(tripType == "TAMPER")
          intToReturn = intToReturn + 10;

        /* Return the final int */
        if(intToReturn == -1 || intToReturn == 9)
          reject("[BOXAPI] [getSecurityStatus] Bad return > no status find for this partition.");
        else
          resolve(intToReturn);
      })
      .catch(function manageError(error) {
        console.log('[BOXAPI] [getSecurityStatus] Error :', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this)); // end promise
  }// End getSecurityStatus

  // /*
  //
  // */
  // putSecuritySystemK(uuidPartition,valueInt){  /* DEBUG */
  //   this.debug && this.log("[BOXAPI] > Method putSecuritySystemK()");
  //   return this.keepAlive(true)
  //   .then(function launchPut(isKeeped){
  //     return this.putSecuritySystem(uuidPartition,valueInt);
  //   }.bind(this));
  // }

  /*
  putSecuritySystem change the status of an alarm
  it implement alarm/partitions/-uuid-/setMode api request
  */
  putSecuritySystem(uuidPartition,valueInt){
    /* Change the targetState of the security System requested
    valueInt is normally :
      STAY_ARM = 0; > Armée présent
      AWAY_ARM = 1; > Armée absent
      NIGHT_ARM = 2; > Armée nuit
      DISARMED = 3; > Désarmée
    */
    return new Promise(function(resolve,reject){
      /* DEBUG */
      this.debug && this.log("[BOXAPI] > Method putSecuritySystem() - secureSessionId : ",this.secureSessionId);
      this.debugFull && this.log("[BOXAPI] [putSecuritySystem] uuidPartition :",uuidPartition);
      this.debugFull && this.log("[BOXAPI] [putSecuritySystem] valueInt :",valueInt);
      /* Check if init has be done */
      if(this.secureSessionId == null)
        reject("[BOXAPI] [putSecuritySystem] No secureSessionId saved in Object !");
      /* Translate armMode from INT of HomeKit to String for Zipato */
      var armMode = "error";
      if(valueInt == 0 || valueInt == 2)
        armMode = "HOME";
      if(valueInt == 1)
        armMode = "AWAY";
      if(valueInt == 3)
        armMode = "DISARMED"
      if(armMode == "error")
        reject("[BOXAPI] [putSecuritySystem] No armMode selected. valueInt : "+valueInt);
      this.debugFull && this.log("[BOXAPI] [putSecuritySystem] armMode :",armMode);

      /* Create the Body for the request */
      var body = JSON.stringify({"armMode":armMode,"secureSessionId":this.secureSessionId});
      this.debugFull && this.log("[BOXAPI] [putSecuritySystem] body:",body);

      /* Create the special init Post for security */
      var myInitPost = new Object();
      myInitPost.method = 'POST';
      myInitPost.headers= {'Content-Type': 'application/json'};
      myInitPost.body= body;
      myInitPost.redirect= 'follow';
      this.debugFull && this.log("[BOXAPI] [putSecuritySystem] myInitPost:",myInitPost);
      this.debug && this.log("[BOXAPI] [putSecuritySystem] URL:",this.baseURL + 'alarm/partitions/' + uuidPartition + '/setMode');

      /* Request chaining */
      fetch(this.baseURL + 'alarm/partitions/' + uuidPartition + '/setMode',myInitPost)
      .then(this.fstatus.bind(this))
      .then(fjson)
      .then(function giveResponse(jsonResponse){
        /* Debu infos */
        this.debugFull && this.log("[BOXAPI] [putSecuritySystem] Response of POST : ",jsonResponse);
        this.debugFull && this.log("[BOXAPI] [putSecuritySystem] success of Response :",jsonResponse.success);
        this.debugFull && this.log("[BOXAPI] [putSecuritySystem] type of success of Response :",typeof(jsonResponse.success));
        this.debugFull && this.log("[BOXAPI] [putSecuritySystem] zoneStatus of Response :",jsonResponse.zoneStatuses);
        if(!this.isRemote){
          this.debug && this.log("[BOXAPI] [putSecuritySystem] is ok undefined :",jsonResponse.zoneStatuses[0] === undefined);
          if(jsonResponse.zoneStatuses[0] != undefined){
            this.debug && this.log("[BOXAPI] [putSecuritySystem] ok of zoneStatuses of Response :",jsonResponse.zoneStatuses[0].ok);
            this.debug && this.log("[BOXAPI] [putSecuritySystem] type of ok of zoneStatuses of Response :",typeof(jsonResponse.zoneStatuses[0].ok));
          }
        }

        /* Manage and success error */
        if (jsonResponse.success == false){
          this.log.error("[BOXAPI] [putSecuritySystem] Post method error : success false is returned. Error :",jsonResponse.error);
          reject(jsonResponse.error);
        }else{
          /* Manage the return if all go corretly - API return not the same for remote or local */
          // response.zoneStatuses = []
          if(this.isRemote){ // Remote structure
            if(jsonResponse.success == true && jsonResponse.zoneStatuses === undefined){
              this.debug && this.log("[BOXAPI] [putSecuritySystem] No bad return in zoneStatuses > resolve true");
              resolve(true);
            }else{
              /*
              Manage the return if not possible to change state : response will be
              response.zoneStatuses.ok = false
              response.zoneStatuses.bypassable = false
              response.zoneStatuses.problem = "WRONG_STATE"
              */
              if(jsonResponse.zoneStatuses[0].ok == false){
                resolve(false);
              }else{
                this.log.error("[BOXAPI] [putSecuritySystem] ERROR : bad return of Post Security Method");
                reject("[BOXAPI] [putSecuritySystem] Bad return of Post method");
              }
            }
          }else{ // Local structure
            if(jsonResponse.success == true && jsonResponse.zoneStatuses[0] === undefined){
              this.debug && this.log("[BOXAPI] [putSecuritySystem] No bad return in zoneStatuses > resolve true");
              resolve(true);
            }else{
              if(jsonResponse.zoneStatuses[0].ok == false){
                resolve(false);
              }else{
                this.log.error("[BOXAPI] [putSecuritySystem] ERROR : bad return of Post Security Method");
                reject("[BOXAPI] [putSecuritySystem] Bad return of Post method");
              }
            }
          }
        }
      }.bind(this)) // end giveResponse
      .catch(function manageError(error) {
        this.log.error('[BOXAPI] [putSecuritySystem] Error occurred!', error);// TODO ADD gestion Error
        reject(error);
      }.bind(this));// end fetch chaining
    }.bind(this)); // end Promise
  } // end putSecuritySystem

  /*
  putAttributesValueRequest give the specified boolean as value for the specified attribute
  implement the API request /attributes/_uuid_/value (PUT)
  */
  putAttributesValueRequest(uuid,valueBool){
    return new Promise(function(resolve, reject){
      this.debug && this.log("[BOXAPI] > Methode putAttributesValueRequest() uuid :",uuid);
      var myInitPut = {
        method: 'PUT',
        body: valueBool
      };
      this.debugFull && this.log("[BOXAPI] [putAttributesValueRequest] myInitPut:",myInitPut);
      this.debugFull && this.log("[BOXAPI] [putAttributesValueRequest] URL:",this.baseURL + 'attributes/' + uuid + '/value');
      fetch(this.baseURL + 'attributes/' + uuid + '/value',myInitPut)
      .then(this.fstatus.bind(this))
      .then(function giveResponse(response){
        this.debugFull && this.log("Response of put : ",response)
        resolve(null);
      }.bind(this))
      .catch(function manageError(error) {
        this.log.error('[BOXAPI] [putAttributesValueRequest] Error occurred on putAttributesValueRequest :', error);// TODO ADD gestion Error
        reject(error);
      }.bind(this));// end fetch chaining
    }.bind(this));// End Promise
  }// end putAttributesValueRequest

  fstatus(response){
    return new Promise(function(resolve,reject){
      this.debugFull && this.log("[BOXAPI] [fstatus] In fstatus", response.status);
      if (response.status >= 200 && response.status < 300) {
        resolve(response);
      } else {
        this.log.error("[BOXAPI] [fstatus] Error on fstatus.", response.statusText);
        reject(new Error(response.statusText));
      }
    }.bind(this));// end Promise
  }//end function fstatus

} // End Zipabox Class

/* Functions used with fetch. f____ */

/* fjson take an parameter and return a json object of it */
function fjson(response){
  return new Promise(function(resolve,reject){
    resolve(response.json());
  });//end Promise
}//end function fjson

module.exports = ZipaboxApi;
