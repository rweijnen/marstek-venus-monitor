/**
 * Marstek Venus E Protocol Types
 * TypeScript interfaces and enums for the Marstek BLE protocol
 */
export var CommandType;
(function (CommandType) {
    CommandType[CommandType["RUNTIME_INFO"] = 3] = "RUNTIME_INFO";
    CommandType[CommandType["DEVICE_INFO"] = 4] = "DEVICE_INFO";
    CommandType[CommandType["WIFI_INFO"] = 8] = "WIFI_INFO";
    CommandType[CommandType["SYSTEM_DATA"] = 13] = "SYSTEM_DATA";
    CommandType[CommandType["ERROR_CODES"] = 19] = "ERROR_CODES";
    CommandType[CommandType["BMS_DATA"] = 20] = "BMS_DATA";
    CommandType[CommandType["CONFIG_DATA"] = 26] = "CONFIG_DATA";
    CommandType[CommandType["EVENT_LOG"] = 28] = "EVENT_LOG";
    CommandType[CommandType["METER_IP"] = 33] = "METER_IP";
    CommandType[CommandType["CT_POLLING_RATE"] = 34] = "CT_POLLING_RATE";
    CommandType[CommandType["NETWORK_INFO"] = 36] = "NETWORK_INFO";
    CommandType[CommandType["LOCAL_API_STATUS"] = 40] = "LOCAL_API_STATUS";
})(CommandType || (CommandType = {}));
export const PROTOCOL_CONSTANTS = {
    START_BYTE: 0x73,
    IDENTIFIER: 0x23,
    HEADER_SIZE: 4,
    CHECKSUM_SIZE: 1
};
