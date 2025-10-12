/**
 * Patch Ping Response (0xF3)
 * Verifies firmware patch is installed and returns version
 */

import { BasePayload } from '../base/Payload.js';

export class PatchPing extends BasePayload {
    public parse() {
        const version = this.payloadLength === 9
            ? String.fromCharCode(...Array.from(this.payload.slice(0, 9)))
            : 'UNKNOWN';

        const installed = version === 'PATCH_001';

        return {
            command: '0xF3',
            commandName: 'Patch Ping',
            installed,
            version,
            success: installed
        };
    }

    public toHTML(): string {
        const data = this.parse();
        const statusClass = data.installed ? 'status-success' : 'status-error';
        const statusText = data.installed ? '✓ Installed' : '✗ Not Found';

        return `
            <h3>🔍 Firmware Patch Status</h3>
            <div class="data-grid">
                <div><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></div>
                <div><strong>Version:</strong> ${data.version}</div>
                <div class="patch-info">
                    ${data.installed ?
                        '<span class="info-text">Patch commands 0xF0-0xF3 are available</span>' :
                        '<span class="warning-text">Patch not detected - commands unavailable</span>'
                    }
                </div>
            </div>
        `;
    }
}
