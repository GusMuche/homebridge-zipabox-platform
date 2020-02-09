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
class Zipabox{
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

module.exports = Zipabox;
