"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const homey_oauth2app_1 = require("homey-oauth2app");
class HoneywellApiImpl extends homey_oauth2app_1.OAuth2Client {
    async getLocations(userId) {
        if (!userId) {
            userId = (await this.getUser())?.userId;
        }
        return await this.get({
            path: `/location?userId=${userId}`
        });
    }
    async getThermostats() {
        const installations = await this.get({
            path: '/location/installationInfo',
            query: {
                userId: (await this.getUser()).userId,
                includeTemperatureControlSystems: true,
            },
        });
        const thermostats = [];
        installations.forEach(installation => {
            installation.gateways.forEach(gateway => {
                gateway.temperatureControlSystems.forEach(tcs => {
                    thermostats.push({
                        name: `${tcs.modelType} (${installation.locationInfo.postcode})`,
                        id: tcs.systemId,
                        mac: gateway.gatewayInfo.mac,
                        postcode: installation.locationInfo.postcode,
                        zones: tcs.zones,
                        allowedSystemModes: tcs.allowedSystemModes,
                        locationId: installation.locationInfo.locationId,
                    });
                });
            });
        });
        return thermostats;
    }
    async getThermostat(systemId) {
        return (await this.getThermostats())
            .find((obj) => {
            return obj.id === systemId;
        }) ?? null;
    }
    async getZones() {
        const thermostats = await this.getThermostats();
        const zones = [];
        thermostats.forEach(thermostat => {
            thermostat.zones.forEach(zone => {
                zones.push({
                    name: `${zone.name} (${thermostat.postcode})`,
                    id: zone.zoneId,
                    mac: thermostat.mac,
                    setpointCapabilities: zone.setpointCapabilities,
                    locationId: thermostat.locationId,
                });
            });
        });
        return zones;
    }
    async getZone(zoneId) {
        return (await this.getZones())
            .find((obj) => {
            return obj.id === zoneId;
        }) ?? null;
    }
    async setTemperature(zoneId, value, until = null) {
        const json = {
            heatSetpointValue: value,
            setpointMode: 'PermanentOverride',
        };
        if (until) {
            json.setpointMode = 'TemporaryOverride';
            json.timeUntil = until.toISOString();
        }
        await this.put({
            path: '/temperatureZone/' + zoneId + '/heatSetpoint',
            json,
        });
    }
    async resetTemperature(zoneId) {
        const json = {
            setpointMode: 'FollowSchedule'
        };
        await this.put({
            path: '/temperatureZone/' + zoneId + '/heatSetpoint',
            json,
        });
    }
    async setMode(deviceId, systemMode, until = null) {
        const json = {
            systemMode: systemMode,
            permanent: true,
        };
        if (until) {
            json.permanent = false;
            json.timeUntil = until.toISOString();
        }
        await this.put({
            path: '/temperatureControlSystem/' + deviceId + '/mode',
            json,
        });
    }
    async getUser() {
        return await this.get({
            path: '/userAccount',
        });
    }
    async getLocationStatus(locationId) {
        return await this.get({
            path: `/location/${locationId}/status`,
            query: {
                includeTemperatureControlSystems: true,
            },
        });
    }
}
HoneywellApiImpl.BASE_URL = homey_1.default.env.API_URL;
HoneywellApiImpl.API_URL = `${HoneywellApiImpl.BASE_URL}/WebAPI/emea/api/v1`;
HoneywellApiImpl.TOKEN_URL = `${HoneywellApiImpl.BASE_URL}/Auth/OAuth/Token`;
HoneywellApiImpl.AUTHORIZATION_URL = `${HoneywellApiImpl.BASE_URL}/Auth/OAuth/Authorize`;
HoneywellApiImpl.SCOPES = ['EMEA-Partner'];
module.exports = HoneywellApiImpl;
//# sourceMappingURL=HoneywellApi.js.map