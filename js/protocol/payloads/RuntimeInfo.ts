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
        const gridPower = this.readInt16LE(0x00);  // Grid/backup power (W)
        const solarPower = this.readInt16LE(0x02); // Battery power (W)

        // Parse status flags
        const workMode = this.readUint8(0x04);     // Work mode (0-7)
        const statusB = this.readUint8(0x05);      // Status flag B
        const statusC = this.readUint8(0x06);      // Status flag C
        const statusD = this.readUint8(0x07);      // Status flag D

        // Parse product identification
        const productCode = this.readUint16LE(0x0C); // Model/product code

        // Parse daily/monthly energy buckets (kWh)
        const dailyCharge = this.readUint32LE(0x0E) / 100;      // Daily charging kWh (÷100)
        const monthlyCharge = this.readUint32LE(0x12) / 1000;   // Monthly charging kWh (÷1000, firmware quirk)
        const dailyDischarge = this.readUint32LE(0x16) / 100;   // Daily discharging kWh (÷100)
        const monthlyDischarge = this.readUint32LE(0x1A) / 100; // Monthly discharging kWh (÷100)

        // Parse lifetime energy totals (kWh)
        const totalCharge = this.readUint32LE(0x29) / 100;      // Total charging kWh (÷100)
        const totalDischarge = this.readUint32LE(0x2D) / 100;   // Total discharging kWh (÷100)

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

        // Parse calibration tags and device settings with bounds checking
        const reservedCounter = this.safeReadUint16LE(0x5E); // Reserved/Counter at payload offset 0x5E (raw 0x62)
        const parallelStatus = this.safeReadUint8(0x5F);     // Parallel machine status at payload offset 0x5F (0=OFF, 1=READY, 2=ON)
        const generatorEnabled = this.safeReadUint8(0x60);   // Generator enable status at payload offset 0x60 (0=OFF, 1=ON)
        const calTag1 = this.safeReadUint16LE(0x62);        // Cal/Variant tag 1 at payload offset 0x62 (raw 0x66)
        const calTag2 = this.safeReadUint16LE(0x64);        // Cal/Variant tag 2 at payload offset 0x64 (raw 0x68)
        const apiPort = this.safeReadUint16LE(0x66);        // Local API port at payload offset 0x66 (raw 0x6A)

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
            dailyCharge,
            monthlyCharge,
            dailyDischarge,
            monthlyDischarge,
            totalCharge,
            totalDischarge,
            firmwareVersion,
            buildCode,
            firmwareBuild,
            calTag1,
            calTag2,
            reservedCounter,
            parallelStatus,
            generatorEnabled,
            apiPort,
            epsEnabled,
            statusFlags
        };
    }

    private parseEPSStatus(statusB: number, statusC: number, statusD: number): boolean | undefined {
        // Based on real device testing, the EPS status from firmware analysis doesn't 
        // immediately reflect in the runtime status flags. The status flags appear to 
        // be consistent (1/1/1) regardless of EPS enable/disable state.
        // 
        // For now, return undefined to indicate we cannot reliably determine EPS status
        // from the status flags alone. Users should rely on the 0x0F command responses
        // for accurate EPS status.
        return undefined;
    }

    private parseStatusFlags(statusB: number, statusC: number, statusD: number) {
        // Based on firmware analysis of sub_8009E58, status flags likely encode:
        // Real device data shows consistent 1/1/1 pattern, so interpretations may need adjustment
        return {
            // StatusB interpretations (adjusted based on real data)
            epsEnabled: undefined,                         // EPS status not reliably encoded here
            p1MeterConnected: (statusB & 0x02) !== 0,     // Bit 1: P1 Meter connection  
            ecoTrackerConnected: (statusB & 0x04) !== 0,  // Bit 2: Eco-Tracker connection
            networkActive: (statusB & 0x08) !== 0,        // Bit 3: Network activity
            
            // StatusC interpretations
            workModeState: statusC & 0x0F,                 // Lower 4 bits: work mode state
            dataQualityOk: (statusC & 0x10) !== 0,        // Bit 4: Data quality
            
            // StatusD interpretations  
            errorState: statusD & 0x07,                    // Lower 3 bits: error state (0-6)
            serverConnected: (statusD & 0x08) !== 0,      // Bit 3: Server connection
            httpActive: (statusD & 0x10) !== 0,           // Bit 4: HTTP activity
            
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

            // Daily/Monthly Energy
            html += `<div><strong>Daily Charge:</strong> ${data.dailyCharge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Daily Discharge:</strong> ${data.dailyDischarge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Monthly Charge:</strong> ${data.monthlyCharge.toFixed(3)} kWh</div>`;
            html += `<div><strong>Monthly Discharge:</strong> ${data.monthlyDischarge.toFixed(2)} kWh</div>`;

            // Lifetime Totals
            html += `<div><strong>Total Charge:</strong> ${data.totalCharge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Total Discharge:</strong> ${data.totalDischarge.toFixed(2)} kWh</div>`;
            
            // Firmware
            html += `<div><strong>Firmware Version:</strong> ${data.firmwareVersion}</div>`;
            html += `<div><strong>Build Code:</strong> ${data.buildCode}</div>`;
            html += `<div><strong>Firmware Build:</strong> ${data.firmwareBuild}</div>`;
            
            // Calibration/variant tags (unitless)
            html += `<div><strong>Cal/Variant Tag 1:</strong> ${data.calTag1}</div>`;
            html += `<div><strong>Cal/Variant Tag 2:</strong> ${data.calTag2}</div>`;
            if (data.reservedCounter !== undefined) {
                html += `<div><strong>Reserved/Counter:</strong> ${data.reservedCounter}</div>`;
            }

            // Parallel machine and generator status
            const parallelModes = ['OFF', 'READY', 'ON'];
            const parallelMode = parallelModes[data.parallelStatus] || `Unknown (${data.parallelStatus})`;
            html += `<div><strong>Parallel Machine:</strong> ${parallelMode} (${data.parallelStatus})</div>`;

            const generatorStatus = data.generatorEnabled === 1 ?
                '<span style="color: #28a745;">ON (1)</span>' :
                '<span style="color: #6c757d;">OFF (0)</span>';
            html += `<div><strong>Generator:</strong> ${generatorStatus}</div>`;
            
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