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
                workMode: this.getUserWorkModeString(workMode)
            }
        };
    }

    private getUserWorkModeString(mode: number): string {
        // User work mode mapping for developer mode
        const modes: { [key: number]: string } = {
            0: 'Self Consumption',
            1: 'AI Optimization', 
            2: 'Manual Mode'
        };
        const modeText = modes[mode] || `Unknown (${mode})`;
        return `${mode} (${modeText})`;
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Developer Mode Info</h3>
            <div class="data-grid">
                <div><strong>System Status:</strong> ${data.interpretations.systemStatus}</div>
                <div><strong>Line Frequency:</strong> ${data.interpretations.lineFrequency}</div>
                <div><strong>AC Voltage:</strong> ${data.interpretations.acVoltage}</div>
                <div><strong>User Work Mode:</strong> ${data.interpretations.workMode}</div>
            </div>
            <div class="data-grid" style="margin-top: 10px;">
                <div style="grid-column: 1 / -1;"><strong>Temperature Sensors:</strong></div>
                ${data.temperatures.map((temp, idx) => {
                    const tempKey = `temp${idx + 1}`;
                    const tempValue = data.interpretations.temperatures[tempKey as keyof typeof data.interpretations.temperatures];
                    
                    // Map sensors to descriptive names based on LilyGo correlation
                    let sensorName = `Sensor ${idx + 1}`;
                    switch(idx + 1) {
                        case 1: sensorName = 'Internal Temperature'; break;
                        case 2: sensorName = 'Internal MOS1 Temperature'; break;
                        case 3: sensorName = 'Internal MOS2 Temperature'; break;
                        case 4: sensorName = 'Ambient Temperature 1'; break;
                        case 5: sensorName = 'Ambient Temperature 2'; break;
                        default: sensorName = `Temperature Sensor ${idx + 1}`; break;
                    }
                    
                    return `<div><strong>${sensorName}:</strong> ${tempValue}</div>`;
                }).join('')}
            </div>
        `;
    }
}