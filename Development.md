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
- [x] Find all the difference between local and remote API

At here the past evolution can be found in [CHANGELOG](https://github.com/GusMuche/homebridge-zipabox-platform/blob/master/CHANGELOG.md)


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
- [x] Compatibility with the [Homebridge Config UI](https://github.com/homebridge/homebridge/wiki/verified-Plugins)
- [ ] Defense prog if batteryLevel requested without battery available ?
- [x] Accelerate method to reconnect or go to the platform level > 0.8.80 (BOX level)
- [ ] Check if updateReachability is used or not > https://github.com/KhaosT/HAP-NodeJS/pull/556
- [ ] Get name with name device ? > first test no concluded > do we need ?
- [ ] Find a solution for the battery level not recognize by app (simple sensor ?)

Functionality :
- [x] Add a method to check config file if same UUID used
- [x] Adapt to non local access > use of "remote" in IP parameter
- [x] Add a fake switch to reboot the box
- [x] Add a fake switch to reboot homebridge
- [x] Add a fake switch to logout the user > 0.8.80
- [ ] Bind with a graph viewer (like fakegato)
- [ ] Implementation of Outlet In Use Status > if needed


### Excluded method (out from Development route)
- [ ] Add a method to refresh cash of `homebridge` every x minutes > no need
- [ ] Add a Identify config to blink or else accessory > not very usefull
- [ ] Add a fake switch accessory to force refresh > need one event-observer method (not know by me) > just close and open the HOME APP
