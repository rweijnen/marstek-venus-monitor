/**
 * Marstek Venus E Data Parser
 * 
 * This module handles parsing of responses from different BLE commands
 * and formatting data for display in the UI.
 */

// Device type detection (accessed via uiController)
// let deviceType = 'unknown'; // Removed - using uiController.getDeviceType()

/**
 * Parse BLE response data and format for display
 * @param {Uint8Array} data - Raw response data
 * @param {string} commandName - Name of the command that generated this response
 * @returns {string} HTML formatted output
 */
function parseResponse(data, commandName) {
    const commandByte = data[3]; // Command byte is at index 3
    let output = '';
    
    // Log technical details instead of showing in display
    if (window.uiController && window.uiController.log) {
        window.uiController.log(`📊 Raw Response (${data.length} bytes): ${formatBytes(data)}`);
        window.uiController.log(`📋 Hex Dump:\n${formatHexDump(data)}`);
        window.uiController.log(`🔍 Command: 0x${commandByte.toString(16).padStart(2, '0').toUpperCase()}, Payload: ${data.length - 5} bytes`);
    }
    
    // Extract payload (skip header bytes and checksum)
    const payload = data.slice(4, -1);
    
    switch (commandByte) {
        case 0x03: // Runtime Info
            const runtime = parseRuntimeInfo(payload);
            if (runtime) {
                output += '<h3>⚡ Runtime Information</h3>';
                output += '<div class="data-grid">';
                for (const [key, value] of Object.entries(runtime)) {
                    const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    output += `<div><strong>${displayKey}:</strong> ${value}</div>`;
                }
                output += '</div>';
            } else {
                output += '<h3>⚡ Runtime Information</h3>';
                output += `<div class="error">Failed to parse runtime data (${payload.length} bytes)</div>`;
            }
            break;
            
        case 0x04: // Device Info
            output += '<h3>📱 Device Information</h3>';
            try {
                const deviceStr = new TextDecoder().decode(payload);
                const pairs = deviceStr.split(',');
                const info = {};
                pairs.forEach(pair => {
                    const [key, value] = pair.split('=');
                    if (key && value) info[key.trim()] = value.trim();
                });
                
                // Detect device type based on 'type' field
                if (info.type) {
                    if (info.type.startsWith('HME')) {
                        if (window.uiController) window.uiController.setDeviceType('meter');
                    } else if (info.type.startsWith('HMG') || info.type.startsWith('HM')) {
                        if (window.uiController) window.uiController.setDeviceType('battery');
                    } else {
                        if (window.uiController) window.uiController.setDeviceType('unknown');
                    }
                }
                
                output += '<div class="data-grid">';
                for (const [key, value] of Object.entries(info)) {
                    output += `<div><strong>${key}:</strong> ${value}</div>`;
                }
                output += '</div>';
            } catch (e) {
                output += `<div class="error">Error parsing device info: ${e.message}</div>`;
            }
            break;
            
        case 0x0A: // Get Settings Info
            output += '<h3>⚙️ Settings Information</h3>';
            if (payload.length >= 80) {
                output += '<div class="data-grid">';
                output += `<div><strong>Settings Data Length:</strong> ${payload.length} bytes</div>`;
                // Parse the 80 bytes of settings data - structure from firmware
                const view = new DataView(payload.buffer, payload.byteOffset);
                for (let i = 0; i < Math.min(10, payload.length / 8); i++) {
                    const offset = i * 8;
                    if (offset + 7 < payload.length) {
                        output += `<div><strong>Setting ${i+1}:</strong> ${view.getUint32(offset, true)} / ${view.getUint32(offset + 4, true)}</div>`;
                    }
                }
                output += '</div>';
            } else {
                output += `<div class="error">Incomplete settings data (${payload.length} bytes, expected 80)</div>`;
            }
            break;
            
        case 0x08: // WiFi Info
            output += '<h3>📶 WiFi Information</h3>';
            try {
                const wifiName = new TextDecoder().decode(payload);
                output += `<div class="data-grid"><div><strong>Connected Network:</strong> ${wifiName}</div></div>`;
            } catch (e) {
                output += `<div class="data-grid"><div><strong>Raw Data:</strong> ${formatBytes(payload)}</div></div>`;
            }
            break;
            
        case 0x0D: // System Data
            output += '<h3>🔧 System Data</h3>';
            const view0D = new DataView(payload.buffer, payload.byteOffset);
            const systemData = {
                'System Status': view0D.getUint8(0),
                'Value 1': view0D.getUint16(1, true),
                'Value 2': view0D.getUint16(3, true),
                'Value 3': view0D.getUint16(5, true),
                'Value 4': view0D.getUint16(7, true),
                'Value 5': view0D.getUint16(9, true)
            };
            output += '<div class="data-grid">';
            for (const [key, value] of Object.entries(systemData)) {
                output += `<div><strong>${key}:</strong> ${value}</div>`;
            }
            output += '</div>';
            break;
            
        case 0x13: // Error Codes
            const errors = parseErrorCodes(payload);
            output += '<h3>🚨 Error Codes</h3>';
            if (errors.length > 0) {
                errors.forEach(error => {
                    output += `<div class="error-entry">${error.timestamp} - Code: ${error.code}</div>`;
                });
            } else {
                output += '<div class="data-grid"><div><strong>Status:</strong> No active errors found</div></div>';
            }
            break;
            
        case 0x14: // BMS Data
            const bms = parseBMSData(payload);
            if (bms) {
                output += '<h3>🔋 BMS Data</h3>';
                output += '<div class="data-grid">';
                for (const [key, value] of Object.entries(bms)) {
                    if (key === 'cellVoltages' && Array.isArray(value)) {
                        output += `<div><strong>Cell Voltages:</strong> ${value.map(v => v + 'V').join(', ')}</div>`;
                    } else {
                        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        output += `<div><strong>${displayKey}:</strong> ${value}</div>`;
                    }
                }
                output += '</div>';
            } else {
                output += '<h3>🔋 BMS Data</h3>';
                output += `<div class="error">Failed to parse BMS data (${payload.length} bytes)</div>`;
            }
            break;
            
        case 0x1A: // Config Data
            output += '<h3>⚙️ Configuration Data</h3>';
            const view1A = new DataView(payload.buffer, payload.byteOffset);
            const config = {
                'Config Mode': view1A.getUint8(0),
                'Config Flags': '0x' + view1A.getUint8(1).toString(16).padStart(2, '0'),
                'Reserved1': view1A.getUint16(2, true),
                'Config Status': view1A.getInt8(4),
                'Status Bytes': '0xFF FF FF',
                'Enable Flag 1': view1A.getUint8(8),
                'Reserved2': view1A.getUint8(9) + ',' + view1A.getUint8(10) + ',' + view1A.getUint8(11),
                'Enable Flag 2': view1A.getUint8(12),
                'Reserved3': view1A.getUint8(13) + ',' + view1A.getUint8(14) + ',' + view1A.getUint8(15),
                'Config Value': view1A.getUint8(16),
                'Reserved4': view1A.getUint8(17)
            };
            output += '<div class="data-grid">';
            for (const [key, value] of Object.entries(config)) {
                output += `<div><strong>${key}:</strong> ${value}</div>`;
            }
            output += '</div>';
            break;
            
        case 0x1C: // Event Log
            const events = parseEventLog(payload);
            output += '<h3>📝 Event Log</h3>';
            if (events.length > 0) {
                events.forEach(event => {
                    output += `<div class="event-log">${event.timestamp} - Type: ${event.type}, Code: ${event.code}</div>`;
                });
            } else {
                output += '<div class="data-grid"><div><strong>Status:</strong> No recent events</div></div>';
            }
            break;
            
        case 0x21: // Meter IP
            output += '<h3>🌐 Meter IP</h3>';
            const allFF = payload.every(byte => byte === 0xFF);
            if (allFF) {
                output += '<div class="data-grid"><div><strong>Status:</strong> No meter IP configured</div></div>';
            } else {
                try {
                    const ip = new TextDecoder().decode(payload.filter(b => b !== 0));
                    output += `<div class="data-grid"><div><strong>IP Address:</strong> ${ip}</div></div>`;
                } catch (e) {
                    output += `<div class="data-grid"><div><strong>Raw Data:</strong> ${formatBytes(payload)}</div></div>`;
                }
            }
            break;
            
        case 0x22: // CT Polling Rate
            output += '<h3>📊 CT Polling Rate Configuration</h3>';
            // Standard protocol: payload is extracted correctly by slice(4, -1)
            // The first byte of payload is the actual polling rate value
            let pollingRate = 0;
            if (payload.length >= 1) {
                pollingRate = payload[0];
            }
            
            let rateText = 'Unknown';
            let rateDescription = '';
            switch (pollingRate) {
                case 0: 
                    rateText = 'Rate 0 (Fastest)';
                    rateDescription = 'Fastest polling rate setting';
                    break;
                case 1: 
                    rateText = 'Rate 1 (Medium)';
                    rateDescription = 'Medium polling rate setting';
                    break;
                case 2: 
                    rateText = 'Rate 2 (Slowest)';
                    rateDescription = 'Slowest polling rate setting';
                    break;
                case 3: 
                    rateText = 'Rate 3 (Extended)';
                    rateDescription = 'Extended polling rate setting';
                    break;
                default: 
                    if (pollingRate >= 100) {
                        rateText = `Rate ${pollingRate} (0x${pollingRate.toString(16).padStart(2, '0').toUpperCase()})`;
                        rateDescription = 'High-value rate (possible time interval in milliseconds or custom encoding)';
                    } else if (pollingRate >= 10) {
                        rateText = `Rate ${pollingRate} (0x${pollingRate.toString(16).padStart(2, '0').toUpperCase()})`;
                        rateDescription = 'Custom polling rate value';
                    } else {
                        rateText = `Rate ${pollingRate}`;
                        rateDescription = 'Non-standard rate value';
                    }
                    break;
            }
            output += `
            <div class="data-grid">
                <div><strong>Current Rate:</strong> ${rateText}</div>
                <div><strong>Description:</strong> ${rateDescription}</div>
            </div>`;
            break;
            
        case 0x24: // Network Info
            output += '<h3>🔗 Network Information</h3>';
            try {
                const networkStr = new TextDecoder().decode(payload.filter(b => b !== 0));
                const networkInfo = {};
                networkStr.split(',').forEach(item => {
                    const [key, value] = item.split(':');
                    if (key && value) networkInfo[key.trim()] = value.trim();
                });
                output += '<div class="data-grid">';
                for (const [key, value] of Object.entries(networkInfo)) {
                    output += `<div><strong>${key}:</strong> ${value}</div>`;
                }
                output += '</div>';
            } catch (e) {
                output += `<div class="data-grid"><div><strong>Raw Data:</strong> ${formatBytes(payload)}</div></div>`;
            }
            break;
            
        case 0x27: // Power Data Array
            output += '<h3>📊 Power Data Array</h3>';
            if (payload.length >= 6) {
                const numEntries = (payload.length - 5) / 6; // Each entry is 6 bytes
                const powerData = [];
                const currentData = [];
                
                // Skip first 5 bytes (header), then parse 6-byte entries
                for (let i = 5; i < payload.length - 1 && powerData.length < 30; i += 6) {
                    if (i + 5 < payload.length) {
                        const view = new DataView(payload.buffer, payload.byteOffset + i);
                        const power = view.getUint32(0, true); // 4 bytes power
                        const current = view.getUint16(4, true); // 2 bytes current
                        powerData.push(power);
                        currentData.push(current);
                    }
                }
                
                output += `
                <div class="data-grid">
                    <div><strong>Number of Entries:</strong> ${powerData.length}</div>
                    <div><strong>Power Values:</strong> [${powerData.join(', ')}]</div>
                    <div><strong>Current Values:</strong> [${currentData.join(', ')}]</div>
                </div>`;
            } else {
                output += '<div class="data-grid"><div><strong>Status:</strong> No power data available</div></div>';
            }
            break;
            
        case 0x28: // Local API Status
            output += '<h3>🌐 Local API Configuration</h3>';
            if (payload.length >= 3) {
                const view = new DataView(payload.buffer, payload.byteOffset);
                const apiEnabled = view.getUint8(0);
                const apiPort = view.getUint16(1, true); // Little-endian
                output += `
                <div class="data-grid">
                    <div><strong>API Enabled:</strong> ${apiEnabled === 1 ? 'Yes' : 'No'}</div>
                    <div><strong>API Port:</strong> ${apiPort}</div>
                </div>`;
            } else {
                output += '<div class="data-grid"><div><strong>Status:</strong> Configuration updated</div></div>';
            }
            break;
        
        case 0x10: // Read Configuration
            if (data.length >= 80) {
                output += '<h3>📋 Configuration Data</h3>';
                
                try {
                    // Parse configuration fields based on expected ~80 byte response
                    // Note: Adjust these offsets based on actual response format testing
                    const configData = data.slice(5); // Skip header bytes
                    
                    // Extract ID (first 16 bytes)
                    const id = parseString(configData, 0, 16);
                    
                    // Extract XID (next 16 bytes)
                    const xid = parseString(configData, 16, 16);
                    
                    // Extract Server (next 32 bytes)
                    const server = parseString(configData, 32, 32);
                    
                    // Extract Port (2 bytes, little-endian)
                    const port = parseUint16LE(configData, 64);
                    
                    // Extract User (next 8 bytes)
                    const user = parseString(configData, 66, 8);
                    
                    // Extract Password (next 8 bytes) - mask for security
                    const pwdRaw = parseString(configData, 74, 8);
                    const pwd = pwdRaw.length > 0 ? '*'.repeat(Math.min(pwdRaw.length, 8)) : 'Not set';
                    
                    // Extract Flag (1 byte)
                    const flag = configData[82] || 0;
                    
                    output += `
                    <div class="data-grid">
                        <div><strong>Device ID:</strong> ${id || 'Not configured'}</div>
                        <div><strong>XID:</strong> ${xid || 'Not configured'}</div>
                        <div><strong>Server:</strong> ${server || 'Not configured'}</div>
                        <div><strong>Port:</strong> ${port || 'Not configured'}</div>
                        <div><strong>Username:</strong> ${user || 'Not configured'}</div>
                        <div><strong>Password:</strong> <span class="credential-field">${pwd}</span></div>
                        <div><strong>Config Flag:</strong> 0x${flag.toString(16).padStart(2, '0')}</div>
                    </div>
                    <div class="warning-box">
                        <strong>⚠️ Security Notice:</strong> Configuration contains sensitive credential information. 
                        Password field is masked for security. Use Write Configuration to update credentials.
                    </div>`;
                    
                } catch (error) {
                    output += `<div class="error">Failed to parse configuration data: ${error.message}</div>`;
                    output += `<div>Data length: ${data.length} bytes</div>`;
                }
            } else {
                output += '<h3>📋 Configuration Data</h3>';
                output += `<div class="error">Insufficient data received (${data.length} bytes, expected ~80)</div>`;
            }
            break;

        case 0x80: // Write Configuration Response
            output += '<h3>💾 Configuration Write Response</h3>';
            if (data.length > 5) {
                const status = data[5]; // Status byte after header
                const statusText = status === 0x00 ? 'Success ✅' : `Error ❌ (Code: ${status})`;
                output += `
                <div class="data-grid">
                    <div><strong>Write Status:</strong> ${statusText}</div>
                    <div><strong>Response Length:</strong> ${data.length} bytes</div>
                </div>`;
                
                if (status === 0x00) {
                    output += `
                    <div class="success-box">
                        <strong>✅ Success:</strong> Configuration has been written successfully. 
                        The device may need to restart to apply new settings.
                    </div>`;
                } else {
                    output += `
                    <div class="error-box">
                        <strong>❌ Write Failed:</strong> Configuration write failed with error code ${status}. 
                        Please verify the configuration format and try again.
                    </div>`;
                }
            } else {
                output += `<div class="error">Invalid response length: ${data.length} bytes</div>`;
            }
            break;
            
        default:
            // For other commands, provide basic parsing
            output += `<h3>Command Response (0x${commandByte.toString(16).padStart(2, '0').toUpperCase()})</h3>`;
            output += `<div>Command: ${commandName}</div>`;
            output += `<div>Response Length: ${data.length} bytes</div>`;
            
            if (data.length > 5) {
                output += '<div class="data-grid">';
                for (let i = 0; i < Math.min(payload.length, 16); i++) {
                    output += `<div><strong>Byte ${i}:</strong> 0x${payload[i].toString(16).padStart(2, '0')} (${payload[i]})</div>`;
                }
                if (payload.length > 16) {
                    output += `<div><strong>...</strong> (${payload.length - 16} more bytes)</div>`;
                }
                output += '</div>';
            }
            break;
    }
    
    return output;
}

/**
 * Parse a null-terminated string from byte array
 * @param {Uint8Array} data - Source data
 * @param {number} offset - Starting offset
 * @param {number} maxLength - Maximum length to read
 * @returns {string} Parsed string
 */
function parseString(data, offset, maxLength) {
    if (offset >= data.length) return '';
    
    const bytes = data.slice(offset, Math.min(offset + maxLength, data.length));
    
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

/**
 * Parse little-endian 16-bit unsigned integer
 * @param {Uint8Array} data - Source data
 * @param {number} offset - Starting offset
 * @returns {number} Parsed integer
 */
function parseUint16LE(data, offset) {
    if (offset + 1 >= data.length) return 0;
    return data[offset] | (data[offset + 1] << 8);
}

/**
 * Parse big-endian 16-bit unsigned integer
 * @param {Uint8Array} data - Source data
 * @param {number} offset - Starting offset
 * @returns {number} Parsed integer
 */
function parseUint16BE(data, offset) {
    if (offset + 1 >= data.length) return 0;
    return (data[offset] << 8) | data[offset + 1];
}

/**
 * Parse little-endian 32-bit unsigned integer
 * @param {Uint8Array} data - Source data
 * @param {number} offset - Starting offset
 * @returns {number} Parsed integer
 */
function parseUint32LE(data, offset) {
    if (offset + 3 >= data.length) return 0;
    return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

/**
 * Format byte array as hex string
 * @param {Uint8Array} data - Data to format
 * @returns {string} Formatted hex string
 */
function formatBytes(data) {
    return Array.from(new Uint8Array(data.buffer || data))
        .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Parse runtime information from payload
 * @param {Uint8Array} payload - Runtime info payload
 * @returns {Object|null} Parsed runtime data
 */
function parseRuntimeInfo(payload) {
    const view = new DataView(payload.buffer, payload.byteOffset);
    
    const currentDeviceType = window.uiController ? window.uiController.getDeviceType() : 'unknown';
    if (currentDeviceType === 'meter') {
        // CT002 Meter - shorter response, different scaling
        if (payload.length < 15) return null;
        
        return {
            totalPower: (view.getUint16(2, true) / 100).toFixed(2) + 'W',
            current: (view.getUint16(4, true) / 100).toFixed(2) + 'A',
            phasePower: (view.getUint16(6, true) / 100).toFixed(2) + 'W',
            voltage: view.getUint16(8, true) + 'V',
            unknownValue1: view.getUint16(10, true),
            unknownValue2: view.getUint16(12, true),
            deviceType: 'CT002 Power Meter'
        };
    } else {
        // Battery - full response with corrected field parsing
        if (payload.length < 100) return null;  // Need at least 100 bytes for basic runtime data
        
        // Parse power rating (Payload 0x46 = Raw 0x4A)
        const powerRating = view.getUint16(0x46, true);
        const modelType = powerRating === 2500 ? '2500W' : powerRating === 800 ? '800W' : `${powerRating}W`;
        
        // Parse firmware version (Payload 0x48-0x49 = Raw 0x4C-0x4D)
        const fwMajor = view.getUint8(0x48);
        const fwMinor = view.getUint8(0x49);
        
        // Debug - check what we're reading
        const debugPowerBytes = `${payload[0x46]?.toString(16)} ${payload[0x47]?.toString(16)}`;
        const debugFwBytes = `${payload[0x48]?.toString(16)} ${payload[0x49]?.toString(16)}`;
        const fwVersion = `v${fwMajor}.${fwMinor}`;
        
        // Parse build code (Payload 0x4A-0x4B = Raw 0x4E-0x4F) - Big Endian
        const buildCode = view.getUint16(0x4A, false); // false = big endian
        
        // Parse firmware timestamp (Payload 0x4D = Raw 0x51) - 12 bytes ASCII string
        let firmwareTimestamp = 'Unknown';
        try {
            const timestampBytes = payload.slice(0x4D, 0x59); // 12 bytes of ASCII + NUL
            const timestampStr = new TextDecoder().decode(timestampBytes);
            if (timestampStr.length >= 12 && /^\d+/.test(timestampStr)) {
                // Format: YYYYMMDDhhmm -> YYYY-MM-DD hh:mm
                const cleaned = timestampStr.replace(/\x00/g, '').slice(0, 12);
                if (cleaned.length === 12) {
                    firmwareTimestamp = `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)} ${cleaned.slice(8,10)}:${cleaned.slice(10,12)}`;
                }
            }
        } catch (e) {
            // Keep as 'Unknown' if parsing fails
        }
        
        // Parse status flags at offset 0x04-0x07
        const statusA = view.getUint8(0x04);
        const statusB = view.getUint8(0x05);
        const statusC = view.getUint8(0x06);
        const statusD = view.getUint8(0x07);
        
        // Parse model/product code at 0x0C-0x0D
        const productCode = view.getUint16(0x0C, true);
        
        return {
            // Power readings (signed, can be negative for import/export)
            gridPower: view.getInt16(0x00, true) + 'W',  // Grid/line power
            solarPower: view.getInt16(0x02, true) + 'W', // PV/second input power
            
            // Status/mode flags
            workMode: `0x${statusA.toString(16).padStart(2, '0')}`, // 0x04: Work/server mode
            statusB: statusB,     // 0x05: Status flag B
            statusC: statusC,     // 0x06: Status flag C  
            statusD: statusD,     // 0x07: Status flag D
            
            // Product identification
            productCode: `0x${productCode.toString(16).padStart(4, '0')}`, // 0x0C-0x0D: Model code
            
            // Telemetry/meter values
            meter1: view.getUint16(0x12, true), // Voltage or energy counter
            meter2: view.getUint16(0x16, true), // Secondary meter value
            meter3: view.getUint16(0x1A, true), // Tertiary meter value
            
            // Energy accumulators (32-bit LE, zero-padded high word)
            // Note: These are PAYLOAD offsets, not raw frame offsets
            energyTotal1: view.getUint32(0x2A, true), // Payload 0x2A = Raw 0x2E
            energyTotal2: view.getUint32(0x2E, true), // Payload 0x2E = Raw 0x32
            
            // Counter/flag (Payload 0x40 = Raw 0x44)
            counter: view.getUint16(0x40, true),
            
            // Device specifications
            powerRating: modelType,                    // Payload 0x46 = Raw 0x4A
            firmwareVersion: fwVersion,                // Payload 0x48-0x49 = Raw 0x4C-0x4D
            buildCode: buildCode,                      // Payload 0x4A-0x4B = Raw 0x4E-0x4F (BE)
            firmwareBuild: firmwareTimestamp,          // Payload 0x4D-0x58 = Raw 0x51-0x5C
            
            // Debug info
            debugPower: `${debugPowerBytes} = ${powerRating}`,
            debugFw: `${debugFwBytes} = v${fwMajor}.${fwMinor}`,
            
            // Tail section after build timestamp (PAYLOAD offsets, not raw)
            reservedCounter: payload.length > 0x5B ? view.getUint16(0x5A, true) : 0,  // Payload 0x5A = Raw 0x5E
            calTag1: payload.length > 0x5D ? view.getUint16(0x5C, true) : 0,         // Payload 0x5C = Raw 0x60
            calTag2: payload.length > 0x5E ? view.getUint8(0x5E) : 0,                // Payload 0x5E = Raw 0x62
            calTag3: payload.length > 0x60 ? view.getUint16(0x5F, false) : 0,        // Payload 0x5F = Raw 0x63 (BE)
            calTag4: payload.length > 0x62 ? view.getUint16(0x61, true) : 0,         // Payload 0x61 = Raw 0x65
            apiPort: payload.length > 0x64 ? view.getUint16(0x63, true) : 0,         // Payload 0x63 = Raw 0x67
            
            // Device type string
            deviceType: `${modelType} Battery System`
        };
    }
}

/**
 * Parse BMS data from payload
 * @param {Uint8Array} payload - BMS data payload
 * @returns {Object|null} Parsed BMS data
 */
function parseBMSData(payload) {
    const currentDeviceType = window.uiController ? window.uiController.getDeviceType() : 'unknown';
    if (currentDeviceType === 'meter') {
        // Meter has minimal BMS data - just basic status
        if (payload.length < 3) return null;
        const view = new DataView(payload.buffer, payload.byteOffset);
        return {
            status: 'Meter - No Battery Management',
            rawData: Array.from(payload).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
        };
    }
    
    if (payload.length < 80) return null;
    
    const view = new DataView(payload.buffer, payload.byteOffset);
    const cellVoltages = [];
    
    for (let i = 48; i < 82 && i < payload.length - 1; i += 2) {
        const voltage = view.getUint16(i, true);
        if (voltage > 0 && voltage < 5000) {
            cellVoltages.push((voltage / 1000).toFixed(3));
        }
    }
    
    return {
        bmsVersion: (view.getUint16(0, true)),
        voltageLimit: (view.getUint16(2, true) / 10).toFixed(1) + 'V',
        chargeCurrentLimit: (view.getUint16(4, true) / 10).toFixed(1),
        dischargeCurrentLimit: (view.getInt16(6, true) / 10).toFixed(1),
        remainingCapacity: view.getUint16(8, true) + '%',
        stateOfHealth: view.getUint16(10, true) + '%',
        designCapacity: view.getUint16(12, true) + 'Wh',
        voltage: (view.getUint16(14, true) / 100).toFixed(2) + 'V',
        batteryCurrent: (view.getInt16(16, true) / 10).toFixed(1) + 'A',
        batteryTemperature: view.getUint16(18, true) + '°C',
        b_chf: view.getUint16(20, true),
        b_slf: view.getUint16(22, true),
        b_cpc: view.getUint16(24, true),
        errorCode: view.getUint16(26, true),
        warningCode: view.getUint32(28, true),
        runtime: view.getUint32(32, true) + 'ms',
        b_ent: view.getUint16(36, true),
        mosfetTemperature: view.getUint16(38, true) + '°C',
        temperature1: view.getUint16(40, true) + '°C',
        temperature2: view.getUint16(42, true) + '°C',
        temperature3: view.getUint16(44, true) + '°C',
        temperature4: view.getUint16(46, true) + '°C',
        cellVoltages: cellVoltages
    };
}

/**
 * Parse event log from payload
 * @param {Uint8Array} payload - Event log payload
 * @returns {Array} Array of parsed events
 */
function parseEventLog(payload) {
    const events = [];
    let offset = 0;
    
    while (offset + 8 <= payload.length) {
        const view = new DataView(payload.buffer, payload.byteOffset + offset);
        
        const year = view.getUint16(0, true);
        const month = view.getUint8(2);
        const day = view.getUint8(3);
        const hour = view.getUint8(4);
        const minute = view.getUint8(5);
        const eventType = view.getUint8(6);
        const eventCode = view.getUint8(7);
        
        if (year > 2000 && year < 2100 && month >= 1 && month <= 12) {
            events.push({
                timestamp: `${year}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')} ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`,
                type: `0x${eventType.toString(16).padStart(2,'0')}`,
                code: `0x${eventCode.toString(16).padStart(2,'0')}`
            });
        }
        
        offset += 8;
        if (events.length > 20) break;
    }
    
    return events;
}

/**
 * Parse error codes from payload
 * @param {Uint8Array} payload - Error codes payload
 * @returns {Array} Array of parsed errors
 */
function parseErrorCodes(payload) {
    const errors = [];
    let offset = 0;
    
    while (offset + 14 <= payload.length) {
        const view = new DataView(payload.buffer, payload.byteOffset + offset);
        
        const year = view.getUint16(0, true);
        const month = view.getUint8(2);
        const day = view.getUint8(3);
        const hour = view.getUint8(4);
        const minute = view.getUint8(5);
        const errorCode = view.getUint8(6);
        
        if (year > 2000 && year < 2100 && month >= 1 && month <= 12 && errorCode !== 0) {
            errors.push({
                timestamp: `${year}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')} ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`,
                code: `0x${errorCode.toString(16).padStart(2,'0')} (${errorCode})`
            });
        }
        
        offset += 14;
        if (errors.length > 15) break;
    }
    
    return errors;
}

/**
 * Format hex dump for display
 * @param {Uint8Array} data - Data to format
 * @returns {string} Formatted hex dump
 */
function formatHexDump(data) {
    let hexDump = '';
    for (let i = 0; i < data.length; i += 16) {
        // Address
        hexDump += i.toString(16).padStart(4, '0') + ': ';
        
        // Hex bytes
        let hexPart = '';
        let asciiPart = '';
        for (let j = 0; j < 16; j++) {
            if (i + j < data.length) {
                const byte = data[i + j];
                hexPart += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';
                // ASCII representation (printable chars only)
                asciiPart += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            } else {
                hexPart += '   ';
            }
            // Add extra space in middle
            if (j === 7) hexPart += ' ';
        }
        
        hexDump += hexPart + ' |' + asciiPart + '|<br>';
    }
    return hexDump;
}

// Export functions for use by other modules
if (typeof window !== 'undefined') {
    window.dataParser = {
        parseResponse,
        parseString,
        parseUint16LE,
        parseUint16BE,
        parseUint32LE,
        formatHexDump,
        formatBytes,
        parseRuntimeInfo,
        parseBMSData,
        parseEventLog,
        parseErrorCodes
    };
}