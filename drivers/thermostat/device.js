"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const homey_oauth2app_1 = require("homey-oauth2app");
const timeHelper_1 = require("../../lib/timeHelper");
class ThermostatDevice extends homey_oauth2app_1.OAuth2Device {
    async onOAuth2Init() {
        // Add new capabilities
        if (!this.hasCapability('alarm_battery')) {
            await this.addCapability('alarm_battery');
        }
        this.deviceData = this.getData();
        this.registerCapabilityListener('honeywell_thermostat_mode', async (mode) => {
            if (!this.deviceData) {
                return;
            }
            await this.oAuth2Client.setMode(this.deviceData.id, mode);
            this.homey.app.thermostatModeTrigger?.trigger(this, undefined, {
                mode: mode,
            }).catch(this.error);
        });
        await this.homey.app
            .registerCloudAdapter(this.deviceData.id, this.deviceData.mac, this.oAuth2Client).catch(this.error);
        await this.getStatus();
        this.statusInterval = this.homey.setInterval(this.getStatus.bind(this), 1000 * 60 * 60); // 1 hour
    }
    async overrideMode(mode, time, hours) {
        if (!this.deviceData) {
            return;
        }
        let timeUntil = null;
        if (hours) {
            timeUntil = (0, timeHelper_1.homeyHoursToTimestamp)(hours);
            this.log('Temporarily override mode (hours)', mode, hours, timeUntil);
        }
        else if (time) {
            timeUntil = (0, timeHelper_1.homeyTimeToTimestamp)(time);
            this.log('Temporarily override mode (time)', mode, time, timeUntil);
        }
        else {
            this.log('Set mode', mode);
        }
        await this.oAuth2Client.setMode(this.deviceData.id, mode, timeUntil);
    }
    async getStatus() {
        if (!this.deviceData) {
            return;
        }
        const locationStatus = await this.oAuth2Client.getLocationStatus(this.deviceData.locationId).catch(this.error);
        this.log('Location status', JSON.stringify(locationStatus));
        (locationStatus?.gateways ?? []).forEach(gateway => {
            this.log('Gateway status', JSON.stringify(gateway));
            const thermostat = gateway.temperatureControlSystems.find(thermostat => thermostat.systemId === this.getData().id);
            if (thermostat) {
                this.log('Thermostat status', JSON.stringify(thermostat));
                this.setCapabilityValue('honeywell_thermostat_mode', thermostat.systemModeStatus.mode).catch(this.error);
                this.checkBatteryLow(thermostat.activeFaults);
            }
        });
    }
    checkBatteryLow(faults) {
        if (faults.some((fault) => fault.faultType === 'TempControlSystemControllerBatteryLow')) {
            this.setCapabilityValue('alarm_battery', true).catch(this.error);
        }
        else {
            this.setCapabilityValue('alarm_battery', false).catch(this.error);
        }
    }
    async onOAuth2Uninit() {
        if (this.deviceData) {
            await this.homey.app
                .notifyDeviceRemoved(this.deviceData.id, this.deviceData.mac).catch(this.error);
        }
        if (this.statusInterval) {
            this.homey.clearInterval(this.statusInterval);
        }
        return super.onOAuth2Uninit();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(...args) {
        super.log(`[r:${this.deviceData?.id}][${(new Date()).toISOString()}]`, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(...args) {
        super.error(`[r:${this.deviceData?.id}][${(new Date()).toISOString()}]`, ...args);
    }
}
module.exports = ThermostatDevice;
//# sourceMappingURL=device.js.map