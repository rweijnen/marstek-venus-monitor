import { BasePayload } from '../base/Payload.js';

export interface HMEventRecord {
    timestamp: Date;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    type: number;
    code: number;
    isValid: boolean;
}

export class HMEventLog extends BasePayload {
    private static readonly RECORD_SIZE = 9;
    
    parse(): any {
        const records: HMEventRecord[] = [];
        let validRecords = 0;
        let totalRecords = 0;

        // Scan for valid year markers and parse 9-byte records
        for (let offset = 0; offset <= this.payload.length - HMEventLog.RECORD_SIZE; offset++) {
            // Look for plausible year (2000-2100) in little-endian format
            const year = this.payload[offset] | (this.payload[offset + 1] << 8);
            
            if (year >= 2000 && year <= 2100) {
                // Check if we have enough bytes for a complete record
                if (offset + HMEventLog.RECORD_SIZE <= this.payload.length) {
                    const record = this.parseRecord(this.payload, offset);
                    records.push(record);
                    totalRecords++;
                    
                    if (record.isValid) {
                        validRecords++;
                    }
                    
                    // Skip ahead by record size to avoid overlapping
                    offset += HMEventLog.RECORD_SIZE - 1; // -1 because loop will increment
                }
            }
        }

        return {
            records,
            summary: {
                totalRecords,
                validRecords,
                payloadSize: this.payload.length
            }
        };
    }

    private parseRecord(data: Uint8Array, offset: number): HMEventRecord {
        // 9-byte structure: YearLE(2) + Month(1) + Day(1) + Hour(1) + Minute(1) + Type(1) + CodeLE(2)
        const year = data[offset] | (data[offset + 1] << 8);
        const month = data[offset + 2];
        const day = data[offset + 3];
        const hour = data[offset + 4];
        const minute = data[offset + 5];
        const type = data[offset + 6];
        const code = data[offset + 7] | (data[offset + 8] << 8);

        // Validate timestamp
        const isValid = year >= 2000 && year <= 2100 && 
                       month >= 1 && month <= 12 && 
                       day >= 1 && day <= 31 &&
                       hour <= 23 && minute <= 59;
        
        // Create timestamp (handle invalid dates gracefully)
        let timestamp: Date;
        try {
            if (isValid) {
                timestamp = new Date(year, month - 1, day, hour, minute);
            } else {
                timestamp = new Date(0);
            }
        } catch {
            timestamp = new Date(0);
        }

        return {
            timestamp,
            year,
            month,
            day,
            hour,
            minute,
            type,
            code,
            isValid
        };
    }

    toHTML(): string {
        const data = this.parse();
        const { records, summary } = data;
        
        let html = `
            <div class="hm-event-log-container">
                <div class="summary">
                    <h3>📅 HM Event Log Summary</h3>
                    <p>Total Records: <strong>${summary.totalRecords}</strong></p>
                    <p>Valid Events: <strong>${summary.validRecords}</strong></p>
                    <p>Payload Size: <strong>${summary.payloadSize}</strong> bytes</p>
                </div>
        `;

        if (records.length > 0) {
            html += `
                <div class="hm-event-records">
                    <h4>📋 HM Event Records (9-byte format):</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Timestamp</th>
                                <th>Type</th>
                                <th>Code</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            records.forEach((record: HMEventRecord, index: number) => {
                const timestampStr = record.isValid
                    ? record.timestamp.toLocaleString() 
                    : `${record.year}-${record.month.toString().padStart(2, '0')}-${record.day.toString().padStart(2, '0')} ${record.hour.toString().padStart(2, '0')}:${record.minute.toString().padStart(2, '0')}`;
                
                const typeStr = `0x${record.type.toString(16).padStart(2, '0').toUpperCase()}`;
                const codeStr = `0x${record.code.toString(16).padStart(4, '0').toUpperCase()}`;
                const statusStr = record.isValid ? '✅ Valid' : '❌ Invalid';
                const rowClass = record.isValid ? 'valid-row' : 'invalid-row';
                
                html += `
                    <tr class="${rowClass}">
                        <td>${index + 1}</td>
                        <td>${timestampStr}</td>
                        <td>${typeStr}</td>
                        <td>${codeStr}</td>
                        <td>${statusStr}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `</div>`;
        
        return html;
    }
}