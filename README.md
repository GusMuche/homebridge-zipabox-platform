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
2. Configure a very simple platform > Version 0.2.0
  - [x] Clear the structure of code
  - [x] Add CHANGELOG to help following the developpment
  - [x] Test and publish with smallest module
  - [x] Add two simple switch through the Platform
3. Create a new structure with accessory level > Version 0.3.0
  - [x] new class zipAccessory
4. Connect the user to the box > Version 0.4.0
  - [x] initUser
  - [x] connectUser
5. Add first device : a simple switch > Version 0.5.0
  - [x] Simple add
  - [x] Cache manager for old cached accessories
6. Add all device of [homebridge-zipabox-accessory](https://github.com/GusMuche/homebridge-zipabox-accessory). > Version 0.6.0
  - [x] Light > 0.6.17
  - [x] Outlet > 0.6.30
  - [x] Temperature > 0.6.30
  - [x] Refresh (accessory or platform ?) > platform > 0.6.30
  - [x] Specify Model, manufacturer and serial > 0.6.31
  - [x] Ambient > 0.6.34
  - [x] Add the config method for scale adaptation > 0.6.35
  - [x] Motion > 0.6.38
  - [x] Contact > 0.6.39
  - [x] window > 0.6.48
  - [x] Door > 0.6.48
  - [x] Leak > 0.6.48
  - [x] co2 > 0.6.48
  - [x] Battery > 0.6.54
7. Add the reconnect method and other tool from [homebridge-zipabox-accessory](https://github.com/GusMuche/homebridge-zipabox-accessory). > Version 0.7.0
  - [x] Battery limit > 0.6.57
  - [x] No Status > 0.6.34
  - [x] Reverse > 0.6.38
  - [x] Test reconnection method
  - [x] Test leak and CO with real accessories
8. Add the security lawyer > Version 0.8.0
  - [x] Init and connect for security > 0.8.2
  - [x] Alarm accessory > 0.8.3
  - [x] Nightmode > implemented, still need test > 0.8.8
  - [x] Get status activate after activation request > 0.8.16
  - [x] Test with a lot of accessories > 0.8.19 (but not with full debug)
  - [x] Change some non Debug Information (status change, warning, error, ...) > 0.8.33
  - [x] Give the possibility to debug only one accessory and not all (have two level ?) > 0.8.33
  - [x] Reconnect after connection loss for security (and normal) > implemented, still need test > 0.8.36
  - [x] Reconnection only for 1 accessory and update status after reconnection > 0.8.80
  - [x] Avoid two connection for door or window state > 0.8.68
  - [x] Make a refresh rate for each accessory (based on the type ?) and not on the platform level > 0.8.94
9. Validate the remote API access > Already done but need to be test > Version 0.9.0
- [ ] Find all the difference between local and remote API


### Further To-do List (based on accessory-plugin)

Evolution or correction :
- [x] Change the check double to agree same UUID with different type
- [x] Check lux scale if correct
- [x] Rewrite the parameter order to have something more clear and logic (sub division?)
- [x] Manage possibility to have night mode with an alarm
- [ ] Add Parameter for the wait reconnection ? > need to be tested
- [ ] Add a method to force cache reset at startup > still a part of accessory will not be deleted (why???) also if the plugin is stopped
- [ ] Complete the documentation example (full example with default parameter)
- [ ] Reconnect to the box also if only noStatus is used
- [ ] Force an "is online" method with the use of StatusFault
- [ ] Reset also the first accessory implemented
- [x] Manage the plugin if nothing is configured (and delete accessories still saved) > 0.8.58
- [ ] Compatibility with the [Homebridge Config UI](https://github.com/homebridge/homebridge/wiki/verified-Plugins)
- [ ] Defense prog if batteryLevel requested without battery available ?
- [x] Accelerate method to reconnect or go to the platform level > 0.8.80
- [ ] Check if updateReachability is used or not > https://github.com/KhaosT/HAP-NodeJS/pull/556
- [ ] Get name with name device ? > first test no concluded > do we need ?
- [ ] Find a solution for the battery level not recognize by app (simple sensor ?)

Functionality :
- [x] Add a method to check config file if same UUID used
- [x] Adapt to non local access > use of "remote" in IP parameter
- [ ] Add a fake switch to reboot the box
- [x] Add a fake switch to logout the user > 0.8.80
- [ ] Bind with a graph viewer (like fakegato)
- [ ] Implementation of Outlet In Use Status > if needed


### Excluded method (out from Development route)
- [ ] Add a method to refresh cash every x minutes > no need
- [ ] Add a Identify config to blink or else accessory > not for accessory through a bridge
- [ ] Add a fake switch accessory to force refresh > need one event-observer method

### Not Implemented Accessory (cause I'm not using them)
- Doorbell
- Dioxide Sensor
- Smoke Sensor

## Config Examples

Short example
```JSON
"platforms": [
        {
            "platform": "ZipaboxPlatform",
            "USERNAME": "you@email.com",
            "PASSWORD": "yourPassword",
            "server_ip": "192.168.0.1",
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
Full example can be found [here](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/configExamples/configShort.json).

## Parameters information - Platform
Parameter       | Remarks
-----------     | -------
`platform`      | Must be "ZipaboxPlatform" for select the correct plugin
`server_ip`     | Local ip of your Box : format 192.168.0.1 - do not add http or port <br>OR `remote` - see below -
`username`      | Username use to connect to my.zipato.com
`password`      | Password use to connect to my.zipato.com > never publish your Config <br>with this infos
`pin`           | (Optional) Your Pin in Zipato Board to arm or disarm alarm.
`debug`         | (Optional) If true the console will display tests informations for <br>the platform level and ALL the accessories - `false` in default
`debugApi`      | (Optional) If true the console will display tests informations for <br>the API request (independent of `debug` parameter) - `false` in default
`refresh`       | (Optional) Time for forced refresh of the status (in seconds)<br>see below
`reset`         | (Optional) If true the plugin will try to rebuilt all accessories <br>from config.json

Please note the lower and upper case of the parameters.

## Parameters information - Accessory
Parameter       | Remarks
-----------     | -------
`type`          | Select the Accessory Type. `switch` (default) -others see below-
`name`          | Name of your accessory, will be displayed in HomeKit <br> (muss be unique) - see below -
`manufacturer`  | Manufacturer of your device. No more use than info in HomeKit <br> `zipato` by default
`model`         | Model of your device. No more use than info in HomeKit <br> `zipato` by default
`serial`        | Serial number of your device. No more use than info in HomeKit <br> `zipato` by default
`uuid`          | uuid of your devices Switch - see Below -
`debug`         | (Optional) If true the console will display tests informations for <br>the this accessory - `false` in default - see below -
`uuidb`         | (Optional) Specify a second uuid for a service with two implemented<br>Characteristics - see below -
`batteryLimit`  | (Optional) Level (in percent 1 to 100) to launch the BatteryLow<br>Status - 0 in default (inactive) - see below -
`refresh`       | (Optional) Time for forced refresh of the status (in seconds)<br>see below
`noStatus`      | (Optional) Set to `true` if no Status (is connected) option is available<br>for the device - `false` in default - see below -
`reverse`       | (Optional) Set to `true` if the boolean signal of the sensor need to be<br>reversed - see below
`min`           | (Optional) Fix a min value for a specific range. 0 by default
`max`           | (Optional) Fix a max value for a specific range. 100 by default
`nightMode`     | (Optional) Select Home or Night for Security system <br>`false` by default

Please note the lower and upper case of the parameters.

## List of implemented accessories and function
Device              | type          | Methods
------------------- | ------------- | -------
Switch (default)    | `switch`      | Get Status - Set On - Set Off - Unavailable - Identify
Light Bulb          | `light`       | Get Status - Set On - Set Off - Unavailable - Identify
Outlet              | `outlet`      | Get Status - Set On - Set Off - Unavailable - Identify
Temperature Sensor  | `temperature` | Get Value - Battery Low Status - Unavailable
Light Sensor        | `ambient`     | Get Value - min/max - Battery Low Status - Unavailable
Motion Sensor       | `motion`      | Get Value - Battery Low Status - Unavailable
Contact Sensor      | `contact`     | Get Value - Battery Low Status - Unavailable
Window              | `window`      | Current Position (0 or 100 %) - Unavailable
Door                | `door`        | Current Position (0 or 100 %) - Unavailable
Leak Sensor         | `leak`        | Get Value - Battery Low Status - Unavailable
Battery             | `battery`     | Battery Level - Status - Unavailable
Carbon Monoxide     | `co2`         | Carbon Detected - Battery Low Status - Unavailable
Security System     | `alarm`       | Get Value - Set Value - Not ready - Night or Home

## Remarks

### remote or local use
The plugin is developped

### Name of an accessory
The name will be display in the Home app on your devices. For best practice use a short one.<br>
You can use same name with different uuid.<br>
You can't use same name AND same uuid for multiples accessories.

### Debug modes
The user can activate 3 level of debug
- API : parameter `debugApi` will activate all the API request information only. Without the next debug information it can be hard to follow
- Accessory : will activate the debug information for only one accessory, no influence on the API or Platform level
- Platform : will give a lot information for the platform level and set ALL the accessory `debug` to `true` (will not affect the `debugApi` parameter)
If the user set `debug` to `true` for Platform and `false` for one (or more) Accessory, the plugin will not consider the last one.

### uuid of Accessory
The uuid need to be the "STATE" uuid of your Zwave Device (the lowest structure level). To be sure you can try with the Zipato API to use this uuid as parameter for attributes request.<br>
![Select state for uuid](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/pics/select_state.jpeg?raw=true)<br>
To be sure you can try an api request directly from the my.zipato.com API page. Follow the link :<br>
![API link](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/pics/apiLink.png?raw=true)<br>
![uuid value test API](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/pics/uuidApiTest.png?raw=true)<br>
The Device uuid is find automatically by the plugin if noStatus is not specified.

### uuidB - Second Characteristic for implemented Services
For some Accessory, two UUID are necessary to get all the needed Information.

Accessory | uuid          | uuidB
--------- | ----          | -----
Battery   | BatteryLevel  | ChargingState

### Clear the cache
Homebridge try to relaunch cached accessories before add the other one specified inside the config.json file. If some old accessories doesn't disappear, try to put option `reset` to `true`. If other parameter given, parameter will be forced to false.<br>
If the problem is not solve, try to delete the file "cachedAccessories" inside folder "accessories" from homebridge installation.<br>
If you reset the cache, you can loose all your room configuration and other topic inside iOS.<br>
Additionally see Troubleshooting at the end of README.

### Window and Doors
The plugin only get the status open or closed for door and window. It's like a contact sensor but with an other icon. If the user click on the button in HomeKit, the plugin will force the get position method.

### min / max value
For some sensor, we need to adapt the scale. If Zipato give a percent and HomeKit want a scale, you can specify the `min` and the `max` parameter.<br>
The plugin will calculate a `range` = `max` - `min`.<br>
Then the value given to HomeKit will be calculatet = `min` + `valueOfZipato`/100 * `range`.

### Reverse a value
Some sensor work inverted as HomeKit expect. Example : a motion sensor return true if no motion are detected. If you can't change your sensor return value in his configuration or Zipato configuration, you can add the "reverse = true" parameter to reverse the returned value. Work for all "get" for attributes.<br>
This option if fixed to false by the plugin for an alarm type.

### Device Status Unavailable
In case of unavailable device status you can add the parameter `noStatus`: true to ask the plugin to not check the availability of the device. This can happen for wired device to the box (security module).<br>
It can help if your Status UUID have no Parent device with a `status` option.<br>
This option is fixed to true by the plugin for an alarm type.<br>

### Refresh Rate
HomeKit update the status of your device when you reopen the Home APP. If you want to force a refresh you can use the optional parameter "refresh" at the platform level.<br>
You do not need this to keep the connection to the Box. The plugin will reconnect if need after a long time without connection.<br>
Refresh the box will alsorefresh all the accessories states.<br><br>
For installation with a lot of accessories, you can choose to refresh at different rates some accessories. The rules is simple : the refresh at accessory level is added to the global. If two request is made too shortly, the plugin will miss one.

### Battery Limit
If you specify the batteryLimit parameter the plugin will try to get the battery value of the device of the accessory. To use this the device answer need to have a battery level status.<br>
If use correctly, Home app will indicate a warning if the battery level is under the specified battery limit.<br>
![Battery limit indicator](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/pics/batteryLowIndicator.jpeg?raw=true)<br>
The information will be also displayed on the accessory pop-up.<br>
![Battery limit indication](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/pics/batteryLowAccessory.jpeg?raw=true)<br>

## Alarm - Security system

### Alarm configuration
To configure an alarm, you must specify the UUID of the partition that you want to follow (not the device or sensor). Also the pin of the user is necessary to permit access to change the alarm (see next point).<br>
To find the uuid of the partitions, you muss go to the API website after connection to your my.zipato.com deskboard. Use the alarm/partitions/ request.<br>
![Find alarm partitions uuid](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/pics/alarmUUID.png?raw=true)<br>

### Pin missing for Alarm
The pin parameter muss be set on the platform, not the accessory. Only one user with one pin can be used.
In case of missing PIN parameter for a Alarm accessory, the plugin send a log warning, ~~change the type to "switch" and add an info in the name.~~

### Select night or home status
Homekit can return "Night" status or "Home" status for an "Perimeter only alarm". Zipato can only have one of the both. To choose if the homebridge should return Night or Home, the user has to select `nightMode` = `true` if the system has to return Night.<br>
Home mode is selected has default.

## Troubleshoting

### Cached accessories from old config
Unfortunately I didn't success during my test to clean all the cache for old platform accessories. The first one is still there and no possibility to clean it correctly (also if I use the `reset` option).<br>
If this is your case, you need to delete the cachedAccessories file inside the accessories folder of your Homebridge installation.

### Updated configuration not take
If you change parameters inside the `config.json` of an configured accessory, the change will not be taked in account if you not change the name or reset the cache.<br>
Best way to do this is to add the `reset`parameter to `true` and restart homebridge.<br>
For some error this action will not give the right answer. Then you'll need to delete the `cachedAccessories` file inside the accessories folder of your Homebridge installation.<br><br>
Explanation : a big part of the parameter from accessories are saved inside homebridge (context of an accessory). The plugin will first try to reload a configured accessory in state of recharge the `config.json`.

### Battery device not recognize by Home APP
In my test the Battery Service is not recognize by the app, but the value and the status are correctly given. The icon will be a house with a status "not recognize".<br>
If someone have a solution or idea, please send mp or fetch.

## Tested accessories

Zipato - Security Module
Zipato - Backup Module
Zipato - Multisensor 4 in 1

## CREDITS

### Thanks to the best plugin example that I followed
homebridge-gpio-wpi2<br>
homebridge-camera-ffmpeg<br>
homebridge-hue<br>
