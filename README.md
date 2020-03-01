This is a Plugin for [Homebridge](https://github.com/nfarina/homebridge) to link Siri and the ZipaBox.

It's the next step of [homebridge-zipabox-accessory](https://github.com/GusMuche/homebridge-zipabox-accessory) plugin (witch is made for single accessory).

It's based on many different plugin example that you can find by searching ["homebridge-plugin"](https://github.com/search?q=homebridgeplugin) in all Git repository.

The approach is to add multiple accessory through an platform and get the base information and action through API request.

This plugin will NOT find the device itself. The devices need to be configured inside the config.json file of homebridge.

The plugin didn't use the [Zipato API Node.js Implementation](https://github.com/espenmjos/zipato) (no success after a few try) like the [homebridge-zipato](https://github.com/lrozema/homebridge-zipato) plugin. The actual plugin is an alternative with direct connection to [Zipato API](https://my.zipato.com/zipato-web/api/).

I didn't work with javascript since a few years, so please be comprehensive.

## Development route

1. Package configuration and diffusion > Version 0.1.0
  - [x] GitHub on private
  - [x] Package on NPM
  - [x] Installation through npm on homebridge
1. Configure a very simple platform > Version 0.2.0
  - [x] Clear the structure of code
  - [x] Add CHANGELOG to help following the developpment
  - [x] Test and publish with smallest module
  - [x] Add two simple switch through the Platform
1. Create a new structure with accessory level > Version 0.3.0
  - [x] new class zipAccessory
1. Connect the user to the box > Version 0.4.0
  - [x] initUser
  - [x] connectUser
1. Add first device : a simple switch > Version 0.5.0
  - [x] Simple add
  - [x] Cache manager for old cached accessories
1. Add all device of [homebridge-zipabox-accessory](https://github.com/GusMuche/homebridge-zipabox-accessory). > Version 0.6.0
  - [x] Light > 0.6.17
  - [x] Outlet > 0.6.30
  - [x] Temperature > 0.6.30
  - [x] Refresh (accessory or platform ?) > platform > 0.6.30
  - [x] Specify Model, manufacturer and serial > 0.6.31
  - [x] Ambient > 0.6.34
  - [x] Add the config method for scale adaptation > 0.6.35
  - [x] Motion > 0.6.38
  - [x] Contact > 0.6.39
  - [x] window
  - [x] Door
  - [ ] Leak
  - [ ] co2
  - [ ] Battery
1. Add the reconnect method and other tool from [homebridge-zipabox-accessory](https://github.com/GusMuche/homebridge-zipabox-accessory). > Version 0.7.0
  - [ ] Battery limit
  - [x] No Status > 0.6.34
  - [x] Reverse > 0.6.38
1. Add the security layer > Version 0.8.0
  - [ ] Init and connect for security
  - [ ] Alarm accessory
  - [ ] Nightmode
1. Validate the remote API access > Already done

### Further To-do List (based on accessory-plugin)

- [x] Add a method to check config file if same UUID used
- [x] Change the check double to agree same UUID with different type
- [x] ~~Add a method to force cache reset at startut~~
- [ ] Check if updateReachability is used or not > https://github.com/KhaosT/HAP-NodeJS/pull/556
- [ ] Add a Identify config to blink or else accessory
- [ ] Add a method to refresh cash every x minutes ?
- [ ] Add a button accessory to force refresh ?
- [ ] Add a fake switch to reboot the box ?
- [ ] Force an online method with the use of StatusFault
- [ ] Rewrite the parameter order to have something more clear and logic (sub division?)
- [ ] Make a function with reconnect method
- [ ] Bind with a graph viewer (like fakegato)
- [ ] Config to force a device UUID (need ?)
- [x] Check lux scale if correct
- [ ] Defense prog if batteryLevel requested without battery available ?
- [ ] Get name with name device ? > first test no concluded > do we need ?
- [ ] -ongoing- Adapt to non local access > use of "remote" in IP parameter
- [ ] Adapt from accessory to platform > check if need (actual multiple connection)
- [ ] Implementation of Outlet In Use Status > if needed
- [ ] Add Smoke Sensor > if needed
- [ ] Manage possibility to have night mode with an alarm


### Not Implemented Accessory (cause I'm not using them)
- Doorbell
- Dioxide Sensor
- Smoke Sensor

## Config Examples

Simple example
```JSON
"platforms": [
        {
            "platform": "ZipaboxPlatform",
            "USERNAME": "you@email.com",
            "PASSWORD": "yourPassword",
            "server_ip": "192.168.0.1",
            "debug": true,
            "accessories": [
                {
                    "name": "Switch first room",
                    "UUID": "aa2zx65s-013s-1s12-12s2-s12312s9s253",
                    "type": "switch"
                }
            ]
        }
    ]
```
Full example
```JSON
"platforms": [
        {
            "platform": "ZipaboxPlatform",
            "username": "you@email.com",
            "password": "yourPassword",
            "server_ip": "192.168.0.1",
            "debug": true,
            "refresh": 5,
            "accessories": [
                {
                    "name": "Switch first room",
                    "uuid": "aa2zx65s-013s-1s12-12s2-s12312s9s253",
                    "uuidb": "aa2zx65s-013s-1s12-12s2-s12312s9s25b",
                    "type": "switch",
                    "manufacturer": "mySwitchManufacturer",
                    "model": "mySwitchModel",
                    "serial": "mySwitchSerial",
                    "noStatus": true,
                    "reverse": true,
                    "batteryLimit": 15
                },
                {
                    "name": "lux kitchen",
                    "uuid": "aa2zx65s-013s-1s12-12s2-s12312s9s253",
                    "type": "ambient",
                    "manufacturer": "mySwitchManufacturer",
                    "model": "mySwitchModel",
                    "serial": "mySwitchSerial",
                    "min": 10,
                    "max": 200,
                }
            ]
        }
    ]
```
## Parameters information - Platform
Parameter     | Remarks
---------     | -------
platform      | Must be "ZipaboxPlatform" for select the correct plugin
username      | Username use to connect to my.zipato.com
password      | Password use to connect to my.zipato.com > never publish your Config <br> with this infos
server_ip     | Local ip of your Box : format 192.168.0.1 - do not add http or port <br>OR "remote" - see below -
debug         | (Optional) If true the console will display tests informations
refresh       | (Optional) Time for forced refresh of the status (in seconds)<br>(see Remarks)
reset         | (Optional) If true the plugin will try to rebuilt all accessories <br> from config.json

Please note the lower and upper case of the parameters.

## Parameters information - Accessory
Parameter     | Remarks
---------     | -------
type          | Select the Accessory Type. switch (default) -others see below-
name          | Name of your accessory, will be displayed in HomeKit <br> (muss be unique) - see below -
manufacturer  | Manufacturer of your device. No more use than info in HomeKit <br> "unknown" by default
model         | Model of your device. No more use than info in HomeKit <br> "unknown" by default
serial        | Serial number of your device. No more use than info in HomeKit <br> "unknown" by default
uuid          | uuid of your devices Switch - see Below -
uuidb         | (Optional) Specify a second uuid for a service with two implemented<br>Characteristic - see below -
batteryLimit  | (Optional) Level (in percent 1 to 100) to launch the BatteryLow<br>Status - 0 in default (inactive)
noStatus      | (Optional) = true if no Status (is connected) option is available for<br>the device - false in default - see below-
reverse       | (Optional) = true if the boolean signal of the sensor need to be<br>reversed - see below
min           | (Optional) Fix a min value for a specific range. 0 by default
max           | (Optional) Fix a max value for a specific range. 100 by default
pin           | (Optional) : your Pin in Zipato Board to arm or disarm alarm.
nightMode     | (Optional) : Select Home or Night for Security system

Please note the lower and upper case of the parameters.

## List of implemented accessories and function
Device              | type        | Methods
------------------- | ----------- | -------
Switch (default)    | switch      | Get Status - Set On - Set Off - Unavailable
Light Bulb          | light       | Get Status - Set On - Set Off - Unavailable
Outlet              | outlet      | Get Status - Set On - Set Off - Unavailable
Temperature Sensor  | temperature | Get Value - Battery Low Status - Unavailable
Light Sensor        | ambient     | Get Value - min/max - Battery Low Status - Unavailable
Motion Sensor       | motion      | Get Value - Battery Low Status - Unavailable
Contact Sensor      | contact     | Get Value - Battery Low Status - Unavailable
Window              | window      | Current Position (0 or 100 %) - Unavailable
Door                | door        | Current Position (0 or 100 %) - Unavailable
Leak Sensor         | leak        | Get Value - Battery Low Status - Unavailable
Battery             | battery     | Battery Level - Status - Unavailable
Carbon Monoxide     | co          | Carbon Detected - Battery Low Status - Unavailable
Security System     | alarm       | Get Value - Set Value - Not ready - Night or Home

## Remarks

### remote or local use
-COMPLETE TEXT -

### Name of an accessory
The name will be display in the Home app on your devices. For best pratice use a short one.
An accessory name must be unique.
You can use same UUID with two different name or type.

### uuid of Accessory
The uuid need to be the "STATE" uuid of your Zwave Device (the lowest structure level). To be sure you can try with the Zipato API to use this uuid as parameter for attributes request.
The Device uuid is find automatically by the plugin if noStatus is not specified.

### uuidB - Second Characteristic for implemented Services
For some Accessory, two UUID are necessary to get all the needed Information.

Accessory | uuid          | uuidB
--------- | ----          | -----
Battery   | BatteryLevel  | ChargingState

### Clear the cache
Homebridge try to relaunch cached accessories before add the other one specified inside the config.json file. ~~If some old accessories doesn't disappear, try to put this option to "true". If other parameter given, parameter will be forced to false.~~
If you reset the cache, you can loose all your room configuration and other topic inside iOS.
If the problem is not solve, try to delete the file "cachedAccessories" inside folder "accessories" from homebridge installation.
Additionally see Troubleshooting at the end of README.

### Window and Doors
The plugin only get the status open or closed for door and window. It's like a contact sensor but with an other icon. If the user click on the button in HomeKit, the plugin will force the get position method.

### min / max value
TEXT TO COMPLETE

### Reverse a value
Some sensor work inverted as HomeKit expect. Example : a motion sensor return true if no motion are detected. If you can't change your sensor return value in his configuration or Zipato configuration, you can add the "reverse = true" parameter to reverse the returned value. Work for all "get" for attributes.
This option if fixed to false by the plugin for an alarm type.

### Device Status Unavailable
In case of unavailable device status you can add the parameter "noStatus": true to ask the plugin to not check the availability of the device. This can happen for wired device to the box (security module).
It can help if your Status UUID have no Parent device with a "status" option.
This option is fixed to true by the plugin for an alarm type.

### Refresh Rate
HomeKit update the status of your device when you reopen the Home APP. If you want to force a refresh you can use the optional parameter "refresh".
You do not need this to keep the connection to the Box. The plugin will reconnect if need after a long time without connection.

## Alarm - Security system

### Alarm configuration
To configure an alarm, you must specify the UUID of the partition that you want to follow (not the device or sensor). Also the pin of the user logged in ist necessary to permit access to change the alarm (see next point).

### Pin missing for Alarm
In case of missing PIN parameter for a Alarm accessory, the plugin send a log warning, change the type to "switch" and add an info in the name.

### Select night or home status
Homekit can return "Night" status or "Home" status for an "Perimeter only alarm". Zipato can only have one of the both. To choose if the homebridge should return Night or Home, the user has to select nightMode = true if the system has to return Night.
Home mode is selected has default.

## Troubleshoting

### Cached accessories from old config
Unfortunately I didn't success during my test to clean all the cache for old platform accessories. If this is your case, you need to delete the cachedAccessories file inside the accessories folder.

## CREDITS

### Thanks to the best plugin example
homebridge-gpio-wpi2
homebridge-camera-ffmpeg
homebridge-hue
