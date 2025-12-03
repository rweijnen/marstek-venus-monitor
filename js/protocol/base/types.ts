/**
 * Marstek Venus E Protocol Types
 * TypeScript interfaces and enums for the Marstek BLE protocol
 */

export interface IFrameHeader {
    startByte: number;      // 0x73
    length: number;         // Frame length
    identifier: number;     // 0x23
    command: number;        // Command byte
    checksum: number;       // XOR checksum
}

export interface IRuntimeInfo {
    // Power readings (signed)
    gridPower: number;      // W (can be negative)
    solarPower: number;     // W (can be negative)
    
    // Status flags
    workMode: number;
    statusB: number;
    statusC: number;
    statusD: number;
    
    // Device identification
    productCode: number;
    powerRating: number;    // W (800 or 2500)

    // Daily/Monthly energy (kWh)
    dailyCharge: number;
    monthlyCharge: number;
    dailyDischarge: number;
    monthlyDischarge: number;

    // Lifetime energy totals (kWh)
    totalCharge: number;
    totalDischarge: number;
    
    // Firmware info
    firmwareVersion: string;  // "v3.2"
    buildCode: number;        // 471
    firmwareBuild: string;    // "2024-09-09 01:59"
    
    // Calibration tags
    calTag1: number;         // Calibration/variant tag 1
    calTag2: number;         // Calibration/variant tag 2
    reservedCounter: number; // Reserved/Counter value
    parallelStatus: number;  // 0=OFF, 1=READY, 2=ON
    generatorEnabled: number; // 0=OFF, 1=ON
    apiPort: number;         // 30000
    epsEnabled?: boolean;    // EPS/Backup Power status (undefined if cannot be determined)

    // v156+ fields (optional for backwards compatibility)
    bleLock?: number;            // BLE Lock status: 0=unlocked, 1=locked (v156+)
    depthOfDischarge?: number;   // Depth of Discharge percentage: 30-90% (v156+)
    statusFlags?: {          // Detailed status flag interpretation
        epsEnabled?: boolean;    // EPS status (undefined if not reliably encoded)
        p1MeterConnected: boolean;
        ecoTrackerConnected: boolean;
        networkActive: boolean;
        workModeState: number;
        dataQualityOk: boolean;
        errorState: number;
        serverConnected: boolean;
        httpActive: boolean;
        raw: { statusB: number; statusC: number; statusD: number; };
    };
}

export interface IDeviceInfo {
    type: string;           // Device type (e.g., "HMG-50")
    id: string;            // Device ID  
    sn: string;            // Serial number
    mac: string;           // MAC address
    fw: string;            // Firmware version
    hw: string;            // Hardware version
    [key: string]: string; // Allow for other key-value pairs
}

export enum CommandType {
    RUNTIME_INFO = 0x03,
    DEVICE_INFO = 0x04,
    URL_BROKER_CONFIG = 0x05,
    FACTORY_RESET = 0x06,
    WIFI_INFO = 0x08,
    WORK_MODE = 0x09,
    SETTINGS_INFO = 0x0A,
    TIME_SETTINGS = 0x0B,
    SYSTEM_DATA = 0x0D,
    BACKUP_POWER = 0x0F,
    BLE_EVENT_LOG = 0x13,
    OTA_ACTIVATION = 0x1F,
    BMS_DATA = 0x14,
    SET_TIME = 0x18,
    POWER_MODE = 0x15,
    BATTERY_MODE = 0x19,
    HM_SUMMARY = 0x1A,
    HM_EVENT_LOG = 0x1C,
    METER_IP = 0x21,
    CT_POLLING_RATE = 0x22,
    NETWORK_INFO = 0x24,
    LOCAL_API_STATUS = 0x28,
    DEVICE_CONFIG = 0x50,
    URL_BROKER_RESPONSE = 0x51,

    // v156+ commands
    BLE_LOCK = 0x53,             // BLE Lock control (v156+)
    DOD_SET = 0x54               // Depth of Discharge setter (v156+)
}

export const PROTOCOL_CONSTANTS = {
    START_BYTE: 0x73,
    IDENTIFIER: 0x23,
    HEADER_SIZE: 4,
    CHECKSUM_SIZE: 1
} as const;