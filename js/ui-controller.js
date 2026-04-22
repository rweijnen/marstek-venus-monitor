/**
 * Marstek Venus E Monitor - UI Controller
 * Handles all user interface interactions, DOM manipulation, modals, and logging
 * Extracted from index.html for better code organization
 */

// ==========================================
// UI STATE MANAGEMENT
// ==========================================

let isConnected = false;
let deviceType = 'unknown'; // 'battery', 'meter', or 'unknown'

// ==========================================
// DISCLAIMER MODAL HANDLING
// ==========================================

// Disclaimer handling
document.getElementById('acceptRisk').addEventListener('change', function() {
    document.getElementById('acceptBtn').disabled = !this.checked;
});

function declineAndExit() {
    window.close();
    // If window.close() fails (most browsers), redirect to a safe page
    setTimeout(() => {
        window.location.href = 'about:blank';
    }, 100);
}

function acceptAndContinue() {
    document.getElementById('disclaimerModal').style.display = 'none';
    document.getElementById('mainInterface').style.display = 'block';
    
    // Store acceptance in localStorage
    localStorage.setItem('marstek-disclaimer-accepted', new Date().toISOString());
    
    log('✅ Disclaimer accepted - Marstek Venus E Monitor ready');
    log('⚠️ Remember: This is experimental software - use with caution');
}

// Check if disclaimer was already accepted (within last 24 hours)
function checkDisclaimerAcceptance() {
    const lastAccepted = localStorage.getItem('marstek-disclaimer-accepted');
    if (lastAccepted) {
        const acceptedDate = new Date(lastAccepted);
        const now = new Date();
        const hoursSinceAccepted = (now - acceptedDate) / (1000 * 60 * 60);
        
        // Require re-acceptance after 24 hours
        if (hoursSinceAccepted < 24) {
            document.getElementById('disclaimerModal').style.display = 'none';
            document.getElementById('mainInterface').style.display = 'block';
        }
    }
}

// ==========================================
// LOGGING AND ERROR HANDLING
// ==========================================

// Log function that routes to new tabbed logging system
function log(message) {
    // Route to appropriate logging function based on content
    if (message.includes('Error') || message.includes('Failed') || message.includes('❌')) {
        if (typeof logError !== 'undefined') {
            logError(message);
        }
    } else {
        if (typeof logActivity !== 'undefined') {
            logActivity(message);
        }
    }
}

function showError(message) {
    log(`❌ Error: ${message}`);
    
    // Also show in UI if there's an error display element
    const errorDiv = document.getElementById('errorDisplay');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

function clearAll() {
    const logDiv = document.getElementById('log');
    const dataDisplay = document.getElementById('dataDisplay');
    
    if (logDiv) logDiv.textContent = '';
    if (dataDisplay) dataDisplay.innerHTML = '';
    
    log('🗑️ Display cleared');
}

// ==========================================
// CONNECTION STATUS MANAGEMENT
// ==========================================

function updateStatus(connected, deviceName = null) {
    const statusEl = document.getElementById('status');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const disconnectAllBtn = document.getElementById('disconnectAllBtn');
    const runAllBtn = document.getElementById('runAllBtn');
    
    if (!statusEl) return;
    
    if (connected && deviceName) {
        statusEl.textContent = `Connected to ${deviceName}`;
    } else {
        statusEl.textContent = connected ? 'Connected' : 'Disconnected';
    }
    statusEl.className = connected ? 'connected' : 'disconnected';
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    // Disconnect All should always be enabled to clean up lingering connections
    disconnectAllBtn.disabled = false;
    runAllBtn.disabled = !connected;
    
    // Update all command buttons
    updateButtonStates(connected);
    
    isConnected = connected;
}

// ==========================================
// BUTTON STATE MANAGEMENT
// ==========================================

/**
 * Update button states based on connection status
 * This is a standalone function that can be called from other modules
 */
function updateButtonStates(connected) {
    // Use data attribute to mark buttons that require connection
    const connectionButtons = document.querySelectorAll('button[data-requires-connection="true"]');
    connectionButtons.forEach(btn => btn.disabled = !connected);
}

// Make it globally available
window.updateButtonStates = updateButtonStates;

// ==========================================
// DATA DISPLAY FUNCTIONS
// ==========================================

function displayData(content) {
    const displayDiv = document.getElementById('dataDisplay');
    if (!displayDiv) return;
    
    // Handle new unified HTML content from data parser
    if (typeof content === 'string') {
        // Add timestamp to the title
        const now = new Date();
        const timestamp = now.toLocaleTimeString(undefined, { hour12: false });
        
        // Inject timestamp into the h3 title
        const contentWithTimestamp = content.replace(
            /(<h3[^>]*>.*?)(<\/h3>)/,
            `$1 <span style="color: #666; font-weight: normal; font-size: 0.8em;">[${timestamp}]</span>$2`
        );
        
        const card = document.createElement('div');
        card.className = 'data-card';
        card.innerHTML = contentWithTimestamp;
        
        // Prepend new card to show on top
        displayDiv.prepend(card);
        
        // Limit display to 10 most recent items (remove from end)
        while (displayDiv.children.length > 10) {
            displayDiv.removeChild(displayDiv.lastChild);
        }
        
        return;
    }
    
    // Legacy support: handle old format (title, data)
    const title = arguments[0];
    const data = arguments[1];
    
    const card = document.createElement('div');
    card.className = 'data-card';
    
    let html = `<h3>${title}</h3>`;
    
    if (typeof data === 'object' && !Array.isArray(data)) {
        html += '<div class="data-grid"><div>';
        for (const [key, value] of Object.entries(data)) {
            if (key === 'cellVoltages' && Array.isArray(value)) {
                html += `
                    <div class="data-item">
                        <span class="data-label">Cell Voltages:</span>
                        <span class="data-value">${value.map(v => v + 'V').join(', ')}</span>
                    </div>
                `;
            } else {
                const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                                   typeof value === 'string' && value.includes('W') ? value :
                                   typeof value === 'string' && value.includes('°C') ? value :
                                   typeof value === 'string' && value.includes('%') ? value :
                                   typeof value === 'string' && value.includes('V') ? value :
                                   typeof value === 'number' && key.includes('ower') ? value + 'W' :
                                   typeof value === 'number' && key.includes('emperature') ? value + '°C' :
                                   typeof value === 'number' && key.includes('oltage') && !key.includes('ell') ? value + 'V' :
                                   typeof value === 'number' && key === 'unknownValue' ? value + ' (counter?)' :
                                   value;
                
                html += `
                    <div class="data-item">
                        <span class="data-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                        <span class="data-value">${displayValue}</span>
                    </div>
                `;
            }
        }
        html += '</div></div>';
    } else if (Array.isArray(data)) {
        if (data.length > 0 && data[0].timestamp) {
            data.forEach(item => {
                const className = title.includes('Error') ? 'error-entry' : 'event-log';
                html += `<div class="${className}">${item.timestamp} - Type: ${item.type || item.code}${item.code && item.type ? ', Code: ' + item.code : ''}</div>`;
            });
        } else {
            html += `<div class="data-item"><span class="data-value">${data.join(', ')}</span></div>`;
        }
    } else {
        html += `<div class="data-item"><span class="data-value">${data}</span></div>`;
    }
    
    card.innerHTML = html;
    displayDiv.appendChild(card);
    
    // Limit display to 10 most recent items
    while (displayDiv.children.length > 10) {
        displayDiv.removeChild(displayDiv.firstChild);
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatBytes(data) {
    return Array.from(new Uint8Array(data.buffer || data))
        .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
}

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

// ==========================================
// FIRMWARE/OTA UI FUNCTIONS
// ==========================================

// handleFirmwareFile is handled by BLE protocol - removed duplicate function

function updateOTAProgress(percent, status) {
    const progressBar = document.getElementById('otaProgress');
    const statusEl = document.getElementById('otaStatus');
    
    if (progressBar) progressBar.style.width = percent + '%';
    if (statusEl) statusEl.textContent = status;
}

// ==========================================
// VERSION INFORMATION
// ==========================================

async function displayVersionInfo() {
    try {
        const response = await fetch('https://api.github.com/repos/rweijnen/marstek-venus-monitor/commits/main');
        if (response.ok) {
            const data = await response.json();
            const commitSha = data.sha.substring(0, 7);
            const commitDate = new Date(data.commit.author.date).toLocaleString();
            const commitMessage = data.commit.message.split('\n')[0]; // First line only
            
            document.getElementById('versionInfo').innerHTML = 
                `<small>Version: <code>${commitSha}</code> - ${commitMessage} (${commitDate})</small>`;
        } else {
            document.getElementById('versionInfo').innerHTML = 
                '<small>Version: Unable to fetch version info</small>';
        }
    } catch (error) {
        document.getElementById('versionInfo').innerHTML = 
            '<small>Version: ' + window.location.hostname + '</small>';
    }
}

// ==========================================
// COMMAND INFO MODAL
// ==========================================

// Command information data
const commandInfo = {
    runtime: {
        title: '⚡ Runtime Info (0x03)',
        description: 'Real-time power flow, temperatures, and system status',
        command: '0x73 0x04 0x23 0x03 [checksum]',
        response: '38+ bytes of runtime data including power, voltage, temperature, and status flags',
        sampleData: 'Input: 1250W, Output: 800W, Temperature: 25°C, Battery: 85%',
        notes: '🔍 Shows live system metrics. Response format varies by device type (battery vs meter).'
    },
    device: {
        title: '📱 Device Info (0x04)',
        description: 'Device model, MAC address, and firmware versions',
        command: '0x73 0x04 0x23 0x04 [checksum]',
        response: 'Device name, MAC address, firmware version, and hardware details',
        sampleData: 'Model: Venus E, MAC: 12:34:56:78:9A:BC, FW: v2.1.0',
        notes: '📋 Essential device identification and version information.'
    },
    wifi: {
        title: '📶 WiFi Info (0x08)',
        description: 'Connected WiFi network name (SSID)',
        command: '0x73 0x04 0x23 0x08 [checksum]',
        response: 'SSID of currently connected wireless network',
        sampleData: 'Connected to: MyNetwork_5G',
        notes: '🌐 Shows current WiFi connection. Empty if using Ethernet or disconnected.'
    },
    system: {
        title: '🔧 System Data (0x0D)',
        description: 'System operational parameters',
        command: '0x73 0x04 0x23 0x0D [checksum]',
        response: 'System configuration and operational status data',
        sampleData: 'Various system parameters and operational flags',
        notes: '⚙️ Internal system metrics and configuration status.'
    },
    errors: {
        title: '📅 BLE Event Log (0x13)',
        description: 'BLE event log with timestamps only',
        command: '0x73 0x04 0x23 0x13 [checksum]',
        response: 'List of event entries with timestamps and validity flags',
        sampleData: '2025-02-25 15:22:00 - Valid Event (Flag: 0x80)',
        notes: '📝 BLE event log with timestamps. No error codes included.'
    },
    bms: {
        title: '🔋 BMS Data (0x14)',
        description: 'Battery voltages, current, SOC, and cell data',
        command: '0x73 0x04 0x23 0x14 [checksum]',
        response: 'Battery Management System data including cell voltages, current, and State of Charge',
        sampleData: 'Cells: 3.45V, 3.47V, 3.46V, Current: -5.2A, SOC: 85%',
        notes: '🔋 Detailed battery health and performance metrics.'
    },
    config: {
        title: '⚙️ Config Data (0x1A)',
        description: 'System configuration parameters',
        command: '0x73 0x04 0x23 0x1A [checksum]',
        response: 'Configuration parameters and system settings',
        sampleData: 'Power limits, charging parameters, system preferences',
        notes: '📋 Current system configuration and user-defined settings.'
    },
    events: {
        title: '📝 HM Event Log (0x1C)',
        description: 'HM event history with timestamps and event codes',
        command: '0x73 0x04 0x23 0x1C [checksum]',
        response: 'Compact event records with timestamps, type, and 16-bit event codes',
        sampleData: '2025-08-30 22:10 - Type: 0x04, Code: 0x019C',
        notes: '📅 HM event log with 9-byte records including event codes.'
    },
    meterip: {
        title: '🌐 Read P1 Meter IP (0x21)',
        description: 'Read P1 power meter IP address from device configuration',
        command: '0x73 0x06 0x23 0x21 0x0B [checksum]',
        response: '16 bytes ASCII IP string, NUL-terminated and zero-padded',
        sampleData: '"192.168.1.50" (31 39 32 2E 31 36 38 2E 31 2E 35 30 00 00 00 00)',
        notes: '🔍 Reads the IP address of the connected P1 meter. Sub-command 0x0B reads the 16-byte IP buffer. Returns all zeros if no meter IP is configured.'
    },
    network: {
        title: '🔗 Network Info (0x24)',
        description: 'IP address, gateway, subnet mask, DNS',
        command: '0x73 0x04 0x23 0x24 [checksum]',
        response: 'Complete network configuration including IP, subnet, gateway, and DNS',
        sampleData: 'IP: 192.168.1.100, Gateway: 192.168.1.1, DNS: 8.8.8.8',
        notes: '🌐 Full network configuration details for diagnostics.'
    },
    ctpollread: {
        title: '📊 Read CT Timing Profile (via Runtime Info)',
        description: 'The CT timing profile index is not readable via a dedicated command — it is exposed as byte 0x5F of the Runtime Info (cmd 0x03) response.',
        command: 'Send cmd 0x03 (Runtime Info); look at the "CT Timing Profile" line',
        response: 'One of 0, 1, 2 (matches the value written by cmd 0x22).',
        sampleData: 'See the Runtime Info display — "CT Timing Profile (0x5F): 1 — default (~2.0 s/cycle)"',
        notes: '⚠️ The previous "Read CT Polling Rate" button sent cmd 0x22 with no payload. Firmware case 34 reads frame[4] unconditionally — with no payload that is the checksum byte, and if the checksum happens to be ≤ 2 the firmware silently corrupts the timing profile. Button removed. The set buttons (cmd 0x22 with explicit [0/1/2]) are the only safe path.'
    },
    apiread: {
        title: '🌐 Read Local API Status (0x28)',
        description: 'Read current Local API configuration and status',
        command: '0x73 0x04 0x23 0x28 [checksum]',
        response: '3 bytes: [enable_flag, port_low, port_high]',
        sampleData: '0x01 0x50 0x1F = Enabled on port 8080',
        notes: '🔍 Returns current API state (0x00=disabled, 0x01=enabled) and configured port number in little-endian format. Use this to verify API settings before making changes.'
    },
    power800: {
        title: '⚡ Set 800W Mode (0x15)',
        description: 'Set maximum output power to 800W',
        command: '0x73 0x06 0x23 0x15 0x20 0x03 [checksum]',
        response: 'Confirmation of power limit change',
        sampleData: 'Power limit set to 800W',
        notes: '⚠️ Immediately limits output power. May affect connected loads.'
    },
    power2500: {
        title: '⚡ Set 2500W Mode (0x15)',
        description: 'Set maximum output power to 2500W',
        command: '0x73 0x06 0x23 0x15 0xC4 0x09 [checksum]',
        response: 'Confirmation of power limit change',
        sampleData: 'Power limit set to 2500W',
        notes: '⚠️ Immediately changes output power limit. Ensure system can handle load.'
    },
    acpower: {
        title: '⚡ Set AC Power 2500W (0x16)',
        description: 'Set AC input power limit to 2500W',
        command: '0x73 0x06 0x23 0x16 0xC4 0x09 [checksum]',
        response: 'Confirmation of AC input power limit',
        sampleData: 'AC input limit set to 2500W',
        notes: '🔌 Controls how much power can be drawn from AC input (grid/generator).'
    },
    totalpower: {
        title: '⚡ Set Total Power 2500W (0x17)',
        description: 'Set total system power limit to 2500W',
        command: '0x73 0x06 0x23 0x17 0xC4 0x09 [checksum]',
        response: 'Confirmation of total system power limit',
        sampleData: 'Total system power limit set to 2500W',
        notes: '🔋 Sets overall system power limit combining all sources.'
    },
    server0: {
        title: '🌐 Set Server Type 0 (0x02)',
        description: 'Configure server connection type to 0',
        command: '0x73 0x05 0x23 0x02 0x00 [checksum]',
        response: 'Server type configuration confirmation',
        sampleData: 'Server type set to 0',
        notes: '⚙️ Changes server connection configuration. Effect varies by firmware.'
    },
    eps: {
        title: '🔄 EPS Mode Control (0x05)',
        description: 'Enable/disable Emergency Power Supply mode',
        command: 'Enable: 0x73 0x05 0x23 0x05 0x01 [checksum]<br>Disable: 0x73 0x05 0x23 0x05 0x00 [checksum]',
        response: 'EPS mode status confirmation',
        sampleData: 'EPS Mode: Enabled/Disabled',
        notes: '🔄 Emergency Power Supply mode. When enabled, system provides backup power during grid outage.'
    },
    acinput: {
        title: '🔌 AC Input Control (0x06)',
        description: 'Enable/disable AC input (grid power)',
        command: 'Enable: 0x73 0x05 0x23 0x06 0x01 [checksum]<br>Disable: 0x73 0x05 0x23 0x06 0x00 [checksum]',
        response: 'AC input status confirmation',
        sampleData: 'AC Input: Enabled/Disabled',
        notes: '🔌 Controls whether system accepts power from AC input (grid/generator).'
    },
    genstart: {
        title: '⚡ Generator Start/Stop (0x07)',
        description: 'Start or stop connected generator',
        command: 'Start: 0x73 0x05 0x23 0x07 0x01 [checksum]<br>Stop: 0x73 0x05 0x23 0x07 0x00 [checksum]',
        response: 'Generator control confirmation',
        sampleData: 'Generator: Started/Stopped',
        notes: '🔧 Controls external generator if connected. Use with caution.'
    },
    buzzer: {
        title: '🔊 Buzzer Control (0x09)',
        description: 'Enable/disable system buzzer/alarm',
        command: 'Enable: 0x73 0x05 0x23 0x09 0x01 [checksum]<br>Disable: 0x73 0x05 0x23 0x09 0x00 [checksum]',
        response: 'Buzzer status confirmation',
        sampleData: 'Buzzer: Enabled/Disabled',
        notes: '🔊 Controls audible alerts and notifications.'
    },
    reset: {
        title: '🔄 System Reset (0x0A)',
        description: 'Perform system reset',
        command: '0x73 0x05 0x23 0x0A 0x01 [checksum]',
        response: 'System will reset and disconnect',
        sampleData: 'System resetting...',
        notes: '⚠️ CAUTION: Forces immediate system restart. May interrupt operations.'
    },
    restore: {
        title: '🏭 Factory Reset (0x0B)',
        description: 'Restore factory default settings',
        command: '0x73 0x05 0x23 0x0B 0x01 [checksum]',
        response: 'Factory reset confirmation (system may restart)',
        sampleData: 'Settings restored to factory defaults',
        notes: '🏭 WARNING: Erases all user settings and returns to factory defaults!'
    },
    datetime: {
        title: '⏰ Set Current Date/Time (0x1B)',
        description: 'Set system date and time to current local time',
        command: '0x73 0x0A 0x23 0x1B [YY] [MM] [DD] [HH] [MM] [SS] [checksum]',
        response: 'Date/time set confirmation',
        sampleData: 'DateTime set to: 2024-01-15 14:30:25',
        notes: '🕐 Sets system clock to current local time. Important for accurate logging and scheduling.'
    },
    setdevicetime: {
        title: '🕐 Set Device Time (0x0B)',
        description: 'Sets device RTC clock to current browser time',
        command: '0x73 0x0C 0x23 0x0B [year_lo] [year_hi] [month] [day] [hour] [minute] [second] [checksum]',
        response: 'Status confirmation or error code',
        sampleData: 'Time set to 2025-09-30 14:05:00',
        notes: '⚠️ WARNING: Changes device clock permanently. May affect daily/monthly energy counter resets and event log timestamps. Payload is 7 bytes: year (LE, full year like 0xE9 0x07 for 2025), month (1-12), day (1-31), hour (0-23), minute (0-59), second (0-59). Example frame: 73 0C 23 0B E9 07 09 1E 0E 05 00 A5'
    },
    ctpoll0: {
        title: '📊 Set CT Timing Profile = 0 — fastest (~0.8 s/cycle)',
        description: 'Disable the post-CT-parse cooldown. Firmware inserts vTaskDelay(1200 × N) after each successful CT meter read. With N=0, no extra delay — each cycle is only the base loop (~0.8 s).',
        command: '0x73 0x06 0x23 0x22 0x00 [checksum]',
        response: 'Echoed: one byte, the value that the setter stored (0, 1, or 2 after clamp).',
        sampleData: 'Response payload: 0x00',
        notes: '⚡ Value 0 → 0 ticks extra cooldown. "CT polling rate" is a misnomer: the base 300/5/500-tick poll loop is hard-coded and cannot be changed from BLE/MQTT; only this extra cooldown is tunable.<br><br>' +
               '<strong>Clamping / ranges:</strong> setter (firmware sub_8006368) accepts only 0..2. Any value ≥3 is silently rejected (stored byte unchanged). Response echoes the raw input — so an out-of-range response means the store was rejected.<br><br>' +
               '<strong>Persistence:</strong> EEPROM 0x37B + mirror 0x375. Survives reboot.<br><br>' +
               '<strong>Side effect:</strong> the same byte is used by firmware sub_8005458 as an index into a separate debounce-timeout lookup (2 entries in ms: N×1000 grace, (N+3)×1000 hard). That path was not fully traced — setting 0 may zero that grace window.<br><br>' +
               '<strong>To read current value:</strong> send cmd 0x03 (Runtime Info), look at byte 0x5F / the "CT Timing Profile" line.'
    },
    ctpoll1: {
        title: '📊 Set CT Timing Profile = 1 — default (~2.0 s/cycle)',
        description: 'Default cooldown: ~1.2 s extra after each successful CT meter read (on top of the ~0.8 s base loop, for ~2.0 s per full cycle).',
        command: '0x73 0x06 0x23 0x22 0x01 [checksum]',
        response: 'Echoed: one byte, the value that the setter stored.',
        sampleData: 'Response payload: 0x01',
        notes: '⚖️ Value 1 → 1200 ticks ≈ 1.2 s extra cooldown (assuming 1 ms/tick, typical STM32 FreeRTOS config).<br><br>' +
               '<strong>Clamping / ranges:</strong> setter accepts 0..2 only; values ≥3 silently rejected.<br><br>' +
               '<strong>Persistence:</strong> EEPROM 0x37B + mirror 0x375.<br><br>' +
               '<strong>Side effect:</strong> same byte also indexes sub_8005458 debounce timeouts (path not fully traced).<br><br>' +
               '<strong>To read current value:</strong> cmd 0x03 response byte 0x5F.'
    },
    ctpoll2: {
        title: '📊 Set CT Timing Profile = 2 — slowest (~3.2 s/cycle)',
        description: 'Extra ~2.4 s cooldown after each successful CT meter read. Useful for reducing BLE/modem chatter when CT updates are not time-critical.',
        command: '0x73 0x06 0x23 0x22 0x02 [checksum]',
        response: 'Echoed: one byte, the value that the setter stored.',
        sampleData: 'Response payload: 0x02',
        notes: '🔋 Value 2 → 2400 ticks ≈ 2.4 s extra cooldown.<br><br>' +
               '<strong>Clamping / ranges:</strong> setter accepts 0..2 only; values ≥3 silently rejected.<br><br>' +
               '<strong>Persistence:</strong> EEPROM 0x37B + mirror 0x375.<br><br>' +
               '<strong>Side effect:</strong> same byte also indexes sub_8005458 debounce timeouts (path not fully traced) — at 2, those timeouts are the widest.<br><br>' +
               '<strong>To read current value:</strong> cmd 0x03 response byte 0x5F.'
    },
    apienable30000: {
        title: '🌐 Enable Local API Port 30000 (0x28)',
        description: 'Enable Local API on default port 30000',
        command: '0x73 0x08 0x23 0x28 0x01 0x30 0x75 [checksum]',
        response: '3 bytes: [enable_flag, port_low, port_high]',
        sampleData: '0x01 0x30 0x75 = Enabled on port 30000',
        notes: '🌐 Enables Local API with default port 30000 (0x7530). This is the documented default port for UDP JSON API access.'
    },
    apicustom: {
        title: '🌐 Enable Local API Custom Port (0x28)',
        description: 'Enable Local API with user-specified port number',
        command: '0x73 0x08 0x23 0x28 0x01 [port_low] [port_high] [checksum]',
        response: '3 bytes: [enable_flag, port_low, port_high]',
        sampleData: 'User prompted for port 1-65535, sent in little-endian format',
        notes: '⚙️ Prompts user for custom port number (recommended range 49152-65535). Enables API and sets port in single operation per firmware design.'
    },
    readconfig: {
        title: '📋 Read Configuration (0x10)',
        description: 'Read device configuration including server credentials and connection settings',
        command: '0x73 0x05 0x23 0x10 [checksum]',
        response: '~80 bytes: ID, XID, Server, Port, User, Password, Flag',
        sampleData: 'Configuration data with server credentials (password masked for security)',
        notes: '🔐 Returns complete device configuration including sensitive credential information. Password field is masked in display for security.'
    },
    writeconfig: {
        title: '💾 Write Configuration (0x80)',
        description: 'Write configuration data with server credentials using sub-command format',
        command: '0x73 [len] 0x23 0x80 0x0C [url]<.,.>[port]<.,.>[user]<.,.>[pass] [checksum]',
        response: 'Status byte: 0x00 = Success, other = Error code',
        sampleData: 'Sub-command 12 (0x0C) with delimiter format: server.com<.,.>8080<.,.>username<.,.>password',
        notes: '⚠️ DANGEROUS: Modifies server credentials! Uses sub-command 12 with "<.,.>" delimiter format. Incorrect settings may prevent remote monitoring.'
    }
};

function showCommandInfo(cmdKey) {
    const info = commandInfo[cmdKey];
    if (!info) return;
    
    const modal = document.getElementById('infoModal');
    const details = document.getElementById('commandDetails');
    
    details.innerHTML = `
        <h3>${info.title}</h3>
        <div class="detail-section">
            <strong>Description:</strong><br>
            ${info.description}
        </div>
        <div class="detail-section">
            <strong>Command Sent:</strong><br>
            <code>${info.command}</code>
        </div>
        <div class="detail-section">
            <strong>Response Format:</strong><br>
            ${info.response}
        </div>
        <div class="detail-section">
            <strong>Sample Data:</strong>
            <pre>${info.sampleData}</pre>
        </div>
        ${info.notes ? `
        <div class="detail-section">
            <strong>Notes:</strong><br>
            ${info.notes}
        </div>` : ''}
    `;
    
    modal.style.display = 'block';
}

function closeInfoModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const infoModal = document.getElementById('infoModal');
    if (event.target == infoModal) {
        infoModal.style.display = 'none';
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize disclaimer check and version info on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Log startup info with calculated version
    try {
        // Extract version from the HTML (same as displayed in UI)
        const versionElement = document.querySelector('span strong');
        if (versionElement && versionElement.textContent.startsWith('v')) {
            const version = versionElement.textContent.substring(1); // Remove 'v' prefix
            log(`🚀 Marstek Venus Monitor v${version} starting...`);
        } else {
            // Fallback to version.json
            const versionResponse = await fetch('version.json');
            if (versionResponse.ok) {
                const versionData = await versionResponse.json();
                log(`🚀 Marstek Venus Monitor v${versionData.version} starting...`);
            } else {
                log('🚀 Marstek Venus Monitor starting...');
            }
        }
    } catch (e) {
        log('🚀 Marstek Venus Monitor starting...');
    }

    checkDisclaimerAcceptance();
    displayVersionInfo();

    // Check browser compatibility
    if (!navigator.bluetooth) {
        log('❌ Web Bluetooth not supported');
        showError('Web Bluetooth not supported in this browser');
    }
    
    // Preload all essential command templates
    if (window.preloadAllTemplates) {
        try {
            await window.preloadAllTemplates();
        } catch (error) {
            console.error('Failed to preload templates:', error);
        }
    }
});

// ==========================================
// EXPORTED FUNCTIONS FOR BLE MODULE
// ==========================================

/**
 * Set OTA mode - disables/enables command buttons
 * @param {boolean} inOTA - True when OTA is active, false when complete
 */
function setOTAMode(inOTA) {
    const commandButtons = document.querySelectorAll('.command-btn:not(#connectBtn):not(#disconnectBtn)');
    const configButtons = document.querySelectorAll('.config-btn');
    
    commandButtons.forEach(btn => {
        btn.disabled = inOTA;
        if (inOTA) {
            btn.classList.add('ota-disabled');
            btn.title = 'Commands disabled during firmware update';
        } else {
            btn.classList.remove('ota-disabled');
            btn.title = '';
        }
    });
    
    configButtons.forEach(btn => {
        btn.disabled = inOTA;
        if (inOTA) {
            btn.classList.add('ota-disabled');
        } else {
            btn.classList.remove('ota-disabled');
        }
    });
    
    if (inOTA) {
        log('🔒 Commands disabled during OTA update');
    } else {
        log('🔓 Commands re-enabled');
    }
}

// Make these functions available globally for the BLE module
window.uiController = {
    log,
    showError,
    displayData,
    updateStatus,
    formatBytes,
    setOTAMode,
    formatHexDump,
    updateOTAProgress,
    clearAll,
    isConnected: () => isConnected,
    setDeviceType: (type) => { deviceType = type; },
    getDeviceType: () => deviceType
};