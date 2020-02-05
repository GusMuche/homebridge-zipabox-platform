'use strict'

var ZipaPlatform = require('./lib/platform');

//var Accessory, Service, Characteristic; // TODO delete this if not necessary

module.exports = function(homebridge) {
  /* Platform plugin to be considered as dynamic
  registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true */
  homebridge.registerPlatform("homebridge-zipabox-platform", "Zipabox", ZipaPlatform, true);
}
