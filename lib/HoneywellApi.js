"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const homey_oauth2app_1 = require("homey-oauth2app");
const promise_queue_1 = __importDefault(require("promise-queue"));
const node_cache_1 = __importDefault(require("node-cache"));
const CACHE_TTL = 10;
class HoneywellApiImpl extends homey_oauth2app_1.OAuth2Client {
    constructor() {
        super(...arguments);
        this.requestQueue = new promise_queue_1.default(1, Infinity);
        this.cacheQueue = new promise_queue_1.default(1, Infinity);
        this.locationCache = new node_cache_1.default({ stdTTL: CACHE_TTL });
    }
    async getLocations(userId) {
        if (!userId) {
            userId = (await this.getUser())?.userId;
        }
        return await this.get({
            path: `/location?userId=${userId}`,
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
        this.log('Setting temperature', zoneId, JSON.stringify(json));
        await this.put({
            path: '/temperatureZone/' + zoneId + '/heatSetpoint',
            json,
        });
    }
    async resetTemperature(zoneId) {
        const json = {
            setpointMode: 'FollowSchedule',
        };
        this.log('Resetting temperature', zoneId);
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
        this.log('Setting mode', deviceId, JSON.stringify(json));
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
        return await this.cacheQueue.add(async () => {
            // Use a short cache to prevent hammering the API
            if (!this.locationCache.has(locationId)) {
                const response = await this.get({
                    path: `/location/${locationId}/status`,
                    query: {
                        includeTemperatureControlSystems: true,
                    },
                });
                this.log('Location status retrieved', JSON.stringify(response));
                this.locationCache.set(locationId, response);
            }
            return this.locationCache.get(locationId) ?? null;
        });
    }
    async getZoneInformation(locationId, zoneId) {
        const result = {};
        const locationStatus = await this.getLocationStatus(locationId).catch(this.error);
        for (const gateway of (locationStatus?.gateways ?? [])) {
            if (result.status) {
                break;
            }
            for (const thermostat of gateway.temperatureControlSystems) {
                result.status = thermostat.zones.find(zone => zone.zoneId === zoneId);
                if (result.status) {
                    this.log('Zone status', JSON.stringify(result.status));
                    break;
                }
            }
        }
        result.zone = await this.getZone(zoneId).catch(this.error) ?? undefined;
        this.log('Zone information', JSON.stringify(result.zone));
        return result;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async get(data) {
        const result = await this.requestQueue.add(() => {
            this.log('[request]', 'GET', data.path, JSON.stringify(data.query));
            return super.get(data);
        });
        this.log('[result]', 'GET', data.path);
        return result;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async put(data) {
        const result = await this.requestQueue.add(() => {
            this.log('[request]', 'PUT', data.path, JSON.stringify(data.json));
            return super.put(data);
        });
        this.log('[result]', 'PUT', data.path, JSON.stringify(result));
        return result;
    }
    async onRequestError(err) {
        this.log('[request]', 'FAIL', err);
        throw err;
    }
}
HoneywellApiImpl.BASE_URL = homey_1.default.env.API_URL;
HoneywellApiImpl.API_URL = `${HoneywellApiImpl.BASE_URL}/WebAPI/emea/api/v1`;
HoneywellApiImpl.TOKEN_URL = `${HoneywellApiImpl.BASE_URL}/Auth/OAuth/Token`;
HoneywellApiImpl.AUTHORIZATION_URL = `${HoneywellApiImpl.BASE_URL}/Auth/OAuth/Authorize`;
HoneywellApiImpl.SCOPES = ['EMEA-Partner'];
HoneywellApiImpl.setMaxListeners(50);
module.exports = HoneywellApiImpl;
//# sourceMappingURL=HoneywellApi.js.map