import { BasePayload } from '../base/Payload.js';

export interface HMMetadata {
    baseYear: number;
    version: number;
    type: number;
    head: number;
    tail: number;
    capacity: number;
    recordSize?: number;
    reserved?: number;
}

export class HMSummary extends BasePayload {
    
    parse(): any {
        const metadata: Partial<HMMetadata> = {};
        
        if (this.payload.length >= 14) {
            let offset = 0;
            
            // Base Year (2 bytes, little-endian) - typically 0x07D0 (2000)
            metadata.baseYear = this.payload[offset] | (this.payload[offset + 1] << 8);
            offset += 2;
            
            // Version and Type bytes (often 01 01)
            metadata.version = this.payload[offset++];
            metadata.type = this.payload[offset++];
            
            // Head and Tail index/counter slots
            metadata.head = this.payload[offset++];
            metadata.tail = this.payload[offset++];
            
            // Capacity / max-records (you've seen 00 08 → 8)
            metadata.capacity = this.payload[offset] | (this.payload[offset + 1] << 8);
            offset += 2;
            
            // Remaining bytes - could be record size or reserved
            if (offset < this.payload.length) {
                metadata.recordSize = this.payload[offset] | (this.payload[offset + 1] << 8);
                offset += 2;
            }
            
            if (offset < this.payload.length) {
                metadata.reserved = this.payload[offset] | (this.payload[offset + 1] << 8);
            }
        }

        // Raw hex for debugging
        const rawHex = Array.from(this.payload)
            .map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`)
            .join(' ');

        return {
            metadata,
            raw: {
                length: this.payload.length,
                hex: rawHex
            }
        };
    }

    toHTML(): string {
        const data = this.parse();
        const { metadata, raw } = data;
        
        let html = `
            <div class="hm-summary-container">
                <h3>📊 HM Summary / Metadata</h3>
                <p>Payload Length: <strong>${raw.length}</strong> bytes</p>

                <div class="metadata">
                    <h4>📋 Parsed Metadata:</h4>
                    <table class="data-table">
                        <tr>
                            <td><strong>Base Year:</strong></td>
                            <td>${metadata.baseYear || 'N/A'} ${metadata.baseYear === 2000 ? '(2000)' : ''}</td>
                        </tr>
                        <tr>
                            <td><strong>Version:</strong></td>
                            <td>0x${(metadata.version || 0).toString(16).padStart(2, '0').toUpperCase()}</td>
                        </tr>
                        <tr>
                            <td><strong>Type:</strong></td>
                            <td>0x${(metadata.type || 0).toString(16).padStart(2, '0').toUpperCase()}</td>
                        </tr>
                        <tr>
                            <td><strong>Head Index:</strong></td>
                            <td>${metadata.head !== undefined ? metadata.head : 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Tail Index:</strong></td>
                            <td>${metadata.tail !== undefined ? metadata.tail : 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Capacity:</strong></td>
                            <td>${metadata.capacity || 'N/A'} records</td>
                        </tr>`;
        
        if (metadata.recordSize !== undefined) {
            html += `
                        <tr>
                            <td><strong>Record Size:</strong></td>
                            <td>${metadata.recordSize} bytes</td>
                        </tr>`;
        }
        
        if (metadata.reserved !== undefined) {
            html += `
                        <tr>
                            <td><strong>Reserved:</strong></td>
                            <td>0x${metadata.reserved.toString(16).padStart(4, '0').toUpperCase()}</td>
                        </tr>`;
        }

        html += `
                    </table>
                </div>
            </div>
        `;
        
        return html;
    }
}