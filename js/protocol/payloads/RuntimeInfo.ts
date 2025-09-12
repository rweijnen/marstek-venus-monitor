/**
 * Runtime Info Payload Parser (Command 0x03)
 * Handles parsing of runtime information from Marstek Venus E devices
 */

import { BasePayload } from '../base/Payload.js';
import { IRuntimeInfo } from '../base/types.js';

export class RuntimeInfoPayload extends BasePayload {
    public parse(): IRuntimeInfo {
        if (this.payloadLength < 100) {
            throw new Error(`Runtime info payload too short: ${this.payloadLength} bytes, need at least 100`);
        }

        // Parse power readings (signed 16-bit, can be negative for import/export)
        const gridPower = this.readInt16LE(0x00);  // Grid/line power (W)
        const solarPower = this.readInt16LE(0x02); // PV/solar power (W)

        // Parse status flags
        const workMode = this.readUint8(0x04);     // Work/server mode
        const statusB = this.readUint8(0x05);      // Status flag B
        const statusC = this.readUint8(0x06);      // Status flag C
        const statusD = this.readUint8(0x07);      // Status flag D

        // Parse product identification
        const productCode = this.readUint16LE(0x0C); // Model/product code

        // Parse telemetry/meter values
        const meter1 = this.readUint16LE(0x12);    // Voltage or energy counter
        const meter2 = this.readUint16LE(0x16);    // Secondary meter value
        const meter3 = this.readUint16LE(0x1A);    // Tertiary meter value

        // Parse energy accumulators (32-bit LE)
        const energyTotal1 = this.readUint32LE(0x2E); // Energy counter 1 at 0x2E
        const energyTotal2 = this.readUint32LE(0x32); // Energy counter 2 at 0x32

        // Parse device specifications
        const powerRatingRaw = this.safeReadUint16LE(0x4A); // Power rating at payload offset 0x4A (raw 0x4E)
        const powerRating = powerRatingRaw;
        
        // Parse firmware version
        const fwMajor = this.safeReadUint8(0x4C);   // FW major at payload offset 0x4C (raw 0x50)
        const fwMinor = this.safeReadUint8(0x4D);   // FW minor at payload offset 0x4D (raw 0x51)
        const firmwareVersion = `v${fwMajor}.${fwMinor}`;

        // Parse build code (big endian)
        const buildCode = this.safeReadUint16BE(0x4E); // Build code at payload offset 0x4E (raw 0x52)

        // Parse firmware timestamp (12 ASCII bytes)
        const firmwareBuild = this.parseFirmwareTimestamp(0x51); // Timestamp at payload offset 0x51 (raw 0x55)

        // Parse calibration tags with bounds checking
        const reservedCounter = this.safeReadUint16LE(0x5E); // Reserved/Counter at payload offset 0x5E
        const calTag1 = this.safeReadUint16LE(0x60);        // Cal/Variant tag 1 at payload offset 0x60
        const calTag2 = this.safeReadUint16BE(0x62);        // Cal/Variant tag 2 at payload offset 0x62 (BE)
        const calTag3 = this.safeReadUint16LE(0x64);        // Cal/Variant tag 3 at payload offset 0x64
        const apiPort = this.safeReadUint16LE(0x66);        // Local API port at payload offset 0x66

        // Parse EPS/Backup Power status from status flags
        // Based on firmware analysis, EPS flag might be encoded in one of the status bytes
        // Check common bit patterns for EPS enable/disable
        const epsEnabled = this.parseEPSStatus(statusB, statusC, statusD);
        
        // Parse detailed status flag information
        const statusFlags = this.parseStatusFlags(statusB, statusC, statusD);

        return {
            gridPower,
            solarPower,
            workMode,
            statusB,
            statusC,
            statusD,
            productCode,
            powerRating,
            meter1,
            meter2,
            meter3,
            energyTotal1,
            energyTotal2,
            firmwareVersion,
            buildCode,
            firmwareBuild,
            calTag1,
            calTag2,
            calTag3,
            reservedCounter,
            apiPort,
            epsEnabled,
            statusFlags
        };
    }

    private parseEPSStatus(statusB: number, statusC: number, statusD: number): boolean | undefined {
        // Based on firmware analysis, EPS status flag (byte_200030EF) should map to one of the status bytes
        // Most likely encoded in statusB bit 0
        if ((statusB & 0x01) === 1) return true;
        if ((statusB & 0x01) === 0) return false;
        
        // Fallback: check other status bytes
        if ((statusC & 0x01) === 1) return true;
        if ((statusD & 0x01) === 1) return true;
        
        return undefined;
    }

    private parseStatusFlags(statusB: number, statusC: number, statusD: number) {
        // Based on firmware analysis of sub_8009E58, status flags likely encode:
        return {
            // StatusB interpretations (most likely)
            epsEnabled: (statusB & 0x01) === 1,           // Bit 0: EPS/Backup Power
            p1MeterConnected: (statusB & 0x02) === 2,     // Bit 1: P1 Meter connection  
            ecoTrackerConnected: (statusB & 0x04) === 4,  // Bit 2: Eco-Tracker connection
            networkActive: (statusB & 0x08) === 8,        // Bit 3: Network activity
            
            // StatusC interpretations
            workModeState: statusC & 0x0F,                 // Lower 4 bits: work mode state
            dataQualityOk: (statusC & 0x10) === 16,       // Bit 4: Data quality
            
            // StatusD interpretations  
            errorState: statusD & 0x07,                    // Lower 3 bits: error state (0-6)
            serverConnected: (statusD & 0x08) === 8,      // Bit 3: Server connection
            httpActive: (statusD & 0x10) === 16,          // Bit 4: HTTP activity
            
            // Raw values for debugging
            raw: { statusB, statusC, statusD }
        };
    }

    private getWorkModeString(mode: number): string {
        // Work mode mapping based on MT app labels (confirmed by user)
        const modes: { [key: number]: string } = {
            0x00: 'Auto',
            0x01: 'Standby',           // Confirmed: MT app shows "Standby" for mode 1
            0x02: 'Charging',          // Confirmed: MT app shows "Charging" for mode 2  
            0x03: 'Sell Electricity', // Confirmed: MT app shows "Sell Electricity" for mode 3
            0x04: 'UPS/EPS',
            0x05: 'Force Charge',
            0x06: 'Grid Export',
            0x07: 'Schedule/TOU'
        };
        const modeText = modes[mode] || `Unknown (0x${mode.toString(16).padStart(2, '0')})`;
        return `${mode} (${modeText})`;  // Format: "1 (Standby)"
    }

    private parseFirmwareTimestamp(offset: number): string {
        try {
            const timestampStr = this.readString(offset, 12);
            if (timestampStr.length >= 10 && /^\d+/.test(timestampStr)) {
                // Format: YYYYMMDDhhmm -> YYYY-MM-DD hh:mm
                // Handle both 12-byte (YYYYMMDDhhmm) and shorter versions
                const cleaned = timestampStr.padEnd(12, '0').slice(0, 12);
                return `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)} ${cleaned.slice(8,10)}:${cleaned.slice(10,12)}`;
            }
        } catch (e) {
            console.warn(`Failed to parse firmware timestamp at offset ${offset}:`, e);
        }
        return 'Unknown';
    }

    public toHTML(): string {
        try {
            const data = this.parse();
            
            let html = '<h3>⚡ Runtime Information</h3><div class="data-grid">';
            
            // Power readings (signed, can be negative for import/export)
            html += `<div><strong>Backup Power:</strong> ${data.gridPower} W</div>`;
            html += `<div><strong>Battery Power:</strong> ${data.solarPower} W</div>`;
            
            // Status
            html += `<div><strong>Work Mode:</strong> ${this.getWorkModeString(data.workMode)}</div>`;
            html += `<div><strong>Status Flags B/C/D:</strong> ${data.statusB}/${data.statusC}/${data.statusD} (0x${data.statusB.toString(16).padStart(2,'0')}/0x${data.statusC.toString(16).padStart(2,'0')}/0x${data.statusD.toString(16).padStart(2,'0')})</div>`;
            
            // Enhanced status interpretation
            if (data.statusFlags) {
                const sf = data.statusFlags;
                html += `<div class="status-details" style="margin-left: 10px; font-size: 0.9em; color: #666;">`;
                
                // Connection Status
                html += `<div>📡 <strong>Connections:</strong> `;
                const connections = [];
                if (sf.p1MeterConnected) connections.push('P1 Meter');
                if (sf.ecoTrackerConnected) connections.push('Eco-Tracker');
                if (sf.serverConnected) connections.push('Server');
                html += connections.length > 0 ? connections.join(', ') : 'None';
                html += `</div>`;
                
                // System Status
                html += `<div>🔧 <strong>System:</strong> `;
                const systemStatus = [];
                if (sf.networkActive) systemStatus.push('Network Active');
                if (sf.httpActive) systemStatus.push('HTTP Active');  
                if (sf.dataQualityOk) systemStatus.push('Data Quality OK');
                html += systemStatus.length > 0 ? systemStatus.join(', ') : 'Idle';
                html += `</div>`;
                
                // Error State
                if (sf.errorState > 0) {
                    const errorTypes = ['None', 'Meter Disconnect', 'Connection Error', 'HTTP Error', 'Timeout', 'Data Error', 'P1 Warning', 'Eco-Tracker Warning'];
                    html += `<div>⚠️ <strong>Error State:</strong> ${errorTypes[sf.errorState] || `Error ${sf.errorState}`}</div>`;
                }
                
                // Work Mode State (if different from main work mode)
                if (sf.workModeState !== data.workMode) {
                    html += `<div>⚙️ <strong>Work Mode State:</strong> ${sf.workModeState}</div>`;
                }
                
                html += `</div>`;
            }
            
            // Device info
            html += `<div><strong>Product Code:</strong> 0x${data.productCode.toString(16).padStart(4, '0')}</div>`;
            html += `<div><strong>Power Rating:</strong> ${data.powerRating} W</div>`;
            
            // Telemetry
            html += `<div><strong>Meter 1:</strong> ${data.meter1}</div>`;
            html += `<div><strong>Discharged Energy:</strong> ${(data.meter2 / 100).toFixed(2)} kWh</div>`;
            html += `<div><strong>Meter 3:</strong> ${data.meter3}</div>`;
            
            // Energy accumulators (likely Wh)
            html += `<div><strong>Energy Total 1:</strong> ${data.energyTotal1} Wh</div>`;
            html += `<div><strong>Energy Total 2:</strong> ${data.energyTotal2} Wh</div>`;
            
            // Firmware
            html += `<div><strong>Firmware Version:</strong> ${data.firmwareVersion}</div>`;
            html += `<div><strong>Build Code:</strong> ${data.buildCode}</div>`;
            html += `<div><strong>Firmware Build:</strong> ${data.firmwareBuild}</div>`;
            
            // Calibration/variant tags (unitless)
            html += `<div><strong>Cal/Variant Tag 1:</strong> ${data.calTag1}</div>`;
            html += `<div><strong>Cal/Variant Tag 2:</strong> ${data.calTag2}</div>`;
            html += `<div><strong>Cal/Variant Tag 3:</strong> ${data.calTag3}</div>`;
            if (data.reservedCounter !== undefined) {
                html += `<div><strong>Reserved/Counter:</strong> ${data.reservedCounter}</div>`;
            }
            
            // EPS/Backup Power Status
            if (data.epsEnabled !== undefined) {
                const epsStatus = data.epsEnabled ?
                    '<span style="color: #28a745;">🔋 ENABLED</span>' :
                    '<span style="color: #dc3545;">⚡ DISABLED</span>';
                html += `<div><strong>Backup Power:</strong> ${epsStatus}</div>`;
            }

            // API Status based on port value
            const apiStatus = data.apiPort === 0 ? 
                '<span style="color: #dc3545;">🔒 DISABLED</span>' : 
                `<span style="color: #28a745;">🔓 ENABLED (Port: ${data.apiPort})</span>`;
            html += `<div><strong>Local API:</strong> ${apiStatus}</div>`;
            
            html += `<div><strong>Device Type:</strong> ${data.powerRating}W Battery System</div>`;
            html += '</div>';
            
            return html;
        } catch (error) {
            return `<h3>⚡ Runtime Information</h3><div class="error">Failed to parse runtime data: ${(error as Error).message}</div>`;
        }
    }
}