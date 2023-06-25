"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homeyHoursToTimestamp = exports.homeyTimeToTimestamp = void 0;
function hoursAndMinutesToTimestamp(hours, minutes) {
    const timeUntil = new Date();
    timeUntil.setHours(timeUntil.getHours() + hours, timeUntil.getMinutes() + minutes);
    return timeUntil;
}
function homeyTimeToTimestamp(time) {
    // Time format is HH:mm
    const hours = parseInt(time.slice(0, 2));
    const minutes = parseInt(time.slice(3));
    return hoursAndMinutesToTimestamp(hours, minutes);
}
exports.homeyTimeToTimestamp = homeyTimeToTimestamp;
function homeyHoursToTimestamp(value) {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return hoursAndMinutesToTimestamp(hours, minutes);
}
exports.homeyHoursToTimestamp = homeyHoursToTimestamp;
//# sourceMappingURL=timeHelper.js.map