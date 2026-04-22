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
    // Power readings (signed, can be negative — firmware writes from float cast to int)
    gridPower: number;              // W, offset 0x00 — flt_20002704
    batteryPower: number;           // W, offset 0x02 — flt_2000272C / flt_20002704 depending on state

    // Status / work-mode flags
    workMode: number;               // offset 0x04 — byte_20000479
    statusB: number;                // offset 0x05 — byte_2000095E (connectivity flag)
    statusC: number;                // offset 0x06 — firmware constant 1
    statusD: number;                // offset 0x07 — byte_20001616
    userWorkMode: number;           // offset 0x26 — byte_20002FB4
    autoWorkModeChange: number;     // offset 0x27 — byte_20003023 (0=off, 1=on)

    // Identity
    deviceFwVersion: number;        // offset 0x0C — word_20002FAE (e.g. 156)
    bmsVersion: number;             // offset 0x4F — BYTE2(g_bms_voltage_and_version)
    firmwareBuild: string;          // offset 0x51 — ASCII build timestamp "YYYYMMDDhhmm"

    // Energy counters (kWh after scaling)
    dailyCharge: number;            // offset 0x0E — dword_200030AF/10 then ÷100
    monthlyCharge: number;          // offset 0x12 — dword_200030A3 raw, ÷1000
    dailyDischarge: number;         // offset 0x16 — dword_200030B3/10 then ÷100
    monthlyDischarge: number;       // offset 0x1A — dword_200030A7/10 then ÷100
    totalCharge: number;            // offset 0x29 — dword_20003097/10 then ÷100
    totalDischarge: number;         // offset 0x2D — dword_2000309B/10 then ÷100

    // Power settings (reflect current setter state)
    powerRating: number;            // offset 0x4A — 800 or 2500 W (from flt_20000308)
    euPowerLimit: number;           // offset 0x47 — byte_200004E3 (EU 800W mode, set by cmd 0x15)

    // CT meter / parallel
    detectedCtType: number;         // offset 0x4C — byte_20001614 (3=HME-4/CT002, 6=HME-3/CT003, 4=Shelly Pro EM, 7=Shelly EM G3, 8=Shelly Pro EM 50)
    batteryPhasePos: number;        // offset 0x4D — g_battery_phase_pos (0=unassigned, 1=A, 2=B, 3=C)
    parallelMode: number;           // offset 0x4E — g_parallel_mode boolean flag (not the state machine)
    parallelMachineState: number;   // offset 0x60 — byte_20003027 (0=OFF, 1=READY, 2=ON)
    ctTimingProfile: number;        // offset 0x5F — 0/1/2 post-CT-parse cooldown multiplier (set via cmd 0x22)
    generatorEnabled: number;       // offset 0x61 — byte_20003029 (0=OFF, 1=ON)
    ctShellyPort: number;           // offset 0x62-0x63 BE — Shelly CT meter UDP port (1010/2222/2223 or custom)

    // Network / API
    wifiRssi: number;               // offset 0x3D — byte_2000095F (signed int8 in practice)
    httpServerType: number;         // offset 0x3E — byte_20003092 (cloud subdomain selector, set by cmd 0x02)
    localApiEnabled: number;        // offset 0x65 — byte_2000302F (real enable flag, independent of port)
    apiPort: number;                // offset 0x66 — word_20003030

    // v156+ (not verified from firmware trace — labels inherited)
    bleLock?: number;               // offset 0x6D — existing label "BLE Lock" contradicted by real-world testing
    depthOfDischarge?: number;      // offset 0x6E — plausible (range 30-88%), unverified

    // Derived status-flag interpretation (unchanged, not firmware-verified)
    epsEnabled?: boolean;
    statusFlags?: {
        epsEnabled?: boolean;
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

    // Unknown / un-named bytes (value known, semantic not). Offsets kept in field names for easy cross-ref.
    unknowns: {
        u1_0x08: number;   // 1B  — sub_8025F68() status byte
        u2_0x09: number;   // 2B LE — bms_voltage × byte_20002E1A / 1000
        u3_0x0B: number;   // 1B  — dword_20002E1A (BMS config byte)
        u4_0x1E: number;   // 4B LE — dword_2000309F / 100000
        u5_0x31: number;   // 2B LE — byte_20002FB3[0] zero-extended (work-mode-array[0])
        u6_0x33: number;   // 2B LE — word_20003019 (time counter)
        u7_0x35: number;   // 4B LE — dword_2000301B (time counter)
        u8_0x39: number;   // 4B LE — dword_2000301F (time counter)
        u9_0x3F: number;   // 4B LE — dword_200030B7 / 100000
        u10_0x43: number;  // 4B LE — dword_200030AB / 100000
        u11_0x48: number;  // 2B LE — flt_2000030C (int cast)
        u12_0x64: number;  // 1B — byte_2000302D (set by BLE cmd 0x26 / DebugMonitor; clamped to 30..119, default 100, EEPROM 0x37A)
        u13_0x68: number;  // 1B — byte_2000401D
        u14_0x69: number;  // 1B — byte_20004040
        u15_0x6A: number;  // 1B — byte_2000401E[0]
        u16_0x6B: number;  // 1B — byte_20004125
        u17_0x6C: number;  // 1B — byte_20004126
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
    CT_TIMING_PROFILE = 0x22,
    NETWORK_INFO = 0x24,
    LOCAL_API_STATUS = 0x28,
    DEVICE_CONFIG = 0x50,
    READ_DEVICE_CONFIG = 0x51,  // VID/GID/XID read responses (NOT URL broker!)

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