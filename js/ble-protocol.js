/**
 * Marstek Venus E BLE Protocol Implementation
 * 
 * This module contains all Web Bluetooth API interactions and Marstek/HM protocol
 * implementation for communicating with Marstek Venus E battery systems.
 * 
 * Features:
 * - BLE device connection/disconnection
 * - Command message creation and sending
 * - Response parsing and notification handling
 * - OTA firmware update protocol
 * - Protocol utility functions
 */

// ========================================
// BLE CONSTANTS AND GLOBAL VARIABLES
// ========================================

const SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
const START_BYTE = 0x73;

// Characteristic UUIDs
const TX_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';  // Regular commands
const RX_CHAR_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';  // Regular responses  
// OTA commands use the same FF01/FF02 characteristics as normal BLE (from Wireshark analysis)

// ========================================
// BLE COMMUNICATION LOGGING
// ========================================

/**
 * Log outgoing BLE data with clear formatting
 */
function logOutgoing(data, description = '') {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const hexStr = Array.from(bytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
    log(`📤 OUT ${description ? `(${description}) ` : ''}[${bytes.length}]: ${hexStr}`);
}

/**
 * Log incoming BLE data with clear formatting  
 */
function logIncoming(data, description = '') {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const hexStr = Array.from(bytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
    log(`📥 IN  ${description ? `(${description}) ` : ''}[${bytes.length}]: ${hexStr}`);
}
const IDENTIFIER_BYTE = 0x23;

let device = null;
let server = null;
let characteristics = {};
let connectionCancelled = false; // Flag to cancel ongoing connection attempts
let activeTimeouts = []; // Track active timeouts for cancellation

// Helper functions for timeout management
function createTrackedTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        // Remove from tracking when it fires
        activeTimeouts = activeTimeouts.filter(id => id !== timeoutId);
        callback();
    }, delay);
    activeTimeouts.push(timeoutId);
    return timeoutId;
}

function clearAllActiveTimeouts() {
    activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    activeTimeouts = [];
}
// OTA uses the same txCharacteristic (FF01) and rxCharacteristic (FF02) as normal BLE
// Note: (window.uiController ? window.uiController.isConnected() : false) and (window.uiController ? window.uiController.getDeviceType() : 'unknown') are managed by ui-controller.js

// OTA-specific globals
let otaInProgress = false;

// ========================================
// LOGGING FUNCTION COMPATIBILITY
// ========================================

// Ensure logging functions are available with fallbacks
if (typeof logActivity === 'undefined') {
    window.logActivity = function(message) {
        const logElement = document.getElementById('log');
        if (logElement) {
            logElement.textContent += `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}\n`;
            logElement.scrollTop = logElement.scrollHeight;
        } else {
            console.log('[Activity] ' + message);
        }
    };
}
if (typeof logConnection === 'undefined') {
    window.logConnection = function(deviceName, connected) {
        const icon = connected ? '✅' : '❌';
        const action = connected ? 'Connected to' : 'Disconnected from';
        log(`${icon} ${action} ${deviceName}`);
    };
}
if (typeof logCommand === 'undefined') {
    window.logCommand = function(commandName, success) {
        const icon = success ? '✅' : '❌';
        const action = success ? 'Read' : 'Failed to read';
        log(`${icon} ${action} ${commandName}`);
    };
}
if (typeof logProtocol === 'undefined') {
    window.logProtocol = function(message, data) {
        const logElement = document.getElementById('log');
        const fullMessage = data ? `${message}\nRaw data: ${formatBytes(data)}` : message;
        if (logElement) {
            logElement.textContent += `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${fullMessage}\n`;
            logElement.scrollTop = logElement.scrollHeight;
        } else {
            console.log('[Protocol] ' + fullMessage);
        }
    };
}
if (typeof logError === 'undefined') {
    window.logError = function(message) {
        const logElement = document.getElementById('log');
        if (logElement) {
            logElement.textContent += `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ❌ ${message}\n`;
            logElement.scrollTop = logElement.scrollHeight;
        } else {
            console.log('[Error] ' + message);
        }
    };
}
if (typeof logOTA === 'undefined') {
    window.logOTA = function(message, progress) {
        let formattedMessage = `🔄 OTA: ${message}`;
        if (progress !== null) {
            formattedMessage += ` (${progress}%)`;
        }
        log(formattedMessage);
    };
}
let otaCurrentChunk = 0;
let otaTotalChunks = 0;
let txCharacteristic = null;  // ff01 - write without response
let rxCharacteristic = null;  // ff02 - notifications
let otaChunkSize = 132;       // Default, calculated from MTU
let pendingAckResolve = null;
let firmwareChecksum = 0;
let firmwareData = null;

// ========================================
// BLE CONNECTION MANAGEMENT
// ========================================

/**
 * Connect to a Marstek BLE device with retry logic
 */
async function connect() {
    try {
        // Reset cancellation flag at start of new connection
        connectionCancelled = false;
        
        log('🔍 Searching for Marstek devices...');
        
        // Request device with MST prefix filter
        device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'MST' }],
            optionalServices: [SERVICE_UUID]
        });

        // Check if connection was cancelled during device selection
        if (connectionCancelled) {
            log('🚫 Connection cancelled by user');
            return;
        }

        logActivity(`📱 Found device: ${device.name}`);
        
        // Try to connect with retry logic
        const maxRetries = 3;
        let connected = false;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // Check for cancellation before each attempt
            if (connectionCancelled) {
                log('🚫 Connection cancelled by user');
                return;
            }
            try {
                log(`🔄 Connection attempt ${attempt}/${maxRetries}...`);
                
                // Connect to GATT server with timeout
                const connectPromise = device.gatt.connect();
                const timeoutPromise = new Promise((_, reject) => 
                    createTrackedTimeout(() => reject(new Error('Connection timeout')), 10000)
                );
                
                server = await Promise.race([connectPromise, timeoutPromise]);
                
                // Small delay to ensure connection is stable
                await new Promise(resolve => createTrackedTimeout(resolve, 500));
                
                // Get service with retry on failure
                let service;
                try {
                    service = await server.getPrimaryService(SERVICE_UUID);
                } catch (serviceError) {
                    log('⚠️ Service not immediately available, waiting...');
                    await new Promise(resolve => createTrackedTimeout(resolve, 10000));
                    
                    // Retry with timeout protection
                    const servicePromise = server.getPrimaryService(SERVICE_UUID);
                    const serviceTimeoutPromise = new Promise((_, reject) => 
                        createTrackedTimeout(() => reject(new Error('Service retry timeout')), 20000)
                    );
                    service = await Promise.race([servicePromise, serviceTimeoutPromise]);
                }
                
                // Get all characteristics
                const chars = await service.getCharacteristics();
                characteristics = {};
                
                // Set up characteristics and notifications
                for (const char of chars) {
                    characteristics[char.uuid] = char;
                    
                    // Enable notifications for readable characteristics
                    if (char.properties.notify) {
                        await char.startNotifications();
                        // Only set up unified handler for FF02, skip other characteristics
                        if (char.uuid.includes('ff02')) {
                            // Store reference for the unified handler
                            char.addEventListener('characteristicvaluechanged', function(event) {
                                handleUnifiedNotification(event);
                            });
                            log(`📡 Notifications enabled for FF02`);
                        }
                        // Skip logging for other characteristics to reduce noise
                    }
                }
                
                connected = true;
                break; // Success, exit retry loop
                
            } catch (attemptError) {
                lastError = attemptError;
                log(`⚠️ Attempt ${attempt} failed: ${attemptError.message}`);
                
                if (attempt < maxRetries) {
                    // Disconnect if partially connected before retry
                    if (server && server.connected) {
                        try {
                            server.disconnect();
                        } catch (e) {}
                    }
                    
                    // Wait before retry (longer wait for each attempt)
                    const waitTime = attempt * 2000;
                    log(`⏳ Waiting ${waitTime/1000}s before retry...`);
                    await new Promise(resolve => createTrackedTimeout(resolve, waitTime));
                    
                    // Check for cancellation after wait
                    if (connectionCancelled) {
                        log('🚫 Connection cancelled during retry wait');
                        return;
                    }
                }
            }
        }
        
        if (!connected) {
            throw lastError || new Error('Failed to connect after multiple attempts');
        }

        // Handle disconnection
        device.addEventListener('gattserverdisconnected', () => {
            log('❌ Device disconnected');
            if (window.uiController && window.uiController.updateStatus) {
                window.uiController.updateStatus(false);
            }
        });

        // Update connection status
        if (window.uiController && window.uiController.updateStatus) {
            window.uiController.updateStatus(true, device.name);
        }
        logConnection(device.name, true);

        // Determine device type from name
        if (device.name.includes('ACCP')) {
            if (window.uiController) window.uiController.setDeviceType('battery');
            log('🔋 Detected: Battery device (Venus E)');
        } else if (device.name.includes('TPM')) {
            if (window.uiController) window.uiController.setDeviceType('meter');
            log('📊 Detected: CT meter device');
        }

    } catch (error) {
        log(`❌ Connection failed: ${error.message}`);
        logError(`Connection failed after 3 attempts: ${error.message}`);
        
        if (window.uiController && window.uiController.updateStatus) {
            window.uiController.updateStatus(false);
        }
        
        // Clean up on failure
        device = null;
        server = null;
        characteristics = {};
        
        // Always show retry dialog on connection failure
        log('🔄 Showing retry dialog...');
        showRetryDialog();
        
        // Also suggest device forgetting for common issues
        if (error.message.includes('timeout') || 
            error.message.includes('Connection failed') ||
            error.message.includes('GATT operation not permitted') ||
            error.message.includes('Device is no longer in range')) {
            log('💡 Tip: If connection keeps failing, try "Forget Devices" button to clear stale pairings');
        }
    }
}

/**
 * Disconnect from the BLE device
 */
function disconnect() {
    // Cancel any ongoing connection attempts
    connectionCancelled = true;
    
    // Clear all active timeouts (connection timeouts, retry delays, etc.)
    clearAllActiveTimeouts();
    
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
        log('🔌 Disconnected from device');
    }
    
    // Reset state
    device = null;
    server = null;
    characteristics = {};
    otaInProgress = false;  // Reset OTA state on disconnect
    // Connection state and device type reset handled by ui-controller
    
    if (window.uiController && window.uiController.updateStatus) {
        window.uiController.updateStatus(false);
    }
}

/**
 * Disconnect from all paired Bluetooth devices
 */
async function disconnectAll() {
    log('🔌 Disconnecting from all Bluetooth devices...');
    
    try {
        // First disconnect current device
        disconnect();
        
        // Get all paired devices and disconnect them
        if (navigator.bluetooth && navigator.bluetooth.getDevices) {
            const devices = await navigator.bluetooth.getDevices();
            let disconnectedCount = 0;
            
            for (const pairedDevice of devices) {
                try {
                    if (pairedDevice.gatt && pairedDevice.gatt.connected) {
                        await pairedDevice.gatt.disconnect();
                        disconnectedCount++;
                        log(`🔌 Disconnected from ${pairedDevice.name || 'Unknown Device'}`);
                    }
                } catch (error) {
                    log(`⚠️ Error disconnecting from ${pairedDevice.name || 'Unknown Device'}: ${error.message}`);
                }
            }
            
            if (disconnectedCount > 0) {
                log(`✅ Disconnected from ${disconnectedCount} device(s)`);
            } else {
                log('ℹ️ No connected devices found');
            }
        } else {
            log('ℹ️ Bluetooth device enumeration not available in this browser');
        }
    } catch (error) {
        log(`❌ Error during disconnect all: ${error.message}`);
    }
}

/**
 * Forget/unpair Bluetooth devices to clear stale connections
 */
async function forgetBluetoothDevices() {
    log('🔗 Attempting to forget paired Bluetooth devices...');
    
    try {
        // First disconnect everything
        await disconnectAll();
        
        if (navigator.bluetooth && navigator.bluetooth.getDevices) {
            const devices = await navigator.bluetooth.getDevices();
            let forgottenCount = 0;
            
            for (const pairedDevice of devices) {
                try {
                    // Try to forget the device if the method exists
                    if (pairedDevice.forget && typeof pairedDevice.forget === 'function') {
                        await pairedDevice.forget();
                        forgottenCount++;
                        log(`🗑️ Forgot device: ${pairedDevice.name || 'Unknown Device'}`);
                    } else {
                        log(`⚠️ Cannot forget ${pairedDevice.name || 'Unknown Device'} - forget() not available`);
                    }
                } catch (error) {
                    log(`⚠️ Error forgetting ${pairedDevice.name || 'Unknown Device'}: ${error.message}`);
                }
            }
            
            if (forgottenCount > 0) {
                log(`✅ Forgot ${forgottenCount} device(s)`);
                log('💡 You may need to refresh the page for changes to take effect');
            } else if (devices.length === 0) {
                log('ℹ️ No paired devices found');
            } else {
                log('⚠️ Could not forget devices - try clearing browser data for this site');
            }
        } else {
            log('ℹ️ Bluetooth device enumeration not available - try clearing browser data');
        }
    } catch (error) {
        log(`❌ Error during forget devices: ${error.message}`);
        log('💡 Try clearing browser data or opening site in incognito/private mode');
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Log messages to console and tabbed UI log interface
 * @param {string} message - Message to log
 */
function log(message) {
    console.log(message);
    
    // Route connection messages to status area instead of Activity tab
    if (message.includes('Searching for') || message.includes('Found device') || 
        message.includes('Connection attempt') || message.includes('Notifications enabled') ||
        message.includes('Service not') || message.includes('Waiting') || 
        message.includes('Connected to') || message.includes('Disconnected from') ||
        message.includes('Detected:')) {
        if (typeof updateConnectionStatus !== 'undefined') {
            updateConnectionStatus(message);
        }
        return; // Don't also log to Activity tab
    }
    
    // Route other messages to appropriate tabs based on content
    if (message.includes('Error') || message.includes('Failed') || message.includes('error') || 
        message.includes('Warning') || message.includes('failed') || message.includes('❌')) {
        if (typeof logError !== 'undefined') {
            logError(message);
        }
    } else if (message.includes('TX:') || message.includes('RX:') || message.includes('Hex:') || 
               message.includes('Payload:') || message.includes('bytes:') || message.includes('0x')) {
        if (typeof logProtocol !== 'undefined') {
            logProtocol(message);
        }
    } else {
        // Default to activity log for general messages
        if (typeof logActivity !== 'undefined') {
            logActivity(message);
        }
    }
    
    // Fallback to legacy log if tabbed logging not available
    if (typeof logActivity === 'undefined') {
        const logElement = document.getElementById('log');
        if (logElement) {
            logElement.textContent += `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}\n`;
            
            const lines = logElement.textContent.split('\n');
            if (lines.length > 500) {
                logElement.textContent = lines.slice(-500).join('\n');
            }
            
            logElement.scrollTop = logElement.scrollHeight;
        }
    }
}

// ========================================
// PROTOCOL MESSAGE CREATION
// ========================================

/**
 * Format bytes array as hex string for logging
 * @param {ArrayBuffer|Uint8Array} data - Data to format
 * @returns {string} Formatted hex string
 */
function formatBytes(data) {
    return Array.from(new Uint8Array(data.buffer || data))
        .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Calculate XOR checksum for array of bytes
 * @param {Array|Uint8Array} bytes - Bytes to checksum
 * @returns {number} XOR checksum
 */
function calculateXORChecksum(bytes) {
    let xor = 0;
    for (let i = 0; i < bytes.length; i++) {
        xor ^= bytes[i];
    }
    return xor;
}

/**
 * Format hex dump for detailed byte analysis
 * @param {Uint8Array} bytes - Bytes to format
 * @returns {string} Formatted hex dump
 */
function formatHexDump(bytes) {
    let hexDump = '';
    for (let i = 0; i < bytes.length; i += 16) {
        // Address
        hexDump += i.toString(16).padStart(4, '0') + ': ';
        
        // Hex bytes
        let hexPart = '';
        let asciiPart = '';
        for (let j = 0; j < 16; j++) {
            if (i + j < bytes.length) {
                const byte = bytes[i + j];
                hexPart += byte.toString(16).padStart(2, '0') + ' ';
                // ASCII representation (printable chars only)
                asciiPart += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            } else {
                hexPart += '   ';
            }
            // Add extra space in middle
            if (j === 7) hexPart += ' ';
        }
        
        hexDump += hexPart + ' |' + asciiPart + '|\n';
    }
    return hexDump;
}

// ========================================
// MESSAGE CREATION FUNCTIONS
// ========================================

/**
 * Create standard command message for Marstek protocol
 * @param {number} commandType - Command type byte
 * @param {Array|null} payload - Optional payload bytes
 * @returns {Uint8Array} Complete command message with checksum
 */
function createCommandMessage(commandType, payload = null) {
    const header = [START_BYTE, 0, IDENTIFIER_BYTE, commandType];
    const payloadArray = payload ? Array.from(payload) : [];
    // Reverting to original calculation - the 0x05 length was apparently correct
    const messageLength = header.length + payloadArray.length + 1;
    header[1] = messageLength;
    const message = [...header, ...payloadArray];
    const checksum = message.reduce((xor, byte) => xor ^ byte, 0);
    message.push(checksum);
    return new Uint8Array(message);
}

/**
 * Create meter IP command message using alternative protocol format
 * @param {number} commandType - Command type byte
 * @param {Array|null} payload - Optional payload bytes
 * @returns {Uint8Array} Complete meter IP command message
 */
function createMeterIPMessage(commandType, payload = null) {
    // Alternative format for meter IP commands based on protocol analysis
    // Frame: [0x73] [LEN] [0x23] [CMD] [PAYLOAD] [XOR]
    // LEN = count of bytes from 0x23 through checksum
    // XOR = 0x23 ^ CMD ^ PAYLOAD bytes
    
    const payloadArray = payload ? Array.from(payload) : [];
    const len = 4 + payloadArray.length; // 0x23 + cmd + payload + checksum = 4 + payload length
    
    const message = [START_BYTE, len, IDENTIFIER_BYTE, commandType, ...payloadArray];
    
    // XOR only over [0x23, cmd, payload] - not including 0x73, len, or checksum
    let checksum = IDENTIFIER_BYTE ^ commandType;
    for (const byte of payloadArray) {
        checksum ^= byte;
    }
    message.push(checksum);
    
    return new Uint8Array(message);
}

/**
 * Create standard HM protocol frame for regular commands
 * @param {number} command - Command byte (e.g., 0x1F)
 * @param {Array} payload - Payload bytes
 * @returns {Uint8Array} Complete HM protocol frame
 */
function createHMFrame(command, payload = []) {
    const frame = [];
    frame.push(0x73);                           // Start byte
    
    // HM format: length byte = total frame length (start + length + 0x23 + cmd + payload + checksum)
    const totalLength = 1 + 1 + 1 + 1 + payload.length + 1; // 5 + payload length
    frame.push(totalLength);                    // Total frame length
    
    frame.push(0x23);                          // Protocol identifier
    frame.push(command);                       // Command byte
    
    // Add payload
    payload.forEach(byte => frame.push(byte));
    
    // Calculate XOR checksum: 0x23 ^ CMD ^ payload bytes
    let checksum = 0x23 ^ command;
    payload.forEach(byte => checksum ^= byte);
    frame.push(checksum);
    
    return new Uint8Array(frame);
}

/**
 * XOR checksum helper
 */
function xorChecksum(bytes) {
    let cs = 0;
    for (const b of bytes) cs ^= b;
    return cs & 0xFF;
}

/**
 * Build OTA frame (correct format from analysis)
 * @param {number} cmdByte - Command byte (0x3A, 0x50, 0x51, 0x52)
 * @param {Uint8Array} payload - Payload bytes
 * @returns {Uint8Array} Complete OTA frame
 */
function buildOtaFrame(cmdByte, payload) {
    const len = 5 + payload.length;           // no reserved byte
    const frame = new Uint8Array(len);
    frame[0] = 0x73;
    frame[1] = (len >>> 8) & 0xFF;            // big-endian length
    frame[2] =  len        & 0xFF;
    frame[3] = cmdByte;                       // command
    frame.set(payload, 4);                    // payload directly after command
    frame[len - 1] = xorChecksum(frame.slice(0, len - 1));
    return frame;
}


/**
 * Build transition HM frame (uses big-endian length like OTA frames)
 * @param {number} command - HM command byte
 * @param {Array} payload - Payload bytes  
 * @returns {Uint8Array} Complete transition HM frame
 */
function buildTransitionHMFrame(command, payload = []) {
    const len = 6 + payload.length;           // includes checksum
    const frame = new Uint8Array(len);
    frame[0] = 0x73;
    frame[1] = (len >>> 8) & 0xFF;            // big-endian length (like OTA)
    frame[2] =  len        & 0xFF;
    frame[3] = 0x23;                          // HM marker
    frame[4] = command;                       // HM command
    frame.set(payload, 5);                    // payload
    frame[len - 1] = xorChecksum(frame.slice(0, len - 1));
    return frame;
}

/**
 * Little-endian 32-bit integer to bytes
 */
function u32le(n) {
    return new Uint8Array([n & 0xFF, (n>>>8)&0xFF, (n>>>16)&0xFF, (n>>>24)&0xFF]);
}

/**
 * Build "P" size frame
 */
function buildSizeFrame(sizeBytes, checksum) {
    const payload = new Uint8Array(8);
    payload.set(u32le(sizeBytes), 0);
    payload.set(u32le(checksum >>> 0), 4);
    return buildOtaFrame(0x50, payload);      // 'P'
}

/**
 * Build "Q" data frame (offset + 128B)
 */
function buildDataFrame(offset, chunk128) {
    const payload = new Uint8Array(1 + 4 + 128);  // DIR + OFFSET + DATA
    payload[0] = 0x10;                             // Direction: host→device
    payload.set(u32le(offset), 1);                 // Offset (little-endian)
    payload.set(chunk128, 5);                      // Data
    return buildOtaFrame(0x51, payload);           // 'Q'
}

/**
 * Build "R" finish frame
 */
function buildFinishFrame() {
    const payload = new Uint8Array([0x10]); // Direction: host→device
    return buildOtaFrame(0x52, payload);     // 'R'
}

// ========================================
// CONNECTION MANAGEMENT
// ========================================

// updateStatus is handled by ui-controller.js


// ========================================
// COMMAND SENDING FUNCTIONS
// ========================================

/**
 * Send standard command to BLE device
 * @param {number} commandType - Command type byte
 * @param {string} commandName - Human-readable command name for logging
 * @param {Array|null} payload - Optional payload bytes
 * @param {number} retryCount - Number of retry attempts (default 0)
 */
async function sendCommand(commandType, commandName, payload = null, retryCount = 0) {
    if (!(window.uiController ? window.uiController.isConnected() : false)) return;
    
    // Block commands during OTA
    if (otaInProgress) {
        log('⚠️ Command blocked: OTA update in progress');
        return;
    }
    
    try {
        const command = createCommandMessage(commandType, payload);
        window.currentCommand = commandName;
        window.lastCommandTime = Date.now();
        
        // Set context in async handler
        if (window.asyncResponseHandler) {
            window.asyncResponseHandler.setCommandContext(commandName);
        }
        
        log(`📤 Sending ${commandName}...`);
        logProtocol(`📤 TX → Device (${command.length} bytes): ${formatBytes(command)}`, command);
        
        const writeChars = Object.values(characteristics).filter(char => 
            char.properties.write || char.properties.writeWithoutResponse
        );
        
        if (writeChars.length === 0) {
            log('❌ No writable characteristics found');
            return;
        }
        
        const writeChar = writeChars[0];
        logOutgoing(command, `HM Command ${commandName}`);
        await writeChar.writeValueWithoutResponse(command);
        
        // Set up timeout to clear command if no response
        setTimeout(() => {
            // Clear command if still pending (no retry, just cleanup)
            if (window.currentCommand === commandName && 
                Date.now() - window.lastCommandTime > 2900) {
                // Don't log timeout - responses are handled asynchronously
                window.currentCommand = null;
            }
        }, 3000);
        
    } catch (error) {
        log(`❌ Failed to send ${commandName}: ${error.message}`);
        
        // Retry on error
        if (retryCount < 2) {
            log(`🔄 Retrying ${commandName} due to error (attempt ${retryCount + 2}/3)...`);
            setTimeout(() => {
                sendCommand(commandType, commandName, payload, retryCount + 1);
            }, 1000);
        }
    }
}

/**
 * Send meter IP command using alternative protocol
 * @param {number} commandType - Command type byte
 * @param {string} commandName - Human-readable command name for logging
 * @param {Array|null} payload - Optional payload bytes
 * @param {number} retryCount - Number of retry attempts (default 0)
 */
async function sendMeterIPCommand(commandType, commandName, payload = null, retryCount = 0) {
    if (!(window.uiController ? window.uiController.isConnected() : false)) return;
    
    try {
        const command = createMeterIPMessage(commandType, payload);
        window.currentCommand = commandName;
        window.lastCommandTime = Date.now();
        
        log(`📤 Sending ${commandName} (Alternative Protocol)...`);
        log(`📋 Frame: ${formatBytes(command)}`);
        
        const writeChars = Object.values(characteristics).filter(char => 
            char.properties.write || char.properties.writeWithoutResponse
        );
        
        if (writeChars.length === 0) {
            log('❌ No writable characteristics found');
            return;
        }
        
        const writeChar = writeChars[0];
        logOutgoing(command, `HM Command ${commandName}`);
        await writeChar.writeValueWithoutResponse(command);
        
        // Set up timeout to clear command if no response
        setTimeout(() => {
            // Clear command if still pending (no retry, just cleanup)
            if (window.currentCommand === commandName && 
                Date.now() - window.lastCommandTime > 2900) {
                // Don't log timeout - responses are handled asynchronously
                window.currentCommand = null;
            }
        }, 3000);
        
    } catch (error) {
        log(`❌ Failed to send ${commandName}: ${error.message}`);
        
        // Retry on error
        if (retryCount < 2) {
            log(`🔄 Retrying ${commandName} due to error (attempt ${retryCount + 2}/3)...`);
            setTimeout(() => {
                sendMeterIPCommand(commandType, commandName, payload, retryCount + 1);
            }, 1000);
        }
    }
}

// ========================================
// NOTIFICATION AND RESPONSE HANDLING
// ========================================

/**
 * Create notification handler for BLE characteristic
 * @param {string} charUuid - Characteristic UUID
 * @returns {Function} Notification handler function
 */
function createNotificationHandler(charUuid) {
    return function(event) {
        const data = event.target.value;
        const bytes = new Uint8Array(data.buffer);
        
        
        // Log all incoming data
        logIncoming(bytes, `Response on ${charUuid.slice(-4)}`);
        log(`📨 Response received (${bytes.length} bytes): ${formatBytes(bytes)}`);
        
        // Check if this is an OTA activation response (cmd 0x1F)
        if (window.otaActivationResolve && bytes.length >= 5 && bytes[0] === 0x73 && bytes[2] === 0x23 && bytes[3] === 0x1F) {
            log('🔍 Detected upgrade mode activation response');
            const payload = bytes.slice(4, -1); // Extract payload (skip header and checksum)
            log(`📥 Upgrade mode payload: [${Array.from(payload).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`);
            
            // Firmware analysis: payload 0x01 = "OTA armed" 
            if (payload.length >= 1 && payload[0] === 0x01) {
                log('✅ OTA activation confirmed: device is armed for upgrade (payload 0x01)');
                log('✅ Upgrade mode activated - device ready for OTA');
                window.otaActivationResolve(true);
            } else {
                const status = payload.length >= 1 ? `0x${payload[0].toString(16).padStart(2, '0')}` : 'empty';
                log(`⚠️ Unexpected OTA activation payload: expected 0x01, got 0x${status}`);
                log(`❌ Upgrade mode activation failed - status: ${status}`);
                window.otaActivationResolve(false);
            }
            
            window.otaActivationResolve = null;
            window.currentCommand = null;
            return;
        }
        
        // Check if this looks like an OTA/BLE frame response (for firmware update ACKs)
        // DISABLED: handleOTAAck doesn't exist and was causing issues
        // The unified notification handler already handles OTA frames correctly
        /*
        if (bytes.length >= 6 && bytes[0] === 0x73) {
            const frameLength = bytes[1] | (bytes[2] << 8);
            if (frameLength > 5 && bytes[3] === 0xFF && bytes[4] === 0x01) {
                // This looks like an OTA ACK - handle it
                handleOTAAck(bytes);
                return;
            }
        }
        */
        
        // Note: Regular command response handling is now done by handleUnifiedNotification
        // This generic handler is only for non-FF02 characteristics
    };
}


// ========================================
// OTA FIRMWARE UPDATE FUNCTIONS
// ========================================

/**
 * Analyze firmware file to calculate checksum and detect type
 * @param {ArrayBuffer} firmwareArrayBuffer - Firmware data
 * @returns {Object} Analysis results with checksum, type, and size
 */
function analyzeFirmware(firmwareArrayBuffer) {
    // Calculate ones' complement checksum as expected by Marstek bootloader
    const bytes = new Uint8Array(firmwareArrayBuffer);
    let sum = 0;
    
    // Sum all bytes (JavaScript handles 32-bit overflow automatically)
    for (let i = 0; i < bytes.length; i++) {
        sum += bytes[i];
    }
    
    // Apply 32-bit mask and ones' complement
    sum = sum >>> 0; // Convert to unsigned 32-bit
    const checksum = (~sum) >>> 0; // Ones' complement and convert to unsigned 32-bit
    
    // Detect firmware type by checking for VenusC signature at offset 0x50004
    let firmwareType = 'Unknown';
    let sizeWarning = '';
    const signatureOffset = 0x50004;
    
    if (bytes.length > signatureOffset + 10) {
        // Large firmware files - check for EMS signature
        const signatureBytes = bytes.slice(signatureOffset, signatureOffset + 10);
        const signatureStr = new TextDecoder('utf-8', { fatal: false }).decode(signatureBytes);
        
        if (signatureStr.includes('VenusC')) {
            firmwareType = 'EMS/Control Firmware (VenusC signature found)';
        } else {
            // Check if the area contains mostly null bytes or valid data
            const hasData = signatureBytes.some(b => b !== 0x00 && b !== 0xFF);
            if (hasData) {
                firmwareType = 'BMS Firmware (no VenusC signature)';
            } else {
                firmwareType = 'Unknown (signature area empty)';
            }
        }
    } else if (bytes.length >= 32768) {
        // Smaller firmware files - likely BMS firmware
        firmwareType = 'BMS Firmware (size suggests BMS)';
    } else if (bytes.length >= 1024) {
        // Small files - could be firmware but unusual
        firmwareType = 'Unknown (small size - proceed with caution)';
        sizeWarning = '⚠️ File size is unusually small for firmware';
    } else {
        // Very small files - likely not firmware but allow user to proceed
        firmwareType = 'Unknown (very small - likely not firmware)';
        sizeWarning = '⚠️ File size is very small - this may not be valid firmware';
    }
    
    log(`📊 Firmware analysis:`);
    log(`   Size: ${bytes.length} bytes`);
    log(`   Type: ${firmwareType}`);
    log(`   Sum: 0x${sum.toString(16).padStart(8, '0')}`);
    log(`   Checksum: 0x${checksum.toString(16).padStart(8, '0')} (~sum)`);
    if (sizeWarning) {
        log(`   ${sizeWarning}`);
    }
    
    return { checksum, type: firmwareType, size: bytes.length, warning: sizeWarning };
}

/**
 * Handle incoming notification data from FF02 (both HM and OTA responses)
 * @param {Event} event - BLE characteristic change event
 */
function handleUnifiedNotification(event) {
    const value = new Uint8Array(event.target.value.buffer);
    
    
    // Log protocol details
    logProtocol(`📡 Notification ← Device (${value.length} bytes): ${formatBytes(value)}`, value);
    
    // Check basic frame requirements
    if (value.length < 6 || value[0] !== 0x73) {
        logError(`Bad notification header: ${Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        return;
    }
    
    // Detect frame format: Check for 0x23 marker at positions [2] (normal HM) or [3] (transition HM)
    const isHMFrame = value[2] === 0x23 || value[3] === 0x23;
    
    if (isHMFrame) {
        handleHMFrame(value);
    } else {
        handleOTAFrame(value);
    }
}

/**
 * Handle HM frame processing
 * @param {Uint8Array} value - Frame data
 */
function handleHMFrame(value) {
    log(`🔍 DEBUG: handleHMFrame called with ${value.length} bytes`);
    // Detect format: normal HM or transition HM with big-endian length
    const isNormalHM = value[2] === 0x23;
    const isTransitionHM = value[3] === 0x23;
    
    let hmLength, cmd, payload, checksum;
    
    if (isNormalHM) {
        // Normal HM frame: [0x73] [LEN] [0x23] [CMD] [PAYLOAD...] [CHECKSUM]
        hmLength = value[1];
        cmd = value[3];
        payload = value.slice(4, -1);
        checksum = value[value.length - 1];

        // Special case: 0x13 (BLE Event Log) uses fixed 285-byte frame regardless of length byte
        if (cmd === 0x13) {
            log(`📊 BLE Event Log (0x13) detected - bypassing length check (frame: ${value.length} bytes, declared: ${hmLength})`);
        } else if (value.length !== hmLength) {
            log(`❌ Normal HM frame length mismatch: expected ${hmLength}, got ${value.length}`);
            return;
        }
    } else if (isTransitionHM) {
        // Transition HM frame: [0x73] [LEN_HI] [LEN_LO] [0x23] [CMD] [PAYLOAD...] [CHECKSUM]
        hmLength = (value[1] << 8) | value[2];  // big-endian length
        cmd = value[4];
        payload = value.slice(5, -1);
        checksum = value[value.length - 1];
        
        if (hmLength !== value.length) {
            log(`❌ Transition HM frame length mismatch: declared ${hmLength}, got ${value.length} total bytes`);
            return;
        }
    } else {
        log(`❌ Invalid HM frame: no 0x23 marker found`);
        return;
    }
    
    log(`📨 HM frame received - CMD: 0x${cmd.toString(16)}, Payload: ${Array.from(payload).map(b => '0x' + b.toString(16)).join(' ')}`);
    
    // Verify XOR checksum (skip for 0x13 BLE Event Log which uses different validation)
    if (cmd !== 0x13) {
        let xor = 0;
        for (let i = 0; i < value.length - 1; i++) {
            xor ^= value[i];
        }
        if (xor !== checksum) {
            log(`❌ Bad XOR checksum: expected 0x${xor.toString(16)}, got 0x${checksum.toString(16)}`);
            return;
        }
    } else {
        log(`📊 BLE Event Log (0x13) - skipping XOR checksum validation`);
    }
    
    log(`✅ Valid HM ACK: cmd=0x${cmd.toString(16)}, payload=[${Array.from(payload).map(b => '0x' + b.toString(16)).join(' ')}]`);
    
    // Resolve pending HM ACK promise
    if (pendingAckResolve) {
        pendingAckResolve({
            ok: true,
            cmd: cmd,
            payload: payload
        });
        pendingAckResolve = null;
    }
    // Handle ALL incoming command responses - parse everything
    log(`🔍 DEBUG: About to parse response for cmd 0x${cmd.toString(16).toUpperCase()}`);
    log(`🔍 DEBUG: window.createPayload = ${typeof window.createPayload}`);
    try {
        // Use the new payload system
        if (window.createPayload) {
            log(`🔍 DEBUG: Calling createPayload for cmd 0x${cmd.toString(16).toUpperCase()}`);
            const payload = window.createPayload(value);
            log(`🔍 DEBUG: createPayload succeeded, payload type: ${payload.constructor.name}`);

            log(`🔍 DEBUG: Calling toHTML()`);
            const parsed = payload.toHTML();
            log(`🔍 DEBUG: toHTML() succeeded, result length: ${parsed ? parsed.length : 'null'}`);

            if (window.uiController && window.uiController.displayData) {
                log(`🔍 DEBUG: Using uiController.displayData`);
                window.uiController.displayData(parsed);
            } else {
                // Fallback display
                log(`🔍 DEBUG: Using fallback display`);
                const dataDisplay = document.getElementById('dataDisplay');
                if (dataDisplay) {
                    dataDisplay.innerHTML = parsed;
                    log(`🔍 DEBUG: HTML set to dataDisplay element`);
                } else {
                    log(`❌ DEBUG: dataDisplay element not found`);
                }
            }

            log(`✅ Response parsed and displayed for command 0x${cmd.toString(16).toUpperCase()}`);
        } else {
            log('⚠️ Payload system not available, showing raw data');
            log(`Raw response: ${formatBytes(value)}`);
        }
    } catch (error) {
        log(`❌ Failed to parse response for command 0x${cmd.toString(16).toUpperCase()}: ${error.message || 'Unknown error'}`);
        log(`❌ Error object: ${JSON.stringify(error)}`);
        if (error.stack) {
            log(`❌ Stack trace: ${error.stack}`);
        }
        log(`Raw response: ${formatBytes(value)}`);
    }

    // Clear currentCommand if set (for backwards compatibility)
    if (window.currentCommand) {
        window.currentCommand = null;
    }
}

/**
 * Handle OTA frame processing
 * @param {Uint8Array} value - Frame data
 */
function handleOTAFrame(value) {
    // BLE OTA frame: [0x73] [LEN_HI] [LEN_LO] [CMD] [PAYLOAD...] [CHECKSUM] (no reserved byte)
    const declaredLength = (value[1] << 8) | value[2];  // big-endian length
    
    if (declaredLength !== value.length) {
        log(`❌ BLE OTA length mismatch: declared ${declaredLength}, got ${value.length} total bytes`);
        log(`❌ Problem frame (${value.length} bytes): ${Array.from(value).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        return;
    }
    
    const cmd = value[3];
    const payload = value.slice(4, -1);  // payload starts at position 4 (no reserved byte)
    const checksum = value[value.length - 1];
    
    log(`📨 BLE OTA frame received - CMD: 0x${cmd.toString(16)}, Payload: ${Array.from(payload).map(b => '0x' + b.toString(16)).join(' ')}`);

    // Verify XOR checksum
    let xor = 0;
    for (let i = 0; i < value.length - 1; i++) {
        xor ^= value[i];
    }
    if (xor !== checksum) {
        log(`❌ Bad XOR checksum: expected 0x${xor.toString(16)}, got 0x${checksum.toString(16)}`);
        return;
    }

    log(`✅ Valid BLE OTA ACK: cmd=0x${cmd.toString(16)}, payload=[${Array.from(payload).map(b => '0x' + b.toString(16)).join(' ')}]`);
    
    // Resolve pending OTA ACK promise
    if (pendingAckResolve) {
        pendingAckResolve({
            ok: true,
            cmd: cmd,
            payload: payload
        });
        pendingAckResolve = null;
    } else {
        log(`⚠️ WARNING: pendingAckResolve is null for cmd 0x${cmd.toString(16)} - ACK will be lost!`);
    }
}




/**
 * Wait for ACK response from device
 * @param {number} expectedCmd - Expected command in ACK
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Promise resolving to ACK response
 */
async function waitForAck(expectedCmd, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        let timeoutId;
        
        pendingAckResolve = (ack) => {
            
            // Clear the timeout since we got a response
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            
            if (ack.cmd === expectedCmd) {
                // For OTA size command (0x50), payload[0] is DIR field (0x00), not status
                // For other OTA commands, accept any payload (they have DIR fields too)
                if (expectedCmd === 0x50) {
                    // Size command: accept any payload since payload[0] is DIR field
                    // (checksum validation happens in sendFirmwareSize function)
                }
                pendingAckResolve = null;  // Clear the global handler
                resolve({ ...ack, ok: true });
            } else {
                pendingAckResolve = null;  // Clear the global handler
                resolve({
                    ok: false,
                    reason: `unexpected cmd: expected 0x${expectedCmd.toString(16)}, got 0x${ack.cmd.toString(16)}`
                });
            }
        };
        
        timeoutId = setTimeout(() => {
            if (pendingAckResolve) {
                log(`⚠️ Timeout waiting for ACK (cmd 0x${expectedCmd.toString(16)})`);
                pendingAckResolve = null;
                resolve({ ok: false, reason: "timeout" });
            }
        }, timeoutMs);
    });
}

/**
 * Connect and prepare OTA characteristics
 */
async function connectAndPrepareOTA() {
    if (!device) {
        throw new Error("No device connected");
    }
    
    // Find TX, RX, and OTA characteristics
    const service = await device.gatt.getPrimaryService('0000ff00-0000-1000-8000-00805f9b34fb');
    txCharacteristic = await service.getCharacteristic('0000ff01-0000-1000-8000-00805f9b34fb');
    rxCharacteristic = await service.getCharacteristic('0000ff02-0000-1000-8000-00805f9b34fb');
    // OTA uses the same FF01/FF02 characteristics as normal BLE (from Wireshark analysis)
    
    // Enable notifications on RX characteristic (both HM and OTA responses)
    await rxCharacteristic.startNotifications();
    // Note: Notification listener already set up in main connection - don't add duplicate
    
    // All communication (both HM and OTA) goes through FF01 (write) → FF02 (notify) based on Wireshark analysis
    // Note: Notifications already enabled in main connection setup
    
    // Use fixed 128-byte chunks as per protocol specification
    otaChunkSize = 128;
    
    // Analyze firmware: checksum + type detection
    const analysis = analyzeFirmware(firmwareData);
    firmwareChecksum = analysis.checksum;
    log(`🔑 Firmware ready for upload`);
}

/**
 * Send OTA activation command
 * @returns {Promise<boolean>} Success status
 */
async function sendOTAActivate() {
    try {
        log('🔄 Activating upgrade mode with Wireshark-verified sequence...');
        
        // Step 1: Send 0x54 command in OTA format (Frame 103)
        // Frame 103: 730006541031 -> [0x73][0x00][0x06][0x54][0x10][0x31] (no reserved byte)
        log('📤 Sending 0x54 OTA activation command...');
        const cmd54Frame = buildOtaFrame(0x54, new Uint8Array([0x10]));
        logOutgoing(cmd54Frame, 'OTA Activation (0x54)');
        await txCharacteristic.writeValueWithoutResponse(cmd54Frame);
        
        // Brief delay between commands
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 2: Send 0x10 command in transition HM format (Frame 105)
        // Frame 105: 7300072310aaed -> uses big-endian length but has 0x23 marker
        // Note: Firmware disassembly shows check for [0x0A, 0x0B, 0x0C] but working app uses [0xaa]
        log('📤 Sending 0x10 HM activation command with Wireshark payload...');
        const cmd23Frame = buildTransitionHMFrame(0x10, [0xaa]);
        logOutgoing(cmd23Frame, 'HM Activation (0x10)');
        await txCharacteristic.writeValueWithoutResponse(cmd23Frame);
        
        // Wait for response ACK with payload [0x01] (Frame 106)
        // Device responds with cmd=0x00 (generic response) rather than echoing 0x10
        log('⏳ Waiting for activation ACK...');
        const ack = await waitForAck(0x00, 3000);
        
        if (!ack || !ack.ok) {
            throw new Error(`Activation failed: ${ack ? ack.reason : 'timeout'}`);
        }
        
        // Check that payload starts with [0x01] as in working capture
        if (ack.payload.length < 1 || ack.payload[0] !== 0x01) {
            throw new Error(`Unexpected activation ACK payload: expected [0x01, ...], got [${Array.from(ack.payload).map(b => '0x' + b.toString(16)).join(', ')}]`);
        }
        
        log('📥 Upgrade mode payload: [0x01]');
        log('✅ OTA activation confirmed: device is armed for upgrade (payload 0x01)');
        log('✅ Upgrade mode activated - device ready for OTA');
        
        return true;
        
    } catch (error) {
        log(`❌ OTA activation failed: ${error.message}`);
        return false;
    }
}

/**
 * Send firmware size and checksum to device
 * @param {number} firmwareSize - Size of firmware in bytes
 * @returns {Promise<boolean>} Success status
 */
async function sendFirmwareSize(firmwareSize) {
    if (!txCharacteristic || !rxCharacteristic) {
        log('❌ BLE characteristics not ready for OTA');
        return false;
    }

    try {
        log(`📏 Sending firmware size: ${firmwareSize} bytes with checksum: 0x${firmwareChecksum.toString(16)}`);
        
        // Step 2: Send firmware length in 8-byte payload: size LE (4) + checksum LE (4)
        // Create HM/BLE format payload: [0x10, size LE 4B, checksum LE 4B]
        const sizePayload = [
            0x10,                               // Subtype
            firmwareSize & 0xFF,                // Size LE (little-endian)
            (firmwareSize >> 8) & 0xFF,
            (firmwareSize >> 16) & 0xFF,
            (firmwareSize >> 24) & 0xFF,
            firmwareChecksum & 0xFF,            // Checksum LE (little-endian)
            (firmwareChecksum >> 8) & 0xFF,
            (firmwareChecksum >> 16) & 0xFF,
            (firmwareChecksum >> 24) & 0xFF
        ];
        
        log(`🔍 Size payload (${sizePayload.length} bytes): [${sizePayload.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`);
        
        // Frame format: [CMD][DIR][SIZE(4)][CHECKSUM(4)]
        // DIR: 0x10 = host→device, 0x00 = device→host  
        // Frame 110: 73000e5010002001001ba692ffcc
        const otaPayload = [
            0x10,                             // Direction: host→device
            firmwareSize & 0xFF,              // Size bytes 0-3 (little-endian)
            (firmwareSize >> 8) & 0xFF,
            (firmwareSize >> 16) & 0xFF,
            (firmwareSize >> 24) & 0xFF,
            firmwareChecksum & 0xFF,          // Checksum bytes 0-3 (little-endian)
            (firmwareChecksum >> 8) & 0xFF,
            (firmwareChecksum >> 16) & 0xFF,
            (firmwareChecksum >> 24) & 0xFF
        ];
        const frame = buildOtaFrame(0x50, new Uint8Array(otaPayload));
        log(`🔍 Size frame (${frame.length} bytes): ${formatBytes(frame)}`);
        logOutgoing(frame, 'Size Command (BLE OTA format)');
        await txCharacteristic.writeValueWithoutResponse(frame);
        try {
            log('✅ Firmware size sent to FF01 (write), expecting response on FF02 (notify)...');
        } catch (logError) {
            console.error('Log error:', logError);
        }
        
        // Wait for ACK - in BLE OTA mode, device responds with 0x50 to 0x50
        try {
        } catch (logError2) {
            console.error('Log error 2:', logError2);
        }
        const ack = await waitForAck(0x50, 5000); // BLE OTA handler echoes the command
        if (!ack.ok) {
            log(`❌ Size ACK failed: ${ack.reason}`);
            return false;
        }
        
        
        // Verify device echoed our firmware checksum in the ACK payload
        // Payload: [DIR][SIZE(4)][CHECKSUM(4)] -> checksum at positions 5-8
        try {
            if (ack.payload.length >= 9) {
                const echoedChecksum = ack.payload[5] | (ack.payload[6] << 8) | (ack.payload[7] << 16) | (ack.payload[8] << 24);
                log(`🔍 Checksum comparison: expected=0x${(firmwareChecksum >>> 0).toString(16)}, received=0x${echoedChecksum.toString(16)}`);
                if (echoedChecksum === (firmwareChecksum >>> 0)) { // >>> 0 ensures unsigned comparison
                    log(`✅ Firmware checksum verified: 0x${echoedChecksum.toString(16)}`);
                } else {
                    log(`⚠️ Firmware checksum mismatch: sent 0x${(firmwareChecksum >>> 0).toString(16)}, got 0x${echoedChecksum.toString(16)}`);
                }
            } else {
                log(`⚠️ Size ACK payload too short: ${ack.payload.length} bytes, expected ≥9`);
            }
        } catch (checksumError) {
            log(`❌ Checksum verification error: ${checksumError.message}`);
        }
        
        log('✅ Firmware size confirmed');
        return true;
    } catch (error) {
        log(`❌ Failed to send firmware size: ${error.message}`);
        return false;
    }
}

/**
 * Send firmware data chunk
 * @param {Uint8Array} chunkData - Chunk data to send
 * @param {number} offset - Offset in firmware file
 * @param {number} chunkIndex - Current chunk index
 * @param {number} totalChunks - Total number of chunks
 * @returns {Promise<boolean>} Success status
 */
async function sendFirmwareChunk(chunkData, offset, chunkIndex, totalChunks) {
    if (!txCharacteristic) {
        log('❌ TX characteristic not ready');
        return false;
    }

    try {
        // Step 3: Send firmware chunk with cmd=0x51 in format: [DIR][OFFSET][DATA]
        const frame = buildDataFrame(offset, chunkData);
        
        // Only log verbose output for first few chunks, every 50th chunk, and last chunk
        const isVerbose = chunkIndex <= 3 || chunkIndex % 50 === 0 || chunkIndex === totalChunks;
        
        if (isVerbose) {
            logOutgoing(frame, `Data Chunk ${chunkIndex}/${totalChunks}`);
            log(`📤 Sent chunk ${chunkIndex}/${totalChunks} at offset 0x${offset.toString(16)} (${chunkData.length} bytes)`);
        }
        
        await txCharacteristic.writeValueWithoutResponse(frame);
        
        // Update progress - this is lightweight and won't cause issues
        const progress = Math.round((chunkIndex / totalChunks) * 100);
        if (document.getElementById('otaProgress')) {
            document.getElementById('otaProgress').style.width = `${progress}%`;
        }
        if (document.getElementById('otaStatus')) {
            document.getElementById('otaStatus').textContent = 
                `Uploading: ${chunkIndex}/${totalChunks} chunks (${progress}%)`;
        }
        
        // Show progress in log every 10 chunks instead of every chunk
        if (chunkIndex % 10 === 0 || chunkIndex === totalChunks) {
            log(`📊 Progress: ${progress}% (${chunkIndex}/${totalChunks} chunks)`);
        }
        
        // Wait for ACK (cmd=0x51) with echoed offset
        const ack = await waitForAck(0x51, 1500);
        if (!ack.ok) {
            log(`❌ Chunk ${chunkIndex} ACK failed: ${ack.reason}`);
            return false;
        }
        
        // Verify device echoed back the correct offset (after DIR field at position 0)
        if (ack.payload.length >= 5) {
            const echoedOffset = ack.payload[1] | (ack.payload[2] << 8) | (ack.payload[3] << 16) | (ack.payload[4] << 24);
            if (echoedOffset === offset) {
                log(`✅ Chunk ${chunkIndex} confirmed at offset 0x${offset.toString(16)}`);
            } else {
                log(`⚠️ Offset mismatch: sent 0x${offset.toString(16)}, got 0x${echoedOffset.toString(16)}`);
            }
        } else {
            log(`✅ Chunk ${chunkIndex} confirmed (no offset echo)`);
        }
        
        return true;
    } catch (error) {
        log(`❌ Failed to send chunk ${chunkIndex}: ${error.message}`);
        return false;
    }
}

/**
 * Send OTA finalization command
 * @returns {Promise<boolean>} Success status
 */
async function sendOTAFinalize() {
    if (!txCharacteristic) {
        log('❌ TX characteristic not ready');
        return false;
    }

    try {
        log('🏁 Sending OTA finalization command...');
        // Step 4: Send finalize command with cmd=0x52 in BLE OTA format
        const frame = buildFinishFrame();
        logOutgoing(frame, 'Finalize Command');
        await txCharacteristic.writeValueWithoutResponse(frame);
        log('✅ OTA finalize command sent to FF01, waiting for confirmation on FF02...');
        
        // Wait for ACK (cmd=0x52) with payload indicating success (0x01) or failure
        const ack = await waitForAck(0x52, 3000);
        if (!ack.ok) {
            log(`❌ Finalize ACK failed: ${ack.reason}`);
            return false;
        }
        
        // For 0x52 ACK: payload[0]=DIR(0x00), payload[1]=status (0x01=success, 0x00=failure)
        if (ack.payload.length >= 2 && ack.payload[0] === 0x00 && ack.payload[1] === 0x01) {
            log('✅ OTA finalization successful - device will restart');
            return true;
        } else {
            const dir = ack.payload.length >= 1 ? `0x${ack.payload[0].toString(16)}` : 'none';
            const status = ack.payload.length >= 2 ? `0x${ack.payload[1].toString(16)}` : 'none';
            log(`❌ OTA finalization failed - dir: ${dir}, status: ${status}`);
            return false;
        }
    } catch (error) {
        log(`❌ Failed to finalize OTA update: ${error.message}`);
        return false;
    }
}

/**
 * Perform complete OTA firmware update
 */
async function performOTAUpdate() {
    if (!firmwareData) {
        log('❌ No firmware file selected');
        return;
    }

    if (otaInProgress) {
        log('⚠️ OTA update already in progress');
        return;
    }

    otaInProgress = true;
    otaCurrentChunk = 0;
    
    // Disable all command buttons during OTA
    if (window.uiController && window.uiController.setOTAMode) {
        window.uiController.setOTAMode(true);
    }
    
    try {
        log(`🚀 Starting OTA update...`);
        log(`📄 Firmware size: ${firmwareData.byteLength} bytes`);
        
        // Step 0: Connect and prepare OTA characteristics
        await connectAndPrepareOTA();
        
        // Calculate chunks using computed chunk size
        otaTotalChunks = Math.ceil(firmwareData.byteLength / otaChunkSize);
        log(`📦 Total chunks: ${otaTotalChunks} (${otaChunkSize} bytes each)`);
        
        // Step 1: Send activation command 0x1F to enter upgrade mode
        if (!await sendOTAActivate()) {
            throw new Error('Failed to activate upgrade mode');
        }
        
        // Longer delay after activation to allow device to fully switch to OTA mode
        log('⏱️ Waiting 1500ms after OTA activation for mode switch...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Step 2: Send 0x3A probe with retry logic (based on Wireshark timing)
        log('🔍 Sending 0x3A probe with Wireshark-verified payload...');
        
        let otaAck = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Use exact Wireshark payload since it's from the same BMS 215 device
                // Payload: [0x10, 0xd7, 0x00, 0x03, 0xaa, 0xbb] from working session
                const otaProbeFrame = buildOtaFrame(0x3A, new Uint8Array([0x10, 0xd7, 0x00, 0x03, 0xaa, 0xbb]));
                logOutgoing(otaProbeFrame, `OTA Discovery Probe (0x3A) - Attempt ${attempt}/${maxRetries}`);
                log(`🔧 DEBUG: Sending 0x3A probe to characteristic FF01 (write), expecting response on FF02 (notify)`);
                await txCharacteristic.writeValueWithoutResponse(otaProbeFrame);
                
                // Wait for 0x3A ACK - expect response with payload [0x00, 0x00, 0x00, 0x00, 0x00, 0x01]
                otaAck = await waitForAck(0x3A, 2000);
                if (otaAck && otaAck.ok) {
                    log(`✅ 0x3A handshake successful on attempt ${attempt}`);
                    break;
                }
            } catch (error) {
                log(`⚠️ 0x3A probe attempt ${attempt} failed: ${error.message}`);
                if (attempt < maxRetries) {
                    log('⏱️ Waiting 1000ms before retry...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        if (!otaAck || !otaAck.ok) {
            throw new Error(`OTA channel discovery failed after ${maxRetries} attempts: ${otaAck ? otaAck.reason : 'timeout'}`);
        }
        log('✅ OTA channel discovered and activated with Wireshark-verified format');
        
        // Step 3: Send firmware size with session token
        if (!await sendFirmwareSize(firmwareData.byteLength)) {
            throw new Error('Failed to send firmware size');
        }
        
        // Step 3: Send firmware data in chunks
        log('📤 Starting firmware data transfer...');
        let offset = 0;
        let chunkIndex = 0;
        
        while (offset < firmwareData.byteLength) {
            const end = Math.min(offset + otaChunkSize, firmwareData.byteLength);
            const chunk = new Uint8Array(firmwareData.slice(offset, end));
            
            let retryCount = 0;
            let chunkSent = false;
            
            while (!chunkSent && retryCount < 3) {
                try {
                    if (!await sendFirmwareChunk(chunk, offset, chunkIndex + 1, otaTotalChunks)) {
                        throw new Error(`Failed to send chunk ${chunkIndex + 1}`);
                    }
                    chunkSent = true;
                    offset += chunk.length;
                    chunkIndex++;
                } catch (error) {
                    retryCount++;
                    log(`⚠️ Retry ${retryCount}/3 for chunk ${chunkIndex + 1}: ${error.message}`);
                    if (retryCount >= 3) {
                        throw new Error(`Failed to send chunk ${chunkIndex + 1} after 3 retries`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small backoff
                }
            }
        }
        
        // Step 4: Finalize OTA update
        log('🏁 Finalizing OTA update...');
        if (!await sendOTAFinalize()) {
            throw new Error('Failed to finalize OTA update');
        }
        
        log('✅ OTA update completed successfully!');
        if (document.getElementById('otaStatus')) {
            document.getElementById('otaStatus').textContent = 'Update completed! Device will restart...';
        }
        
    } catch (error) {
        log(`❌ OTA update failed: ${error.message}`);
        if (document.getElementById('otaStatus')) {
            document.getElementById('otaStatus').textContent = `Update failed: ${error.message}`;
        }
    } finally {
        otaInProgress = false;
        
        // Re-enable command buttons after OTA
        if (window.uiController && window.uiController.setOTAMode) {
            window.uiController.setOTAMode(false);
        }
    }
}

/**
 * Handle firmware file selection
 * @param {Event} event - File input change event
 */
function handleFirmwareFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    log(`📁 Selected firmware file: ${file.name} (${file.size} bytes)`);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        firmwareData = e.target.result;
        
        // Analyze firmware to get type and checksum info
        const analysis = analyzeFirmware(firmwareData);
        
        // Update UI with detailed firmware info
        if (document.getElementById('otaFileInfo')) {
            let warningHtml = '';
            if (analysis.warning) {
                warningHtml = `<br><span style="color: #ff6b35; font-weight: bold;">${analysis.warning}</span>`;
            }
            document.getElementById('otaFileInfo').innerHTML = `
                <strong>File:</strong> ${file.name} (${file.size.toLocaleString()} bytes)<br>
                <strong>Type:</strong> ${analysis.type}<br>
                <strong>Checksum:</strong> 0x${analysis.checksum.toString(16).padStart(8, '0').toUpperCase()}${warningHtml}
            `;
        }
        
        // Enable start button only if connected and file loaded
        const startBtn = document.getElementById('otaStartBtn');
        if (startBtn && device && device.gatt && device.gatt.connected) {
            startBtn.disabled = false;
        }
        
        // Show progress container
        if (document.getElementById('otaProgressContainer')) {
            document.getElementById('otaProgressContainer').style.display = 'block';
        }
        if (document.getElementById('otaStatus')) {
            document.getElementById('otaStatus').textContent = 'Ready to start...';
        }
        
        log('✅ Firmware file analyzed and ready for upload');
    };
    reader.readAsArrayBuffer(file);
}

// ========================================
// SPECIALIZED COMMAND FUNCTIONS
// ========================================

/**
 * Set current date and time on device
 */
function setCurrentDateTime() {
    if (!(window.uiController ? window.uiController.isConnected() : false)) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    
    // Format: [year_low, year_high, month, day, hour, minute, second]
    const payload = [
        year & 0xFF,           // Year low byte
        (year >> 8) & 0xFF,    // Year high byte  
        month,
        day,
        hour,
        minute,
        second
    ];
    
    log(`🕐 Setting time to ${year}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')} ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}:${second.toString().padStart(2,'0')}`);
    sendCommand(0x0B, 'Set Date/Time', payload);
}

/**
 * Set local API port with user input
 */
function setLocalApiPort() {
    if (!(window.uiController ? window.uiController.isConnected() : false)) return;
    
    const portInput = prompt('Enter the local API port number (1-65535):', '8080');
    if (!portInput) return;
    
    const port = parseInt(portInput);
    if (isNaN(port) || port < 1 || port > 65535) {
        log('❌ Invalid port number. Must be between 1 and 65535.');
        return;
    }
    
    // Format: [enable_flag, port_low, port_high]
    const payload = [
        0x01,                  // Enable flag (1 = enable with port)
        port & 0xFF,           // Port low byte
        (port >> 8) & 0xFF     // Port high byte
    ];
    
    log(`🌐 Setting local API port to ${port}`);
    sendCommand(0x28, `Set Local API Port ${port}`, payload);
}

/**
 * Disconnect from all Bluetooth devices
 */
async function disconnectAll() {
    log('🔌 Disconnecting from all Bluetooth devices...');
    try {
        disconnect();
        if (navigator.bluetooth && navigator.bluetooth.getDevices) {
            const devices = await navigator.bluetooth.getDevices();
            let disconnectedCount = 0;
            for (const pairedDevice of devices) {
                if (pairedDevice.gatt && pairedDevice.gatt.connected) {
                    await pairedDevice.gatt.disconnect();
                    disconnectedCount++;
                }
            }
            if (disconnectedCount > 0) {
                log(`✅ Disconnected from ${disconnectedCount} additional paired device(s)`);
            } else {
                log('ℹ️ No additional paired devices were connected');
            }
        }
        log('✅ Disconnect all completed');
    } catch (error) {
        log(`❌ Error during disconnect all: ${error.message}`);
    }
}

/**
 * Run comprehensive test sequence
 */
async function runAllTests() {
    if (!(window.uiController ? window.uiController.isConnected() : false)) return;
    
    log('🧪 Starting comprehensive test sequence...');
    clearAll();
    
    const commands = [
        { cmd: 0x03, name: 'Runtime Info' },
        { cmd: 0x04, name: 'Device Info' },
        { cmd: 0x08, name: 'WiFi Info' },
        { cmd: 0x0D, name: 'System Data' },
        { cmd: 0x13, name: 'Error Codes' },
        { cmd: 0x14, name: 'BMS Data' },
        { cmd: 0x1A, name: 'Config Data' },
        { cmd: 0x1C, name: 'Event Log' },
        { cmd: 0x21, name: 'Read Meter IP', payload: [0x0B] },
        { cmd: 0x24, name: 'Network Info' }
    ];
    
    for (const test of commands) {
        log(`\n📋 Running test: ${test.name}`);
        await sendCommand(test.cmd, test.name, test.payload);
        // Wait 1 second between commands to avoid overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    log('\n✅ All tests completed! Check the hex dumps above for analysis.');
}



// ========================================
// DEVICE IDENTIFIER FUNCTIONS
// ========================================

/**
 * Read all device identifiers (VID, GID, XID)
 */
async function readDeviceIdentifiers() {
    if (!(window.uiController ? window.uiController.isConnected() : false)) {
        log('❌ Not connected to device');
        return;
    }
    
    log('📖 Reading device identifiers (VID, GID, XID)...');
    
    try {
        // Read VID Info
        log('🏷️ Reading VID (Vendor ID)...');
        await sendCommand(0x50, 'Read VID Info', [0x0D, 0x01]);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Read GID Info
        log('👥 Reading GID (Group ID)...');
        await sendCommand(0x50, 'Read GID Info', [0x0D, 0x02]);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Read XID Config
        log('⚙️ Reading XID (Extended ID)...');
        await sendCommand(0x50, 'Read XID Config', [0x0D, 0x03]);
        
        log('✅ Device identifier read complete');
    } catch (error) {
        logError(`Failed to read device identifiers: ${error.message}`);
    }
}

// ========================================
// CONFIGURATION MANAGEMENT FUNCTIONS
// ========================================

/**
 * Send configuration write command with user input
 * Command 80 (0x80) with sub-command 12 (0x0C) for XID config
 */
async function sendConfigWriteCommand() {
    if (!(window.uiController ? window.uiController.isConnected() : false)) {
        log('❌ Not connected to device');
        return;
    }
    
    // Prompt for configuration data with security warning
    const confirmWrite = confirm(
        '⚠️ WARNING: This will modify device server credentials!\n\n' +
        'This command writes server configuration including:\n' +
        '• Server URL\n' +
        '• Port number\n' +
        '• Username\n' +
        '• Password\n\n' +
        'Incorrect settings may prevent remote monitoring.\n\n' +
        'Do you want to continue?'
    );
    
    if (!confirmWrite) {
        log('ℹ️ Configuration write cancelled by user');
        return;
    }
    
    // Get configuration details from user
    const url = prompt("Enter server URL (e.g., server.example.com):");
    if (!url) {
        log('❌ Server URL is required');
        return;
    }
    
    const port = prompt("Enter port number (e.g., 8080):");
    if (!port || isNaN(port) || port <= 0 || port > 65535) {
        log('❌ Valid port number is required (1-65535)');
        return;
    }
    
    const username = prompt("Enter username:");
    if (!username) {
        log('❌ Username is required');
        return;
    }
    
    const password = prompt("Enter password:");
    if (!password) {
        log('❌ Password is required');
        return;
    }
    
    try {
        // Create payload in format: URL<.,.>port<.,.>username<.,.>password
        const delimiter = '<.,.>';
        const configString = `${url}${delimiter}${port}${delimiter}${username}${delimiter}${password}`;
        const configBytes = Array.from(new TextEncoder().encode(configString));
        
        // Add sub-command byte (0x0C = 12 for XID config write)
        const fullPayload = [0x0C, ...configBytes];
        
        const command = createCommandMessage(0x80, fullPayload);
        window.currentCommand = 'Write Configuration';
        
        log('📤 Sending Write Configuration...');
        log('⚠️  WARNING: Modifying device server credentials!');
        log(`📋 Config: URL=${url}, Port=${port}, User=${username}, Pass=${'*'.repeat(password.length)}`);
        log(`📋 Frame: ${formatBytes(command)}`);
        
        const writeChars = Object.values(characteristics).filter(char => 
            char.properties.write || char.properties.writeWithoutResponse
        );
        
        if (writeChars.length === 0) {
            log('❌ No writable characteristics found');
            return;
        }
        
        const writeChar = writeChars[0];
        logOutgoing(command, 'Config Write');
        await writeChar.writeValueWithoutResponse(command);
        log('✅ Configuration write command sent successfully');
        
    } catch (error) {
        log(`❌ Failed to send Write Configuration: ${error.message}`);
    }
}

// ========================================
// BROWSER COMPATIBILITY CHECK
// ========================================

// Check browser compatibility
if (!navigator.bluetooth) {
    log('❌ Web Bluetooth not supported');
}

// ========================================
// RETRY DIALOG FUNCTIONS
// ========================================

/**
 * Show the connection retry dialog
 */
function showRetryDialog() {
    const modal = document.getElementById('retryModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * Hide the retry dialog and attempt connection again
 */
function retryConnection() {
    const modal = document.getElementById('retryModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clear previous error logs
    logActivity('🔄 User requested connection retry');
    
    // Attempt connection again
    connect().catch(error => {
        // This will show the retry dialog again if it fails
        console.error('Retry connection failed:', error);
    });
}

/**
 * Hide the retry dialog and cancel connection attempts
 */
function cancelRetry() {
    const modal = document.getElementById('retryModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    logActivity('❌ Connection retry cancelled by user');
    
    // Ensure connection is fully cancelled
    connectionCancelled = true;
    
    // Clear all active timeouts
    clearAllActiveTimeouts();
    if (device && device.gatt && device.gatt.connected) {
        try {
            device.gatt.disconnect();
        } catch (e) {
            // Ignore disconnection errors
        }
    }
}

// Export functions for global access
if (typeof window !== 'undefined') {
    // Connection functions
    window.connect = connect;
    window.disconnect = disconnect;
    window.disconnectAll = disconnectAll;
    window.retryConnection = retryConnection;
    window.cancelRetry = cancelRetry;
    
    // Command sending functions
    window.sendCommand = sendCommand;
    window.sendMeterIPCommand = sendMeterIPCommand;
    window.sendConfigWriteCommand = sendConfigWriteCommand;
    window.readDeviceIdentifiers = readDeviceIdentifiers;
    
    // Utility functions
    window.formatBytes = formatBytes;
    window.createCommandMessage = createCommandMessage;
    
    // OTA functions
    window.handleFirmwareFile = handleFirmwareFile;
    window.performOTAUpdate = performOTAUpdate;
    
    // Test functions
    window.runAllTests = runAllTests;
    window.setCurrentDateTime = setCurrentDateTime;
    window.setLocalApiPort = setLocalApiPort;
}