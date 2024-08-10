"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const homey_oauth2app_1 = require("homey-oauth2app");
const temperatureHelper_1 = require("../../lib/temperatureHelper");
class ZoneDriver extends homey_oauth2app_1.OAuth2Driver {
    async onPairListDevices({ oAuth2Client }) {
        const locations = (await oAuth2Client.getLocations().catch(this.error)) ?? [];
        this.log('Cloud locations found', JSON.stringify(locations));
        const zones = await oAuth2Client.getZones().catch(this.error) ?? [];
        this.log('Cloud devices found!', zones.length);
        if (homey_1.default.env.DEBUG === '1') {
            this.log('Devices', JSON.stringify(zones));
        }
        return zones.map((zone) => this.convertDevice(zone, locations));
    }
    convertDevice(zone, locations) {
        //todo add checks to see if zone is heating capable, cooling capable and if they can go onto 1 temperature selector.
        // This has not been done because we don't have a cooling setup available.
        const capabilities = [
            'target_temperature',
            'measure_temperature',
        ];
        const location = locations.find((l) => l.locationId === zone.locationId);
        const capabilitiesOptions = {
            target_temperature: (0, temperatureHelper_1.getTargetTemperatureCapabilityOptions)(zone),
        };
        const data = {
            id: zone.id,
            mac: zone.mac,
            locationId: zone.locationId,
        };
        const result = {
            name: location ? `${location.name} - ${zone.name}` : zone.name,
            data,
            store: {
                apiInfo: zone,
            },
            capabilities,
            capabilitiesOptions,
        };
        this.log('Honeywell device result', JSON.stringify(result));
        return result;
    }
}
module.exports = ZoneDriver;
//# sourceMappingURL=driver.js.map