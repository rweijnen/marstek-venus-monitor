/**
 * BMS Data Payload Parser (Command 0x14)
 * Parses Battery Management System data including voltages, current, SOC, and cell data
 */
import { BasePayload } from '../base/Payload.js';
export class BMSDataPayload extends BasePayload {
    parse() {
        var _a;
        // Check device type (from global deviceType or determine from data)
        const deviceType = ((_a = window.uiController) === null || _a === void 0 ? void 0 : _a.getDeviceType()) || 'battery';
        if (deviceType === 'meter') {
            // Meter has minimal BMS data - just basic status
            if (this.payloadLength < 3)
                return {};
            return {
                status: 'Meter - No Battery Management',
                rawData: Array.from(this.payload.slice(0, Math.min(16, this.payloadLength)))
                    .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
            };
        }
        if (this.payloadLength < 80) {
            return {
                status: 'Insufficient data (need 80+ bytes)',
                rawData: Array.from(this.payload.slice(0, Math.min(16, this.payloadLength)))
                    .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
            };
        }
        // Parse cell voltages (from offset 48 to 82, 2 bytes each)
        const cellVoltages = [];
        for (let i = 48; i < 82 && i < this.payloadLength - 1; i += 2) {
            const voltage = this.safeReadUint16LE(i);
            if (voltage > 0 && voltage < 5000) {
                cellVoltages.push((voltage / 1000).toFixed(3));
            }
        }
        return {
            bmsVersion: this.safeReadUint16LE(0),
            voltageLimit: (this.safeReadUint16LE(2) / 10).toFixed(1) + 'V',
            chargeCurrentLimit: (this.safeReadUint16LE(4) / 10).toFixed(1),
            dischargeCurrentLimit: (this.safeReadInt16LE(6) / 10).toFixed(1),
            remainingCapacity: this.safeReadUint16LE(8) + '%',
            stateOfHealth: this.safeReadUint16LE(10) + '%',
            designCapacity: this.safeReadUint16LE(12) + 'Wh',
            voltage: (this.safeReadUint16LE(14) / 100).toFixed(2) + 'V',
            batteryCurrent: (this.safeReadInt16LE(16) / 10).toFixed(1) + 'A',
            batteryTemperature: this.safeReadUint16LE(18) + '°C',
            b_chf: this.safeReadUint16LE(20),
            b_slf: this.safeReadUint16LE(22),
            b_cpc: this.safeReadUint16LE(24),
            errorCode: this.safeReadUint16LE(26),
            warningCode: this.safeReadUint32LE(28),
            runtime: this.safeReadUint32LE(32) + 'ms',
            b_ent: this.safeReadUint16LE(36),
            mosfetTemperature: this.safeReadUint16LE(38) + '°C',
            temperature1: this.safeReadUint16LE(40) + '°C',
            temperature2: this.safeReadUint16LE(42) + '°C',
            temperature3: this.safeReadUint16LE(44) + '°C',
            temperature4: this.safeReadUint16LE(46) + '°C',
            cellVoltages: cellVoltages
        };
    }
    toHTML() {
        const data = this.parse();
        if (data.status) {
            return `
                <h3>🔋 BMS Data (0x14)</h3>
                <div class="data-grid">
                    <div class="data-item">
                        <span class="data-label">Status:</span>
                        <span class="data-value">${data.status}</span>
                    </div>
                    ${data.rawData ? `
                    <div class="data-item">
                        <span class="data-label">Raw Data:</span>
                        <span class="data-value">${data.rawData}</span>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        return `
            <h3>🔋 BMS Data (0x14)</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">BMS Version:</span>
                    <span class="data-value">${data.bmsVersion}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Voltage:</span>
                    <span class="data-value">${data.voltage}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Battery Current:</span>
                    <span class="data-value">${data.batteryCurrent}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Remaining Capacity:</span>
                    <span class="data-value">${data.remainingCapacity}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">State of Health:</span>
                    <span class="data-value">${data.stateOfHealth}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Design Capacity:</span>
                    <span class="data-value">${data.designCapacity}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Voltage Limit:</span>
                    <span class="data-value">${data.voltageLimit}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Charge Current Limit:</span>
                    <span class="data-value">${data.chargeCurrentLimit}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Discharge Current Limit:</span>
                    <span class="data-value">${data.dischargeCurrentLimit}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Battery Temperature:</span>
                    <span class="data-value">${data.batteryTemperature}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">MOSFET Temperature:</span>
                    <span class="data-value">${data.mosfetTemperature}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Temperature 1:</span>
                    <span class="data-value">${data.temperature1}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Temperature 2:</span>
                    <span class="data-value">${data.temperature2}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Temperature 3:</span>
                    <span class="data-value">${data.temperature3}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Temperature 4:</span>
                    <span class="data-value">${data.temperature4}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Runtime:</span>
                    <span class="data-value">${data.runtime}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Error Code:</span>
                    <span class="data-value">${data.errorCode}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Warning Code:</span>
                    <span class="data-value">${data.warningCode}</span>
                </div>
                ${data.cellVoltages && data.cellVoltages.length > 0 ? `
                <div class="data-item">
                    <span class="data-label">Cell Voltages:</span>
                    <span class="data-value">${data.cellVoltages.map(v => v + 'V').join(', ')}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
}
