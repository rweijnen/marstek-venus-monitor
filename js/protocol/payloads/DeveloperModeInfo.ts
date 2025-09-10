import { BasePayload } from '../base/Payload.js';

/**
 * Developer Mode Info payload (Command 0x0D)
 * Contains system status, AC line measurements, and temperature readings
 * Firmware calls this "Develop mode info" and sends 19 bytes
 * Structure based on sub_8008EDC() analysis
 */
export class DeveloperModeInfo extends BasePayload {
    public parse() {
        let offset = 0;
        
        // Parse the 19-byte developer mode payload according to firmware structure
        // Based on sub_8008EDC() analysis and captured data
        
        const systemStatus = offset < this.payload.length ? this.payload[offset++] : 0; // byte_2000051E - system/dev status flag
        
        // Parse 16-bit values according to firmware structure (little-endian)
        const lineFrequency = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // (u16)flt_200002F0 - line frequency (Hz)
        offset += 2;
        const acVoltage = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // (u16)flt_2000285C - AC line voltage (V)
        offset += 2;
        const reserved = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // (u16)flt_20002868 - reserved/unused
        offset += 2;
        const temperature1 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // (u16)flt_20001CCC - temperature #1 (°C)
        offset += 2;
        const temperature2 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // (u16)flt_20001CD0 - temperature #2 (°C)
        offset += 2;
        const temperature3 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // (u16)flt_20001CD4 - temperature #3 (°C)
        offset += 2;
        const temperature4 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // word_20002F62 - temperature #4 (°C)
        offset += 2;
        const temperature5 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // sub_8014600(&d20002F73,4) - temperature #5 / derived
        offset += 2;
        
        const workMode = offset < this.payload.length ? this.payload[offset++] : 0; // (u8)byte_200030F0 - work mode (low 8 bits)
        
        return {
            type: 'DeveloperModeInfo',
            systemStatus,
            lineFrequency,
            acVoltage,
            reserved,
            temperatures: [temperature1, temperature2, temperature3, temperature4, temperature5],
            workMode,
            // Interpret values based on firmware analysis
            interpretations: {
                systemStatus: systemStatus === 1 ? 'Dev Mode ON' : `Status ${systemStatus}`,
                lineFrequency: `${lineFrequency} Hz`,
                acVoltage: `${acVoltage} V`,
                temperatures: {
                    temp1: `${temperature1}°C`,
                    temp2: `${temperature2}°C`,
                    temp3: `${temperature3}°C`,
                    temp4: `${temperature4}°C`,
                    temp5: `${temperature5}°C`
                },
                workMode: `Work Mode: ${workMode}`
            }
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Developer Mode Info</h3>
            <div class="data-grid">
                <div><strong>System Status:</strong> ${data.interpretations.systemStatus}</div>
                <div><strong>Line Frequency:</strong> ${data.interpretations.lineFrequency}</div>
                <div><strong>AC Voltage:</strong> ${data.interpretations.acVoltage}</div>
                <div><strong>Work Mode:</strong> ${data.workMode}</div>
                <br>
                <div><strong>Temperature Sensors:</strong></div>
                ${data.temperatures.map((temp, idx) => {
                    const tempKey = `temp${idx + 1}`;
                    const tempValue = data.interpretations.temperatures[tempKey];
                    return `<div style="margin-left: 20px;"><strong>Sensor ${idx + 1}:</strong> ${tempValue}</div>`;
                }).join('')}
            </div>
        `;
    }
}