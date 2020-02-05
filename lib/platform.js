'use strict';

var Zipabox = require('./zipabox');

class ZipaPlatform{
  /* Constructor of Zipaplatform class
  log : log objet of the plugin
  config : config json object from config.json */
  constructor (log, config, api) {
    /* Base variable initialisation */
    this.log = log;
    this.config = config;
    this.accessories = [];
    this.api = api;
    /* Debug */
    this.debug = config["debug"] || false;
    this.debug && this.log("Debug mode configured by user.");
    /* Zipabox API Object */
    this.zipabox = new Zipabox(this.debug,"URL",this.log,"USER","PASS");
    /* Loaded cached accessories */
    this.api.on('didFinishLaunching', function() {
      this.log("DidFinishLaunching");
    }.bind(this));
  } // end constructor

  /* configureAccessory is invoked when homebridge tries to restore cached accessory.*/
  configureAccessory(accessory){
    this.log("> Method configureAccessory");
  } // end configureAccessory function

} // End Class ZipaPlatform

module.exports = ZipaPlatform;
