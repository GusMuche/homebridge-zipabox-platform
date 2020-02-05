'use strict'

var ZipaPlatform = require('./lib/platform');

var Accessory, Service, Characteristic;

module.exports = function(homebridge) {
  /* Accessory must be created from PlatformAccessory Constructor */
  Accessory = homebridge.platformAccessory;
  /* Service and Characteristic are from hap-nodejs */
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  /* Platform plugin to be considered as dynamic
  registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true */
  homebridge.registerPlatform("homebridge-zipabox-platform", "ZipaPlatform", ZipaPlatform, true);
}
