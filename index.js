'use strict'

module.exports = function(homebridge) {
  /* Platform plugin to be considered as dynamic
  registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true */
  let ZipaPlatform = require('./lib/platform')(homebridge);
  homebridge.registerPlatform("homebridge-zipabox-platform-dev", "ZipaboxPlatform-dev", ZipaPlatform, true); // also change the addAccessory method if platform name change and schema
}
