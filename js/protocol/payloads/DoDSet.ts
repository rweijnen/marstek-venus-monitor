/**
 * Depth of Discharge (DoD) Payload Parser (Command 0x54)
 * Handles DoD configuration for Marstek Venus E devices (v156+)
 *
 * Protocol:
 * - Send: [dod_value] (1 byte, valid range 30-88%)
 * - Response: [stored_dod_value] (1 byte)
 *
 * DoD determines how much of the battery capacity can be used.
 * Higher DoD = more usable capacity, lower battery protection.
 */

import { BasePayload } from '../base/Payload.js';

export interface IDoDSetInfo {
    depthOfDischarge: number;    // DoD percentage (30-88%)
}

export class DoDSetPayload extends BasePayload {
    public parse(): IDoDSetInfo {
        if (this.payloadLength < 1) {
            throw new Error(`DoD payload too short: ${this.payloadLength} bytes, need at least 1`);
        }

        const depthOfDischarge = this.readUint8(0x00);

        return {
            depthOfDischarge
        };
    }

    public toHTML(): string {
        try {
            const data = this.parse();

            let html = '<h3>Depth of Discharge Set (v156+)</h3><div class="data-grid">';

            html += `<div><strong>Depth of Discharge:</strong> ${data.depthOfDischarge}%</div>`;

            html += '</div>';
            return html;
        } catch (error) {
            return `<h3>Depth of Discharge Set</h3><div class="error">Failed to parse data: ${(error as Error).message}</div>`;
        }
    }
}
