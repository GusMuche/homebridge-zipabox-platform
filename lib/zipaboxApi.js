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
    this.baseURL = url;
    this.log = log;
    this.user = user;
    this.password = password;
  } // end constructor of Zipabox Class

  /*
  initUser implement the API request /user/init (GET)
  chain through a Promise
  */
  initUser(){
    return new Promise(function(resolve, reject) {
      this.debug && this.log("> Method initUser()");
      this.debug && this.log("URL pour init : " + this.baseURL +'user/init');
      fetch(this.baseURL +'user/init', myInitGet)
      .then(fstatus)
      .then(fjson)
      .then(function fgetNonce(jsonResponse){ //FIXME : two newxt method can be quicker coded
        return new Promise(function(resolve,reject){
          resolve(jsonResponse.nonce);
        });
      })// end function fgetNonce
      .then(function resolveTheNonce(nonce){
        resolve(nonce); // To be directly used with connectUser
      })
      .catch(function manageError(error) {
        console.log('Error occurred!', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  } // end initUser

  /*
  connectUser implement the API request /user/login (GET)
  */
  connectUser(nonce){
    return new Promise(function(resolve,reject){
      this.debug && this.log("> Method connectUser()");
      this.debug && this.log("Nonce for connect :",nonce);
      /* Calculate the token */
      var passwordHash = crypto.createHash('sha1').update(this.password).digest('hex');
      var token = crypto.createHash('sha1').update(nonce + passwordHash).digest('hex');
      this.debug && this.log("URL pour login: " + this.baseURL +'user/login?username='+this.user+'&token='+token);
      /* Login the user */
      fetch(this.baseURL +'user/login?username='+this.user+'&token='+token,myInitGet)
      .then(fstatus)
      .then(fjson)
      .then(function giveResult(jsonReponse){
        resolve(jsonReponse.success);
      })
      .catch(function manageError(error) {
        reject(error);
      });// end fetch chaining
    }.bind(this)); // end Promise
  } // end function connectUser

  /*
  getDeviceUUID give the device UUID of the attribute requested as attributeUUID
  implement the API request /attributes/_uuid_ ?network=f(...) (GET) > device.uuid
  */
  getDeviceUUID(attributeUUID){ // return the device UUID
    return new Promise(function(resolve, reject){
      var attributeRequest = '?network=false&device=true&endpoint=false&clusterEndpoint=false&definition=false&config=false&room=false&icons=false&value=false&parent=false&children=false&full=false&type=false';
      this.debug && this.log("Methode getDeviceUUID()");
      //this.debug && this.log("URL device :",this.baseURL + 'attributes/' + attributeUUID + attributeRequest);
      // Check if uuid is a device or not
        // TODO ADD CHECK METHOD
      // Get the id with fetch
      fetch(this.baseURL + 'attributes/' + attributeUUID + attributeRequest,myInitGet)
      .then(fstatus)
      .then(fjson)
      .then(function giveDeviceUUID(jsonResponse){
        this.debug && this.log("Response of getDeviceUUID. UUID source :", attributeUUID);
        this.debug && this.log("Device UUID : ",jsonResponse.device.uuid);
        resolve(jsonResponse.device.uuid);
      }.bind(this))
      .catch(function manageError(error) {
        reject(error);
      });// End fetch chaining
    }.bind(this));//end Promise
  } // end getDeviceUUID

  /*
  getDeviceStatus give the device status of the attribute requested as uuidDevice
  implement the API request /devices/_uuid_/status (GET) > state.online
  Return true if noStatus is true
  */
  getDeviceStatus(uuidDevice,noStatus){ // Return the device Status
    if(noStatus){ //config say that no device is available > return true
      return new Promise(function(resolve,reject){
        resolve(true);
      });
    }else{
      return new Promise(function(resolve, reject) {
        this.debug && this.log("Methode getDeviceStatus()");
        fetch(this.baseURL + 'devices/' + uuidDevice + '/status',myInitGet)
        .then(fstatus)
        .then(fjson)
        .then(function returnDeviceStatus(jsonResponse){
          this.debug && this.log("Response of getDeviceStatus :", uuidDevice);
          this.debug && this.log("Device status :",jsonResponse.state.online);
          resolve(jsonResponse.state.online);
        }.bind(this))
        .catch(function manageError(error) {
          console.log('Error occurred!', error);// TODO ADD gestion Error
          reject(error);
        });// end fetch chaining
      }.bind(this));// End Promise
    }
  } // end getDeviceStatus

  /*
  getDeviceBatteryLevel give the battery level for a specified device
  implement the API request /devices/_uuid_/status (GET) > state.batteryLevel
  */
  getDeviceBatteryLevel(uuidDevice){ // Return the device Battery Level
    return new Promise(function(resolve, reject) {
      this.debug && this.log("Methode getDeviceBatteryLevel()");
      fetch(this.baseURL + 'devices/' + uuidDevice + '/status',myInitGet)
      .then(fstatus)
      .then(fjson)
      .then(function returnDeviceStatus(jsonResponse){
        this.debug && this.log("Response of getDeviceBatteryLevel :", uuidDevice);
        this.debug && this.log("Device battery level :",jsonResponse.state.batteryLevel);
        resolve(jsonResponse.state.batteryLevel);
      }.bind(this))
      .catch(function manageError(error) {
        console.log('Error occurred!', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  } // end getDeviceBatteryLevel

  /*
  getAttributesValue return the value of a specified attribute
  implement the API request /attributes/_uuid_/value (GET)
  */
  getAttributesValue(uuidAttributes){ // Just method to maintain the request, not the value (need to be done)
    return new Promise(function(resolve, reject){
      this.debug && this.log("Methode getAttributesValue()");
      this.debug && this.log("getAttributesValue request : ", this.baseURL + 'attributes/' + uuidAttributes + '/value');
      fetch(this.baseURL + 'attributes/' + uuidAttributes + '/value',myInitGet)
      .then(fstatus)
      .then(fjson)
      .then(function returnDeviceStatus(jsonResponse){
        this.debug && this.log("Response of getAttributesValue :", uuidAttributes);
        this.debug && this.log("Response :",jsonResponse.value);
        resolve(jsonResponse.value);
      }.bind(this))
      .catch(function manageError(error) {
        console.log('Error occurred!', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  }// End getAttributesValue

  /*
  putAttributesValueRequest give the specified boolean as value for the specified attribute
  implement the API request /attributes/_uuid_/value (PUT)
  */
  putAttributesValueRequest(uuid,valueBool){
    return new Promise(function(resolve, reject){
      this.debug && this.log("Methode putAttributesValueRequest() uuid :",uuid);
      var myInitPut = {
        method: 'PUT',
        body: valueBool
      };
      this.debug && this.log("myInitPut:",myInitPut);
      this.debug && this.log("URL:",this.baseURL + 'attributes/' + uuid + '/value');
      fetch(this.baseURL + 'attributes/' + uuid + '/value',myInitPut)
      .then(fstatus)
      .then(function giveResponse(response){
        //this.debug && this.log("Response of put : ",response)
        resolve(null);
      }.bind(this))
      .catch(function manageError(error) {
        console.log('Error occurred!', error);// TODO ADD gestion Error
        reject(error);
      });// end fetch chaining
    }.bind(this));// End Promise
  }// end putAttributesValueRequest

} // End Zipabox Class

/* Functions used with fetch. f____ */

/* fstatus return the response of the fetch request if status is ok */
function fstatus(response){
  return new Promise(function(resolve,reject){
    //console.log("In fstatus", response.status);
    if (response.status >= 200 && response.status < 300) {
      resolve(response);
    } else {
      console.log("Error on fstatus.", response.statusText);
      reject(new Error(response.statusText));
    }
  });// end Promise
}//end function fstatus

/* fjson take an parameter and return a json object of it */
function fjson(response){
  return new Promise(function(resolve,reject){
    resolve(response.json());
  });//end Promise
}//end function fjson

module.exports = ZipaboxApi;
