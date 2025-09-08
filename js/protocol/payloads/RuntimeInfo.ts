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
        const energyTotal1 = this.readUint32LE(0x2A); // Energy counter 1
        const energyTotal2 = this.readUint32LE(0x2E); // Energy counter 2

        // Parse counter/flag
        const counter = this.safeReadUint16LE(0x40); // Counter at raw offset 0x44

        // Parse device specifications
        const powerRatingRaw = this.safeReadUint16LE(0x46); // Raw offset 0x4A
        const powerRating = powerRatingRaw;
        
        // Parse firmware version
        const fwMajor = this.safeReadUint8(0x48);   // Raw offset 0x4C
        const fwMinor = this.safeReadUint8(0x49);   // Raw offset 0x4D
        const firmwareVersion = `v${fwMajor}.${fwMinor}`;

        // Parse build code (big endian)
        const buildCode = this.safeReadUint16BE(0x4A); // Raw offset 0x4E-0x4F

        // Parse firmware timestamp (12 ASCII bytes)
        const firmwareBuild = this.parseFirmwareTimestamp(0x4D); // Raw offset 0x51

        // Parse calibration tags with bounds checking
        const reservedCounter = this.safeReadUint16LE(0x5A); // Raw offset 0x5E
        const calTag1 = this.safeReadUint16LE(0x5C);        // Raw offset 0x60
        const calTag2 = this.safeReadUint8(0x5E);           // Raw offset 0x62
        const calTag3 = this.safeReadUint16BE(0x5F);        // Raw offset 0x63 (BE)
        const calTag4 = this.safeReadUint16LE(0x61);        // Raw offset 0x65
        const apiPort = this.safeReadUint16LE(0x63);        // Raw offset 0x67

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
            calTag4,
            apiPort
        };
    }

    private parseFirmwareTimestamp(offset: number): string {
        try {
            const timestampStr = this.readString(offset, 12);
            if (timestampStr.length >= 12 && /^\d+/.test(timestampStr)) {
                // Format: YYYYMMDDhhmm -> YYYY-MM-DD hh:mm
                const cleaned = timestampStr.slice(0, 12);
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
            html += `<div><strong>API Port:</strong> ${data.apiPort}</div>`;
            
            html += `<div><strong>Device Type:</strong> ${modelType} Battery System</div>`;
            html += '</div>';
            
            return html;
        } catch (error) {
            return `<h3>⚡ Runtime Information</h3><div class="error">Failed to parse runtime data: ${error.message}</div>`;
        }
    }
}