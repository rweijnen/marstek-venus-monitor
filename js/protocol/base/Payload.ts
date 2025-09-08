/**
 * Base Payload Parser
 * Abstract base class for all payload parsers
 */

import { FrameHeader } from './Header.js';

export abstract class BasePayload {
    protected readonly header: FrameHeader;
    protected readonly payload: Uint8Array;
    protected readonly view: DataView;

    constructor(data: Uint8Array) {
        this.header = new FrameHeader(data);
        
        if (!this.header.isValid) {
            throw new Error(`Invalid frame header: ${this.header.toString()}`);
        }

        this.payload = this.header.getPayload(data);
        this.view = new DataView(this.payload.buffer, this.payload.byteOffset, this.payload.byteLength);
    }

    // Helper methods for reading data with proper bounds checking
    protected readUint8(offset: number): number {
        if (offset >= this.payload.length) {
            throw new Error(`Offset ${offset} out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint8(offset);
    }

    protected readUint16LE(offset: number): number {
        if (offset + 1 >= this.payload.length) {
            throw new Error(`Offset ${offset}+1 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint16(offset, true); // little endian
    }

    protected readUint16BE(offset: number): number {
        if (offset + 1 >= this.payload.length) {
            throw new Error(`Offset ${offset}+1 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint16(offset, false); // big endian
    }

    protected readInt16LE(offset: number): number {
        if (offset + 1 >= this.payload.length) {
            throw new Error(`Offset ${offset}+1 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getInt16(offset, true); // little endian
    }

    protected readUint32LE(offset: number): number {
        if (offset + 3 >= this.payload.length) {
            throw new Error(`Offset ${offset}+3 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint32(offset, true); // little endian
    }

    protected readString(offset: number, maxLength: number): string {
        if (offset >= this.payload.length) {
            throw new Error(`Offset ${offset} out of bounds (payload length: ${this.payload.length})`);
        }

        const endOffset = Math.min(offset + maxLength, this.payload.length);
        const bytes = this.payload.slice(offset, endOffset);
        
        // Find null terminator
        const nullIndex = bytes.indexOf(0);
        const validBytes = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes;
        
        try {
            return new TextDecoder('utf-8').decode(validBytes).trim();
        } catch (error) {
            // Fallback to ASCII if UTF-8 fails
            return Array.from(validBytes)
                .map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '')
                .join('')
                .trim();
        }
    }

    protected safeReadUint16LE(offset: number, defaultValue: number = 0): number {
        try {
            return this.readUint16LE(offset);
        } catch {
            return defaultValue;
        }
    }

    protected safeReadUint8(offset: number, defaultValue: number = 0): number {
        try {
            return this.readUint8(offset);
        } catch {
            return defaultValue;
        }
    }

    protected safeReadUint16BE(offset: number, defaultValue: number = 0): number {
        try {
            return this.readUint16BE(offset);
        } catch {
            return defaultValue;
        }
    }

    protected safeReadInt16LE(offset: number, defaultValue: number = 0): number {
        try {
            return this.readInt16LE(offset);
        } catch {
            return defaultValue;
        }
    }

    protected safeReadUint32LE(offset: number, defaultValue: number = 0): number {
        try {
            return this.readUint32LE(offset);
        } catch {
            return defaultValue;
        }
    }

    // Abstract method that must be implemented by concrete payload classes
    public abstract parse(): any;
    
    // Optional method for generating HTML display
    public toHTML(): string {
        const data = this.parse();
        let html = `<h3>${this.header.getCommandName()}</h3><div class="data-grid">`;
        
        for (const [key, value] of Object.entries(data)) {
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            html += `<div><strong>${displayKey}:</strong> ${value}</div>`;
        }
        
        html += '</div>';
        return html;
    }

    // Getters for header information
    public get commandType(): number {
        return this.header.command;
    }

    public get commandName(): string {
        return this.header.getCommandName();
    }

    public get payloadLength(): number {
        return this.payload.length;
    }
}