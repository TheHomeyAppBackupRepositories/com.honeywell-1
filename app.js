"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const homey_log_1 = require("homey-log");
const homey_oauth2app_1 = require("homey-oauth2app");
const node_fetch_1 = __importDefault(require("node-fetch"));
class HoneywellAppInstance extends homey_oauth2app_1.OAuth2App {
    constructor() {
        super(...arguments);
        this.registeredDevices = {};
        this.registrationQueue = [Promise.resolve()]; // Initial resolved promise is here to simplify scheduling
    }
    async onOAuth2Init() {
        try {
            await super.onOAuth2Init();
            this.homeyLog = new homey_log_1.Log({ homey: this.homey });
            this._thermostatModeTrigger = this.homey.flow.getDeviceTriggerCard('honeywell_thermostat_mode');
            // Register webhook
            const webhook = await this.homey.cloud.createWebhook(homey_1.default.env.WEBHOOK_ID, homey_1.default.env.WEBHOOK_SECRET, {}).catch(this.error);
            if (webhook) {
                webhook.on('message', async (args) => {
                    const data = args.body;
                    this.log('Incoming webhook', JSON.stringify(data));
                    let device;
                    const temperature = data?.data.IndoorTemperature;
                    const temperatureAvailable = data?.data.IndoorTemperatureStatus ? data?.data.IndoorTemperatureStatus !== 'NotAvailable' : true;
                    const setpoint = data?.data.HeatSetpoint;
                    const mode = data?.data.QuickAction;
                    switch (data?.properties.NotificationType) {
                        case 'SensorStatus':
                            device = this.homey.drivers.getDriver('zone').getDevices()
                                .find((device) => device.getData().mac === data?.properties.MAC && device.getData().id === data?.properties.DeviceId);
                            if (!device) {
                                return this.error('Webhook for unknown device received!');
                            }
                            if (device.hasCapability('measure_temperature') && temperature) {
                                device.setMeasuredTemperature(temperatureAvailable ? temperature : null).catch(this.error);
                            }
                            break;
                        case 'SetpointStatus':
                            device = this.homey.drivers.getDriver('zone').getDevices()
                                .find((device) => device.getData().mac === data?.properties.MAC && device.getData().id === data?.properties.DeviceId);
                            if (!device) {
                                return this.error('Webhook for unknown device received!');
                            }
                            if (device.hasCapability('target_temperature') && setpoint) {
                                device.setTargetTemperature(setpoint).catch(device.error);
                            }
                            break;
                        case 'QuickAction':
                            device = this.homey.drivers.getDriver('thermostat').getDevices()
                                .find((device) => device.getData().mac === data?.properties.MAC && device.getData().id === data?.properties.DeviceId);
                            if (!device) {
                                return this.error('Webhook for unknown device received!');
                            }
                            if (device.hasCapability('honeywell_thermostat_mode') && mode && mode !== device.getCapabilityValue('honeywell_thermostat_mode')) {
                                device.setCapabilityValue('honeywell_thermostat_mode', mode)
                                    .then(() => {
                                    this._thermostatModeTrigger?.trigger(device, undefined, {
                                        mode: mode,
                                    }).catch(this.error);
                                })
                                    .catch(device.error);
                            }
                            break;
                        case 'GatewayLost':
                            this.log('Gateway communications lost');
                            this.homey.flow.getTriggerCard('honeywell_gateway_lost').trigger().catch(this.error);
                            break;
                        case 'GatewayAlive':
                            this.log('Gateway communications restored');
                            this.homey.flow.getTriggerCard('honeywell_gateway_restored').trigger().catch(this.error);
                            break;
                        default:
                            this.error('Unknown notification type!', data?.properties.NotificationType);
                    }
                });
                this.log('Webhook registered');
            }
            else {
                this.log('Webhook registration failed');
            }
            // Register flow conditions
            this.homey.flow
                .getConditionCard('honeywell_thermostat_mode')
                .registerRunListener((args) => args.device.getCapabilityValue('honeywell_thermostat_mode') === args.mode);
            // Register flow actions
            this.homey.flow
                .getActionCard('honeywell_thermostat_mode')
                .registerRunListener((args) => args.device.triggerCapabilityListener('honeywell_thermostat_mode', args.mode));
            this.homey.flow
                .getActionCard('honeywell_override_thermostat_mode')
                .registerRunListener((args) => args.device.overrideMode(args.mode, args.time));
            this.homey.flow
                .getActionCard('honeywell_override_thermostat_mode_numeric')
                .registerRunListener((args) => args.device.overrideMode(args.mode, undefined, args.hours));
            this.homey.flow
                .getActionCard('honeywell_reset_all_zones')
                .registerRunListener((args) => args.device.overrideMode('AutoWithReset'));
            this.homey.flow
                .getActionCard('honeywell_reset_temperature')
                .registerRunListener((args) => args.device.resetTemperature());
            this.homey.flow
                .getActionCard('honeywell_override_temperature')
                .registerRunListener((args) => args.device.overrideTemperature(args.temp, args.time));
            this.homey.flow
                .getActionCard('honeywell_override_temperature_numeric')
                .registerRunListener((args) => args.device.overrideTemperature(args.temp, undefined, args.hours));
            // Register flow triggers
            this._thermostatModeTrigger?.registerRunListener((args, state) => args.mode === state.mode);
            // Automatic token refresher as this app relies on webhook data, which doesn't refresh the token automatically
            this.homey.setTimeout(() => this.refreshApiToken(), 30 * 1000); // 30s
            this.tokenRefresher = this.homey.setInterval(() => this.refreshApiToken(), 1700 * 1000); // 1700s, as it seems the expires in is set to 1800s
            this.log('Honeywell has been initialized');
        }
        catch (e) {
            this.log('Honeywell failed to initialize');
            this.error(e);
        }
    }
    async onUninit() {
        if (this.tokenRefresher) {
            this.homey.clearInterval(this.tokenRefresher);
        }
        return super.onUninit();
    }
    async notifyDeviceRemoved(deviceId, deviceMac) {
        this.registeredDevices[deviceMac] = (this.registeredDevices[deviceMac] ?? []).filter(d => d !== deviceId);
        if (this.registeredDevices[deviceMac].length > 0) {
            return;
        }
        await this.removeCloudAdapter(deviceMac).catch((e) => {
            this.homeyLog.captureException(e).catch(this.error);
            throw e;
        });
    }
    async registerCloudAdapter(deviceId, deviceMac, apiClient) {
        // This method is called when a device has either been added or repaired
        // This means that the client should work fine, so the warning can be reset.
        this.getDevices().forEach(d => d.setWarning(null).catch(d.error));
        const promise = new Promise((resolve, reject) => {
            const queueLength = this.registrationQueue.length;
            this.log('Registration queue item scheduled', queueLength);
            // Wait for previous registration in queue
            this.registrationQueue[queueLength - 1]
                .catch(() => this.error('Previous registration failed'))
                .finally(() => {
                // And execute registration afterwards
                this.log('Running registration queue item', queueLength);
                this.executeCloudAdapterRegistration(deviceId, deviceMac, apiClient)
                    .then(() => resolve())
                    .catch((e) => {
                    this.homeyLog.captureException(e).catch(this.error);
                    reject(e);
                });
            });
        });
        // Push to queue and return promise
        this.registrationQueue.push(promise);
        return promise;
    }
    getDevices() {
        // Find a device to use for refresh
        const driverDevices = [];
        const drivers = Object.values(this.homey.drivers.getDrivers());
        for (const driver of drivers) {
            driverDevices.push(driver.getDevices());
        }
        return driverDevices.flat();
    }
    async executeCloudAdapterRegistration(deviceId, deviceMac, apiClient) {
        this.registeredDevices[deviceMac] ??= [];
        if (this.registeredDevices[deviceMac].includes(deviceId)) {
            this.log('Device ID already registered!');
            return;
        }
        else if (this.registeredDevices[deviceMac].length > 0) {
            // Already registered, just add the id and return
            this.log('Device MAC already registered!');
            this.registeredDevices[deviceMac].push(deviceId);
            return;
        }
        // Retrieve required user id
        const userId = (await apiClient.getUser()).userId;
        this.log('Registering device for event forwarding', userId, deviceMac);
        const result = await (0, node_fetch_1.default)(homey_1.default.env.WEBHOOK_CLOUD_ADAPTER + '/register?code=' + homey_1.default.env.WEBHOOK_CLOUD_CODE, {
            method: 'POST',
            body: JSON.stringify({
                UserId: userId,
                AuthToken: apiClient?.getToken().access_token,
                DeviceMac: deviceMac,
                HomeyId: await this.homey.cloud.getHomeyId(),
            }),
        });
        if (!result.ok) {
            this.log(result);
            throw new Error(`Device event forwarding registration failed! (${deviceMac} - ${result.status} - ${result.statusText})`);
        }
        // Mark as registered
        this.registeredDevices[deviceMac].push(deviceId);
        this.log('Device event forwarding registered!');
    }
    refreshApiToken() {
        const devices = this.getDevices();
        if (devices.length === 0) {
            this.log('No devices found, not refreshing token');
            return;
        }
        // Clear the warning for all devices
        devices.forEach(d => d.setWarning(null).catch(d.error));
        // Grab the first device, and refresh the token with it
        this.log('Automatic token refresh');
        const client = devices[0].oAuth2Client;
        if (!client) {
            this.log('oAuth2Client not found?');
            return;
        }
        try {
            client.refreshToken()
                .then(() => this.log('Token has been refreshed!'))
                .catch(() => {
                this.error('Failed to refresh token!');
                // Set device warning
                devices.forEach(d => d.setWarning(this.homey.__('token_warning')).catch(d.error));
            });
        }
        catch (e) {
            this.error('Failed to refresh token', e);
        }
    }
    async removeCloudAdapter(deviceMac) {
        this.log('Removing device for event forwarding', deviceMac);
        const result = await (0, node_fetch_1.default)(homey_1.default.env.WEBHOOK_CLOUD_ADAPTER + '/unregister?code=' + homey_1.default.env.WEBHOOK_CLOUD_CODE, {
            method: 'POST',
            body: JSON.stringify({
                DeviceMac: deviceMac,
                HomeyId: await this.homey.cloud.getHomeyId(),
            }),
        });
        if (!result.ok) {
            this.log(result);
            throw new Error(`Device event forwarding removal failed! (${deviceMac} - ${result.status} - ${result.statusText})`);
        }
        this.log('Device event forwarding removed!');
    }
}
HoneywellAppInstance.OAUTH2_CLIENT = require('./lib/HoneywellApi');
HoneywellAppInstance.OAUTH2_DEBUG = homey_1.default.env.DEBUG === '1';
module.exports = HoneywellAppInstance;
//# sourceMappingURL=app.js.map