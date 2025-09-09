/**
 * Base Payload Parser
 * Abstract base class for all payload parsers
 */
import { FrameHeader } from './Header.js';
export class BasePayload {
    constructor(data) {
        this.header = new FrameHeader(data);
        if (!this.header.isValid) {
            throw new Error(`Invalid frame header: ${this.header.toString()}`);
        }
        this.payload = this.header.getPayload(data);
        this.view = new DataView(this.payload.buffer, this.payload.byteOffset, this.payload.byteLength);
    }
    // Helper methods for reading data with proper bounds checking
    readUint8(offset) {
        if (offset >= this.payload.length) {
            throw new Error(`Offset ${offset} out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint8(offset);
    }
    readUint16LE(offset) {
        if (offset + 1 >= this.payload.length) {
            throw new Error(`Offset ${offset}+1 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint16(offset, true); // little endian
    }
    readUint16BE(offset) {
        if (offset + 1 >= this.payload.length) {
            throw new Error(`Offset ${offset}+1 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint16(offset, false); // big endian
    }
    readInt16LE(offset) {
        if (offset + 1 >= this.payload.length) {
            throw new Error(`Offset ${offset}+1 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getInt16(offset, true); // little endian
    }
    readUint32LE(offset) {
        if (offset + 3 >= this.payload.length) {
            throw new Error(`Offset ${offset}+3 out of bounds (payload length: ${this.payload.length})`);
        }
        return this.view.getUint32(offset, true); // little endian
    }
    readString(offset, maxLength) {
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
        }
        catch (error) {
            // Fallback to ASCII if UTF-8 fails
            return Array.from(validBytes)
                .map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '')
                .join('')
                .trim();
        }
    }
    safeReadUint16LE(offset, defaultValue = 0) {
        try {
            return this.readUint16LE(offset);
        }
        catch (_a) {
            return defaultValue;
        }
    }
    safeReadUint8(offset, defaultValue = 0) {
        try {
            return this.readUint8(offset);
        }
        catch (_a) {
            return defaultValue;
        }
    }
    safeReadUint16BE(offset, defaultValue = 0) {
        try {
            return this.readUint16BE(offset);
        }
        catch (_a) {
            return defaultValue;
        }
    }
    safeReadInt16LE(offset, defaultValue = 0) {
        try {
            return this.readInt16LE(offset);
        }
        catch (_a) {
            return defaultValue;
        }
    }
    safeReadUint32LE(offset, defaultValue = 0) {
        try {
            return this.readUint32LE(offset);
        }
        catch (_a) {
            return defaultValue;
        }
    }
    // Optional method for generating HTML display
    toHTML() {
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
    get commandType() {
        return this.header.command;
    }
    get commandName() {
        return this.header.getCommandName();
    }
    get payloadLength() {
        return this.payload.length;
    }
}
