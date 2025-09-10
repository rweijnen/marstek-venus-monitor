import { BasePayload } from '../base/Payload.js';

/**
 * Work mode configuration payload (Command 0x09)
 * Contains work mode settings and operational parameters
 */
export class WorkModeConfig extends BasePayload {
    public parse() {
        // Parse work mode configuration
        let offset = 0;
        
        const mode = this.payload[offset++];
        let sequence = 0, dischargeThreshold = 0, chargeThreshold = 0;
        let bmsSocLow = 0, bmsSocHigh = 0, controlRatio = 0;
        const parameters: number[] = [];
        
        if (mode === 1 && this.payload.length > 1) {
            // Advanced configuration when mode = 1
            sequence = this.payload[offset++];
            dischargeThreshold = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0;
            offset += 2;
            chargeThreshold = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0;
            offset += 2;
            bmsSocLow = offset < this.payload.length ? this.payload[offset++] : 0;
            bmsSocHigh = offset < this.payload.length ? this.payload[offset++] : 0;
            controlRatio = offset < this.payload.length ? this.payload[offset++] : 0;
            
            // Additional parameters
            while (offset < this.payload.length) {
                parameters.push(this.payload[offset++]);
            }
        }

        return {
            type: 'WorkModeConfig',
            mode,
            modeDescription: this.getModeDescription(mode),
            sequence,
            dischargeThreshold,
            chargeThreshold,
            bmsSocLow,
            bmsSocHigh,
            controlRatio,
            parameters
        };
    }

    private getModeDescription(mode: number): string {
        switch (mode) {
            case 0: return 'Off';
            case 1: return 'Advanced Configuration';
            case 5: return 'Special Mode 5';
            default: return `Unknown Mode ${mode}`;
        }
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Work Mode Configuration</h3>
            <div class="data-grid">
                <div><strong>Mode:</strong> ${data.mode} (${data.modeDescription})</div>
                <div><strong>Sequence:</strong> ${data.sequence}</div>
                <div><strong>Discharge Threshold:</strong> ${data.dischargeThreshold}</div>
                <div><strong>Charge Threshold:</strong> ${data.chargeThreshold}</div>
                <div><strong>BMS SOC Low:</strong> ${data.bmsSocLow}%</div>
                <div><strong>BMS SOC High:</strong> ${data.bmsSocHigh}%</div>
                <div><strong>Control Ratio:</strong> ${data.controlRatio}</div>
                ${data.parameters.length > 0 ? `<div><strong>Parameters:</strong> [${data.parameters.join(', ')}]</div>` : ''}
            </div>
        `;
    }
}