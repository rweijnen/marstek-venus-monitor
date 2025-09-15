/**
 * Payload Factory
 * Creates appropriate payload parser based on command type
 */

import { BasePayload } from '../base/Payload.js';
import { CommandType } from '../base/types.js';
import { RuntimeInfoPayload } from './RuntimeInfo.js';
import { DeviceInfoPayload } from './DeviceInfo.js';
import { WiFiInfoPayload } from './WiFiInfo.js';
import { BMSDataPayload } from './BMSData.js';
import { NetworkInfoPayload } from './NetworkInfo.js';
import { TimeSettings } from './TimeSettings.js';
import { WorkModeConfig } from './WorkModeConfig.js';
import { FactoryResetResponse } from './FactoryResetResponse.js';
import { OTAActivation } from './OTAActivation.js';
import { DeveloperModeInfo } from './DeveloperModeInfo.js';
import { DeviceConfig } from './DeviceConfig.js';
import { SettingsInfo } from './SettingsInfo.js';
import { PowerModeResponse } from './PowerModeResponse.js';
import { BackupPowerResponse } from './BackupPowerResponse.js';
import { EventLog } from './EventLog.js';
import { HMEventLog } from './HMEventLog.js';
import { URLBrokerConfig } from './URLBrokerConfig.js';
import { HMSummary } from './HMSummary.js';

export function createPayload(data: Uint8Array): BasePayload {
    if (data.length < 4) {
        throw new Error('Data too short to determine command type');
    }

    const command = data[3]; // Command byte at index 3

    switch (command) {
        case CommandType.RUNTIME_INFO:
            return new RuntimeInfoPayload(data);
            
        case CommandType.DEVICE_INFO:
            return new DeviceInfoPayload(data);
            
        case CommandType.URL_BROKER_RESPONSE:
            return new URLBrokerConfig(data);
            
        case CommandType.FACTORY_RESET:
            return new FactoryResetResponse(data);
            
        case CommandType.WIFI_INFO:
            return new WiFiInfoPayload(data);
            
        case CommandType.WORK_MODE:
            return new WorkModeConfig(data);
            
        case CommandType.TIME_SETTINGS:
            return new TimeSettings(data);
            
        case CommandType.SYSTEM_DATA:
            return new DeveloperModeInfo(data);
            
        case CommandType.BACKUP_POWER:
            return new BackupPowerResponse(data);
            
        case CommandType.BMS_DATA:
            return new BMSDataPayload(data);
            
        case CommandType.POWER_MODE:
            return new PowerModeResponse(data);
            
        case CommandType.HM_SUMMARY:
            return new HMSummary(data);
            
        case CommandType.NETWORK_INFO:
            return new NetworkInfoPayload(data);
            
        case CommandType.OTA_ACTIVATION:
            return new OTAActivation(data);
            
        case CommandType.DEVICE_CONFIG:
            return new DeviceConfig(data);
            
        case CommandType.SETTINGS_INFO:
            return new SettingsInfo(data);
            
        case CommandType.BLE_EVENT_LOG:
            return new EventLog(data);
            
        case CommandType.HM_EVENT_LOG:
            return new HMEventLog(data);
            
        
        // Add other payload types as we implement them
        
        default:
            // For unimplemented commands, create a generic payload
            return new GenericPayload(data);
    }
}

// Generic payload for commands we haven't implemented yet
class GenericPayload extends BasePayload {
    public parse(): any {
        return {
            command: `0x${this.commandType.toString(16).padStart(2, '0').toUpperCase()}`,
            commandName: this.commandName,
            payloadLength: this.payloadLength,
            rawData: Array.from(this.payload.slice(0, Math.min(16, this.payloadLength)))
                .map(b => `0x${b.toString(16).padStart(2, '0')}`)
                .join(' ')
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>${data.commandName} (${data.command})</h3>
            <div class="data-grid">
                <div><strong>Payload Length:</strong> ${data.payloadLength} bytes</div>
                <div><strong>Raw Data:</strong> ${data.rawData}${this.payloadLength > 16 ? '...' : ''}</div>
            </div>
        `;
    }
}

export { 
    RuntimeInfoPayload, 
    DeviceInfoPayload, 
    WiFiInfoPayload, 
    BMSDataPayload, 
    NetworkInfoPayload,
    TimeSettings,
    WorkModeConfig,
    FactoryResetResponse,
    OTAActivation,
    DeveloperModeInfo,
    DeviceConfig,
    SettingsInfo,
    PowerModeResponse,
    BackupPowerResponse,
    EventLog,
    HMEventLog,
    URLBrokerConfig,
    HMSummary
};