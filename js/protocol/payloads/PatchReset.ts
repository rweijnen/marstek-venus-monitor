/**
 * Patch Reset Response (0xF0)
 * Resets stored date and energy counters to fix rollover bug
 */

import { BasePayload } from '../base/Payload.js';

export class PatchReset extends BasePayload {
    public parse() {
        const success = this.payloadLength >= 1 && this.payload[0] === 0x01;

        return {
            command: '0xF0',
            commandName: 'Counter Reset',
            success,
            status: success ? 'Counters reset successfully' : 'Reset failed',
            message: success
                ? 'Stored date cleared and energy counters reset'
                : 'Command failed or patch not installed'
        };
    }

    public toHTML(): string {
        const data = this.parse();
        const statusClass = data.success ? 'status-success' : 'status-error';
        const icon = data.success ? '✓' : '✗';

        return `
            <h3>🔄 Counter Reset</h3>
            <div class="data-grid">
                <div><strong>Result:</strong> <span class="${statusClass}">${icon} ${data.status}</span></div>
                <div><strong>Details:</strong> ${data.message}</div>
                ${data.success ? `
                    <div class="patch-info">
                        <span class="info-text">
                            The counter rollover bug has been fixed.
                            Daily and monthly energy counters have been reset.
                        </span>
                    </div>
                ` : ''}
            </div>
        `;
    }
}
