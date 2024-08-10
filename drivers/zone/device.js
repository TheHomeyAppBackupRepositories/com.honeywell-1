"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const homey_oauth2app_1 = require("homey-oauth2app");
const temperatureHelper_1 = require("../../lib/temperatureHelper");
const timeHelper_1 = require("../../lib/timeHelper");
class ZoneDevice extends homey_oauth2app_1.OAuth2Device {
    async onOAuth2Init() {
        // Add new capabilities
        if (!this.hasCapability('alarm_battery')) {
            await this.addCapability('alarm_battery');
        }
        this.deviceData = this.getData();
        this.log('Zone init', JSON.stringify(this.deviceData));
        this.registerCapabilityListener('target_temperature', async (temperature) => {
            if (!this.deviceData) {
                return;
            }
            await this.oAuth2Client.setTemperature(this.deviceData.id, temperature);
        });
        await this.homey.app
            .registerCloudAdapter(this.deviceData.id, this.deviceData.mac, this.oAuth2Client).catch(this.error);
        await this.getStatus();
        this.statusInterval = this.homey.setInterval(this.getStatus.bind(this), 1000 * 60 * 60); // 1 hour
        this.setSettings({
            location_id: this.deviceData.locationId,
            zone_id: this.deviceData.id,
        }).catch(this.error);
    }
    async getStatus() {
        if (!this.deviceData) {
            return;
        }
        const zoneInformation = await this.oAuth2Client.getZoneInformation(this.deviceData.locationId, this.deviceData.id).catch(this.error);
        if (!zoneInformation) {
            return;
        }
        if (zoneInformation.zone) {
            await this.setCapabilityOptions('target_temperature', (0, temperatureHelper_1.getTargetTemperatureCapabilityOptions)(zoneInformation.zone)).catch(this.error);
        }
        if (zoneInformation.status) {
            const status = zoneInformation.status;
            await this.setTargetTemperature(Number(status.setpointStatus.targetHeatTemperature)).catch(this.error);
            if (status.temperatureStatus.isAvailable) {
                this.setMeasuredTemperature(status.temperatureStatus.temperature).catch(this.error);
            }
            this.checkBatteryLow(status.activeFaults);
        }
    }
    checkBatteryLow(faults) {
        if (faults.some((fault) => ['TempZoneSensorLowBattery', 'TempZoneActuatorLowBattery'].includes(fault.faultType))) {
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
    async resetTemperature() {
        if (!this.deviceData) {
            return;
        }
        await this.oAuth2Client.resetTemperature(this.deviceData.id);
    }
    async overrideTemperature(temperature, time, hours) {
        if (!this.deviceData) {
            return;
        }
        let timeUntil = null;
        if (hours) {
            timeUntil = (0, timeHelper_1.homeyHoursToTimestamp)(hours);
            this.log('Temporarily override temperature (hours)', temperature, hours, timeUntil);
        }
        else if (time) {
            timeUntil = (0, timeHelper_1.homeyTimeToTimestamp)(time);
            this.log('Temporarily override temperature (time)', temperature, time, timeUntil);
        }
        else {
            this.log('Set temperature', temperature);
        }
        await this.oAuth2Client.setTemperature(this.deviceData.id, temperature, timeUntil);
    }
    async onSettings(info) {
        if (info.changedKeys.includes('temp_rounding_mode')) {
            this.log('Rounding mode setting changed to', info.newSettings.temp_rounding_mode, this.originalTemperature);
            // Update the capability option (but this only works for the Homey app, not web)
            await this.setCapabilityOptions('measure_temperature', {
                decimals: info.newSettings.temp_rounding_mode === 'none' ? 2 : 1,
            }).catch(this.error);
            // Update the value when the original value is known
            if (typeof this.originalTemperature === 'number' || typeof this.originalTemperature === 'string') {
                await this.setMeasuredTemperature(this.originalTemperature, info.newSettings.temp_rounding_mode).catch(this.error);
            }
        }
    }
    async setTargetTemperature(setpoint) {
        const capabilityOptions = this.getCapabilityOptions('target_temperature');
        const newCapabilityOptions = {};
        if (setpoint > (capabilityOptions.max ?? -Infinity)) {
            newCapabilityOptions.max = setpoint;
        }
        if (setpoint < (capabilityOptions.min ?? Infinity)) {
            newCapabilityOptions.min = setpoint;
        }
        if (newCapabilityOptions.max !== undefined || newCapabilityOptions.min !== undefined) {
            this.log('Update target temperature capability options!', newCapabilityOptions);
            await this.setCapabilityOptions('target_temperature', newCapabilityOptions).catch(this.error);
        }
        this.log('Update target temperature', setpoint);
        await this.setCapabilityValue('target_temperature', setpoint).catch(this.error);
    }
    async setMeasuredTemperature(temperature, roundingMode) {
        this.log('Update measured temperature', temperature);
        await this.setCapabilityValue('measure_temperature', (0, temperatureHelper_1.roundTemperature)(this, temperature, roundingMode));
        this.originalTemperature = temperature;
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
exports.default = ZoneDevice;
module.exports = ZoneDevice;
//# sourceMappingURL=device.js.map