"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTargetTemperatureCapabilityOptions = exports.roundTemperature = exports.temperatureRoundingModeSettingKey = void 0;
exports.temperatureRoundingModeSettingKey = 'temp_rounding_mode';
function roundTemperature(device, value, roundingMode) {
    if (value === null) {
        return null;
    }
    value = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(value)) {
        return null;
    }
    const mode = roundingMode ?? device.getSetting(exports.temperatureRoundingModeSettingKey) ?? 'none';
    switch (mode) {
        case 'none':
            return value;
        case 'single_decimal':
            return Math.round(value * 10) / 10;
        case 'half_degree':
            return Math.round(value * 2) / 2;
    }
}
exports.roundTemperature = roundTemperature;
function getTargetTemperatureCapabilityOptions(zone) {
    const setpointCapabilities = zone.setpointCapabilities;
    return {
        min: setpointCapabilities.minHeatSetpoint,
        max: setpointCapabilities.maxHeatSetpoint,
        step: setpointCapabilities.valueResolution,
    };
}
exports.getTargetTemperatureCapabilityOptions = getTargetTemperatureCapabilityOptions;
//# sourceMappingURL=temperatureHelper.js.map