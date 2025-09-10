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
            apiPort
        };
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
            
            // Power readings
            html += `<div><strong>Grid Power:</strong> ${data.gridPower}W</div>`;
            html += `<div><strong>Solar Power:</strong> ${data.solarPower}W</div>`;
            
            // Status
            html += `<div><strong>Work Mode:</strong> 0x${data.workMode.toString(16).padStart(2, '0')}</div>`;
            html += `<div><strong>Status Flags:</strong> ${data.statusB}/${data.statusC}/${data.statusD}</div>`;
            
            // Device info
            html += `<div><strong>Product Code:</strong> 0x${data.productCode.toString(16).padStart(4, '0')}</div>`;
            const modelType = data.powerRating === 2500 ? '2500W' : data.powerRating === 800 ? '800W' : `${data.powerRating}W`;
            html += `<div><strong>Power Rating:</strong> ${modelType}</div>`;
            
            // Telemetry
            html += `<div><strong>Meter 1:</strong> ${data.meter1}</div>`;
            html += `<div><strong>Meter 2:</strong> ${data.meter2}</div>`;
            html += `<div><strong>Meter 3:</strong> ${data.meter3}</div>`;
            
            // Energy
            html += `<div><strong>Energy Total 1:</strong> ${data.energyTotal1}</div>`;
            html += `<div><strong>Energy Total 2:</strong> ${data.energyTotal2}</div>`;
            
            // Firmware
            html += `<div><strong>Firmware Version:</strong> ${data.firmwareVersion}</div>`;
            html += `<div><strong>Build Code:</strong> ${data.buildCode}</div>`;
            html += `<div><strong>Firmware Build:</strong> ${data.firmwareBuild}</div>`;
            
            // Calibration tags
            html += `<div><strong>Cal Tag 1:</strong> ${data.calTag1}</div>`;
            html += `<div><strong>Cal Tag 2:</strong> ${data.calTag2}</div>`;
            html += `<div><strong>Cal Tag 3:</strong> ${data.calTag3}</div>`;
            html += `<div><strong>Cal Tag 4:</strong> ${data.calTag4}</div>`;
            
            // API Status based on port value
            const apiStatus = data.apiPort === 0 ? 
                '<span style="color: #dc3545;">🔒 DISABLED</span>' : 
                `<span style="color: #28a745;">🔓 ENABLED (Port: ${data.apiPort})</span>`;
            html += `<div><strong>Local API Status:</strong> ${apiStatus}</div>`;
            
            html += `<div><strong>Device Type:</strong> ${modelType} Battery System</div>`;
            html += '</div>';
            
            return html;
        } catch (error) {
            return `<h3>⚡ Runtime Information</h3><div class="error">Failed to parse runtime data: ${(error as Error).message}</div>`;
        }
    }
}