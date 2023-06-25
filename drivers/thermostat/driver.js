"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const homey_oauth2app_1 = require("homey-oauth2app");
class ThermostatDriver extends homey_oauth2app_1.OAuth2Driver {
    async onPairListDevices({ oAuth2Client }) {
        const locations = (await oAuth2Client.getLocations().catch(this.error)) ?? [];
        this.log('Cloud locations found', JSON.stringify(locations));
        const thermostats = await oAuth2Client.getThermostats().catch(this.error) ?? [];
        this.log('Cloud devices found!', thermostats.length);
        if (homey_1.default.env.DEBUG === '1') {
            this.log('Devices', JSON.stringify(thermostats));
        }
        return thermostats.map((thermostat) => this.convertDevice(thermostat, locations));
    }
    convertDevice(thermostat, locations) {
        const data = {
            id: thermostat.id,
            mac: thermostat.mac,
            locationId: thermostat.locationId,
        };
        const location = locations.find((l) => l.locationId === thermostat.locationId);
        const result = {
            name: location ? `${location.name} - ${thermostat.name}` : thermostat.name,
            data,
            store: {
                apiInfo: thermostat,
            },
        };
        this.log('Honeywell thermostat result', JSON.stringify(result));
        return result;
    }
}
module.exports = ThermostatDriver;
//# sourceMappingURL=driver.js.map