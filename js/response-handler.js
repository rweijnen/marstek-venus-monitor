/**
 * Async Response Handler for BLE Protocol
 * Handles multi-packet responses while preserving OTA synchronous flow
 */

class AsyncResponseHandler {
    constructor() {
        // Response collection buffer for multi-packet responses
        this.responseBuffer = [];
        this.lastResponseTime = 0;
        this.bufferTimeout = null;
        this.bufferTimeoutMs = 500; // Wait up to 500ms for additional packets
        
        // Track command context
        this.lastCommand = null;
        this.lastCommandTime = 0;
        
        // Command 0x51 specific state
        this.urlConfigBuffer = [];
        this.expectedUrlPackets = 0;
    }

    /**
     * Main entry point for non-OTA notifications
     * Called only when otaInProgress === false
     * @param {Uint8Array} data - Raw notification data
     * @param {string} source - Source identifier (e.g., 'HM', 'Standard')
     */
    processNotification(data, source = 'Unknown') {
        // Safety check - should never be called during OTA
        if (window.otaInProgress) {
            console.error('❌ AsyncResponseHandler called during OTA - this should not happen!');
            return;
        }

        // Log incoming data
        this.logIncoming(data, source);

        // Add to buffer
        this.responseBuffer.push({
            data: data,
            timestamp: Date.now(),
            source: source
        });
        
        this.lastResponseTime = Date.now();

        // Reset timeout for collecting more packets
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
        }

        // Check if we have a complete message
        if (this.isCompleteMessage()) {
            this.processCompleteMessage();
        } else {
            // Wait for more packets
            this.bufferTimeout = setTimeout(() => {
                if (this.responseBuffer.length > 0) {
                    console.log(`⏱️ Timeout reached, processing ${this.responseBuffer.length} buffered packet(s)`);
                    this.processCompleteMessage();
                }
            }, this.bufferTimeoutMs);
        }
    }

    /**
     * Check if buffered responses form a complete message
     * @returns {boolean}
     */
    isCompleteMessage() {
        if (this.responseBuffer.length === 0) return false;
        
        const firstPacket = this.responseBuffer[0].data;
        
        // Basic validation
        if (firstPacket.length < 6 || firstPacket[0] !== 0x73) {
            return true; // Invalid packet, process immediately to log error
        }

        // Check command type
        const command = firstPacket[3];
        
        // Command 0x51 (Get URL Config) - may be multi-packet
        if (command === 0x51) {
            return this.isCommand51Complete();
        }
        
        // Command 0x42 (Device Info) - sometimes sends multiple packets
        if (command === 0x42) {
            return this.isCommand42Complete();
        }

        // Most commands are single packet with 0xED terminator
        if (firstPacket[firstPacket.length - 1] === 0xED) {
            return true;
        }

        // Default to single packet for unknown commands
        return true;
    }

    /**
     * Check if command 0x51 (URL Config) response is complete
     * @returns {boolean}
     */
    isCommand51Complete() {
        // URL config might be sent in chunks
        // Look for patterns indicating completion
        
        const totalLength = this.responseBuffer.reduce((sum, packet) => 
            sum + packet.data.length, 0);
        
        // If we have substantial data (URLs are typically 100+ bytes)
        if (totalLength > 150) {
            return true;
        }
        
        // Check if last packet has 0xED terminator
        const lastPacket = this.responseBuffer[this.responseBuffer.length - 1].data;
        if (lastPacket[lastPacket.length - 1] === 0xED) {
            // Check if this looks like a complete URL
            const combined = this.mergePackets(this.responseBuffer);
            const payloadStart = 5; // After header
            const payloadEnd = combined.length - 1; // Before 0xED
            
            if (payloadEnd > payloadStart) {
                const payload = combined.slice(payloadStart, payloadEnd);
                // Check for URL-like patterns or base64 data
                const str = String.fromCharCode.apply(null, payload);
                if (str.includes('mqtt') || str.includes('://') || 
                    this.isBase64Like(str)) {
                    return true;
                }
            }
        }
        
        // If we've been collecting for a while, assume complete
        if (this.responseBuffer.length > 0 && 
            Date.now() - this.responseBuffer[0].timestamp > 1000) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if command 0x42 (Device Info) response is complete
     * @returns {boolean}
     */
    isCommand42Complete() {
        // Device info typically sends 2-3 packets
        // Check for 0xED terminator on last packet
        const lastPacket = this.responseBuffer[this.responseBuffer.length - 1].data;
        if (lastPacket[lastPacket.length - 1] === 0xED) {
            return true;
        }
        
        // Or if we have multiple packets already
        return this.responseBuffer.length >= 2;
    }

    /**
     * Check if string looks like base64 encoded data
     * @param {string} str - String to check
     * @returns {boolean}
     */
    isBase64Like(str) {
        // Simple heuristic for base64-like data
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        return str.length > 20 && base64Regex.test(str.substring(0, 50));
    }

    /**
     * Process the complete message from buffer
     */
    processCompleteMessage() {
        if (this.responseBuffer.length === 0) return;

        try {
            // Merge packets if multiple
            let combinedData;
            if (this.responseBuffer.length === 1) {
                combinedData = this.responseBuffer[0].data;
            } else {
                combinedData = this.mergePackets(this.responseBuffer);
                console.log(`📦 Merged ${this.responseBuffer.length} packets (total ${combinedData.length} bytes)`);
            }

            // Parse and display
            this.parseAndDisplay(combinedData);
            
        } catch (error) {
            console.error('❌ Error processing response:', error);
        } finally {
            // Clear buffer
            this.responseBuffer = [];
            if (this.bufferTimeout) {
                clearTimeout(this.bufferTimeout);
                this.bufferTimeout = null;
            }
        }
    }

    /**
     * Merge multiple packets into single response
     * @param {Array} packets - Array of packet objects with data property
     * @returns {Uint8Array} - Combined data
     */
    mergePackets(packets) {
        // For multi-packet responses, we need to handle headers correctly
        // Typically, continuation packets might not have full headers
        
        if (packets.length === 1) {
            return packets[0].data;
        }

        // Strategy: First packet has full header, subsequent packets might be payload only
        const firstPacket = packets[0].data;
        
        // Check if subsequent packets are continuations (no header) or full frames
        const hasHeaders = packets.every(p => 
            p.data.length >= 6 && p.data[0] === 0x73 && p.data[p.data.length - 1] === 0xED
        );

        if (hasHeaders) {
            // Each packet is a complete frame - extract and combine payloads
            const payloads = [];
            
            packets.forEach(packet => {
                const data = packet.data;
                if (data.length > 6) {
                    // Extract payload (between header and 0xED)
                    const payload = data.slice(5, data.length - 1);
                    payloads.push(payload);
                }
            });

            // Combine with single frame structure
            const totalPayloadLength = payloads.reduce((sum, p) => sum + p.length, 0);
            const combined = new Uint8Array(6 + totalPayloadLength);
            
            // Copy header from first packet
            combined[0] = 0x73; // SOF
            combined[1] = totalPayloadLength + 4; // Adjusted length
            combined[2] = firstPacket[2]; // Frame type
            combined[3] = firstPacket[3]; // Command
            combined[4] = firstPacket[4]; // Sub-command or reserved
            
            // Combine payloads
            let offset = 5;
            payloads.forEach(payload => {
                combined.set(payload, offset);
                offset += payload.length;
            });
            
            combined[combined.length - 1] = 0xED; // EOF
            
            return combined;
        } else {
            // Simple concatenation for continuation packets
            const totalLength = packets.reduce((sum, p) => sum + p.data.length, 0);
            const combined = new Uint8Array(totalLength);
            
            let offset = 0;
            packets.forEach(packet => {
                combined.set(packet.data, offset);
                offset += packet.data.length;
            });
            
            return combined;
        }
    }

    /**
     * Parse and display the complete response
     * @param {Uint8Array} data - Complete response data
     */
    parseAndDisplay(data) {
        // Validate frame
        if (data.length < 6 || data[0] !== 0x73) {
            console.error(`❌ Invalid response frame: ${this.formatBytes(data)}`);
            return;
        }

        const command = data[3];
        const commandHex = '0x' + command.toString(16).padStart(2, '0');
        
        console.log(`📥 Processing complete response for command ${commandHex} (${data.length} bytes)`);

        // Clear the currentCommand to prevent timeout retry
        if (window.currentCommand) {
            window.currentCommand = null;
        }

        // Use existing parser
        if (window.dataParser && window.dataParser.parseResponse) {
            const context = this.lastCommand || `Command_${commandHex}`;
            const parsed = window.dataParser.parseResponse(data, context);
            
            if (window.uiController && window.uiController.displayData) {
                window.uiController.displayData(parsed);
            }
        } else {
            console.log(`📋 Raw response: ${this.formatBytes(data)}`);
        }

        // Special handling for command 0x51
        if (command === 0x51 && data.length > 10) {
            this.handleUrlConfigResponse(data);
        }
    }

    /**
     * Special handling for URL configuration response
     * @param {Uint8Array} data - Complete 0x51 response
     */
    handleUrlConfigResponse(data) {
        try {
            const payload = data.slice(5, data.length - 1);
            const str = String.fromCharCode.apply(null, payload);
            
            console.log('📡 URL Config Response:');
            console.log(`   Raw: ${this.formatBytes(payload)}`);
            console.log(`   ASCII: ${str}`);
            
            // Try to decode if it looks like base64
            if (this.isBase64Like(str)) {
                try {
                    const decoded = atob(str);
                    console.log(`   Decoded: ${decoded}`);
                } catch (e) {
                    console.log('   (Unable to decode as base64)');
                }
            }
        } catch (error) {
            console.error('Error processing URL config:', error);
        }
    }

    /**
     * Set command context for better parsing
     * @param {string} commandName - Name of command being sent
     */
    setCommandContext(commandName) {
        this.lastCommand = commandName;
        this.lastCommandTime = Date.now();
        
        // Auto-clear after 10 seconds
        setTimeout(() => {
            if (this.lastCommandTime && Date.now() - this.lastCommandTime > 10000) {
                this.lastCommand = null;
            }
        }, 10000);
    }

    /**
     * Clear all buffers and timeouts
     */
    reset() {
        this.responseBuffer = [];
        this.urlConfigBuffer = [];
        this.lastCommand = null;
        
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
            this.bufferTimeout = null;
        }
    }

    /**
     * Format bytes for logging
     * @param {Uint8Array} bytes - Bytes to format
     * @returns {string} - Hex string
     */
    formatBytes(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }

    /**
     * Log incoming data
     * @param {Uint8Array} data - Data received
     * @param {string} source - Source identifier
     */
    logIncoming(data, source) {
        console.log(`📥 ${source} (${data.length} bytes): ${this.formatBytes(data)}`);
        
        // Also log to protocol display if available
        if (window.logProtocol) {
            window.logProtocol(`📥 RX ← Device [${source}] (${data.length} bytes): ${this.formatBytes(data)}`, data, 'rx');
        }
    }
}

// Create global instance
window.asyncResponseHandler = new AsyncResponseHandler();