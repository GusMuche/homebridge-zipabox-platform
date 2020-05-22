# Change Log

## 1.7.0 (Actually in Development)

### Enhancement
- User can now config to use cache value. Goal is to answer quicker to Homebridge request trough home app

### Debug
- Put security timer correction

## 1.6.0

### Enhancement
- Plugin will now try to refresh with noStatus = true even if user don't configure it
- Plugin will now say in log which accessories is configured twice
- More information inside identify call inside the log of Homebridge
- First EVE characteristic implemented : battery level
- Outlet will now show if in use or not (just copy the state per default)
- 2nd option : add uuidb of the current consomption to have a status based on this

### Debug
- Alarm reconnection after a long delay to keep session alive and avoid disfunction
- Accessories with no Battery Low Status will no more received this Characteristic
- Avoid crash after identify method
- Minor improvements...

## 1.5.1

### Debug
- Minor : battery recheck each 10 and no 3 times

## 1.5.0

### Functionality
- Identify method recoded (will only generate a log warning with base information)
- Plugin now detect if device is on battery or not
- The config json will now be completely consider also for cached accessories

### Debug
- Door and window no more in movement in eve app
- Minor function rewriting (bindCharacteristic)
- Correct value returned for battery level in remote mode
- Battery level verification is now called all 10 get method (before only at startup)
- Alarm status if tamper will now active the Status Tampered
- The not configured accessories are now correctly deleted

## 1.4.0

### Debug
- Delete the default parameter nightMode from config UI settings (not included if false)
- undefined error in case of reconnection
- set the correct value if user ask to reverse

## 1.3.0
- Add special Reboot switch

## 1.2.0
- Add the config.schema.json<br>
- Debug remote POST for alarm accessory

## 1.1.0
- Add possibility to activate a bigger debug for API (see Readme)
- Bug correction : Status offline of accessory / Also for trouble but online
- Update configuration of accessories after cache update even if reset is not on true.

## 1.0.0
- First public version<br>
- Adapt the config Example (full)

# Previous minor version

### 0.9.103 -> 0.9.104
First public version<br>
Remote test
### 0.8.0 -> 0.9.103
Adding security partition<br>
Add a looot of changes
### 0.7.0 -> 0.7.1
Reconnect method
Testing last accessories
### 0.6.0 -> 0.6.56
Add accessory outlet + light bulb <br>
Add sensor temperature + ambient + motion + contact + door + window + battery <br>
Add method for refresh + model Info + range lux<br>
Add method for Battery Level
### 0.5.0 -> 0.5.71
Integration of fist accessory > switch
### 0.4.0 -> 0.4.2
Test connection to the box
### 0.3.0 -> 0.3.4
isAccessoryStored method integration
### 0.2.1 - 0.2.50
First version with correct files structures and config.
### 0.1.2 - 0.2.1
Syntax and small bug fix.
### 0.1.1
The first try of using a changelog with NPM.
