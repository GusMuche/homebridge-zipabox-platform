'use strict';

/* Crypto module for user connection
Try to require cryto
https://nodejs.org/api/crypto.html#crypto_determining_if_crypto_support_is_unavailable */
let crypto;
try {
  crypto = require('crypto');
} catch (err) {
  console.log('WARNING : crypto support is disabled! Login impossible');
}

/* nodefetch and fetch-cookie for API connection*/
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie')(nodeFetch)

/* Class Zipabox manage the API request for each accessory */
class Zipabox{
  constructor(debug,url,log,user,password){
    /* Base variable initialisation */
    this.debug = debug;
    this.url = url;
    this.log = log;
    this.user = user;
    this.password = password;
  } // end constructor of Zipabox Class

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
