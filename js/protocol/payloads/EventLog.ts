import { BasePayload } from '../base/Payload.js';

export interface EventRecord {
    timestamp: Date;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    flag: number;
    reserved: number[];
    isValid: boolean;
}

export class EventLog extends BasePayload {
    private static readonly RECORD_SIZE = 14;
    private static readonly PAYLOAD_HEADER_SIZE = 14;
    private readonly fullData: Uint8Array;
    
    constructor(data: Uint8Array) {
        super(data);
        this.fullData = data;
    }

    parse(): any {
        const records: EventRecord[] = [];
        let validRecords = 0;
        let totalRecords = 0;

        // Skip payload header (14 bytes after frame header)
        const recordsStart = EventLog.PAYLOAD_HEADER_SIZE;
        
        // Parse records until we hit padding or end
        for (let offset = recordsStart; offset + EventLog.RECORD_SIZE <= this.payload.length; offset += EventLog.RECORD_SIZE) {
            // Check if we hit padding (all zeros)
            if (this.isAllZeros(this.payload, offset, EventLog.RECORD_SIZE)) {
                break;
            }
            
            const record = this.parseRecord(this.payload, offset);
            records.push(record);
            totalRecords++;
            
            if (record.isValid) {
                validRecords++;
            }
        }

        return {
            records,
            summary: {
                totalRecords,
                validRecords,
                payloadHeader: this.getPayloadHeader(),
                recordsAreaSize: this.payload.length - EventLog.PAYLOAD_HEADER_SIZE
            }
        };
    }

    private parseRecord(data: Uint8Array, offset: number): EventRecord {
        // Structure: uint16 year (LE), uint8 month, day, hour, minute, uint8 flag, uint8[7] reserved
        const year = data[offset] | (data[offset + 1] << 8);
        const month = data[offset + 2];
        const day = data[offset + 3];
        const hour = data[offset + 4];
        const minute = data[offset + 5];
        const flag = data[offset + 6];
        
        const reserved: number[] = [];
        for (let i = 0; i < 7; i++) {
            reserved.push(data[offset + 7 + i]);
        }

        // Validate timestamp
        const isValid = year >= 2000 && year <= 2100 && 
                       month >= 1 && month <= 12 && 
                       day >= 1 && day <= 31;
        
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
            flag,
            reserved,
            isValid
        };
    }

    private isAllZeros(data: Uint8Array, offset: number, length: number): boolean {
        for (let i = 0; i < length; i++) {
            if (data[offset + i] !== 0) {
                return false;
            }
        }
        return true;
    }

    private getPayloadHeader(): number[] {
        const header: number[] = [];
        for (let i = 0; i < EventLog.PAYLOAD_HEADER_SIZE && i < this.payload.length; i++) {
            header.push(this.payload[i]);
        }
        return header;
    }

    toHTML(): string {
        const data = this.parse();
        const { records, summary } = data;
        
        let html = `
            <div class="event-log-container">
                <h3>📋 BLE Event Log</h3>
                <hr>
        `;

        if (records.length > 0) {
            html += `
                <div class="event-records">
                    <h4>${summary.totalRecords} Event Records:</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Timestamp</th>
                                <th>Flag</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            records.forEach((record: EventRecord, index: number) => {
                const timestampStr = record.isValid
                    ? record.timestamp.toLocaleString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : `${record.year}-${record.month.toString().padStart(2, '0')}-${record.day.toString().padStart(2, '0')} ${record.hour.toString().padStart(2, '0')}:${record.minute.toString().padStart(2, '0')}`;
                
                const flagStr = `0x${record.flag.toString(16).padStart(2, '0')}`;
                const statusStr = record.isValid ? '✅ Valid' : '❌ Invalid';
                const rowClass = record.isValid ? 'valid-row' : 'invalid-row';
                
                html += `
                    <tr class="${rowClass}">
                        <td>${index + 1}</td>
                        <td>${timestampStr}</td>
                        <td>${flagStr}</td>
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