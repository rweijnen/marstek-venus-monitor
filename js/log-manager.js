/**
 * Enhanced Logging System with Tabbed Interface
 * Provides clean activity logging with detailed protocol and error tabs
 */

let currentLogTab = 'activity';

// Log categories
const LogType = {
    ACTIVITY: 'activity',
    PROTOCOL: 'protocol', 
    ERROR: 'error'
};

/**
 * Switch between log tabs
 */
function switchLogTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the clicked button
    const activeButton = document.querySelector(`[onclick="switchLogTab('${tabName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.log-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${tabName}Log`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    currentLogTab = tabName;
}

// Make function globally available
window.switchLogTab = switchLogTab;

/**
 * Enhanced logging function that categorizes messages
 */
function logEnhanced(message, type = LogType.ACTIVITY, data = null) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const formattedMessage = `[${timestamp}] ${message}`;
    
    // Add to appropriate tab
    const logElement = document.getElementById(`${type}Log`);
    if (logElement) {
        // Add hex dump for protocol messages if data provided
        if (type === LogType.PROTOCOL && data) {
            const hexDump = formatHexDump(data);
            logElement.textContent += `${formattedMessage}\n${hexDump}\n\n`;
        } else {
            logElement.textContent += `${formattedMessage}\n`;
        }
        
        // Auto-scroll if user is at bottom
        if (logElement.scrollTop >= logElement.scrollHeight - logElement.clientHeight - 10) {
            logElement.scrollTop = logElement.scrollHeight;
        }
        
        // Limit log size (keep last 200 lines per tab)
        const lines = logElement.textContent.split('\n');
        if (lines.length > 200) {
            logElement.textContent = lines.slice(-200).join('\n');
        }
    }
    
    // Also add to legacy log for compatibility
    const legacyLog = document.getElementById('log');
    if (legacyLog) {
        legacyLog.textContent += `${formattedMessage}\n`;
        
        const lines = legacyLog.textContent.split('\n');
        if (lines.length > 500) {
            legacyLog.textContent = lines.slice(-500).join('\n');
        }
    }
}

/**
 * Format byte array as hex dump for protocol tab
 */
function formatHexDump(bytes) {
    if (!bytes || bytes.length === 0) return '';
    
    let result = '';
    for (let i = 0; i < bytes.length; i += 16) {
        // Address
        const address = i.toString(16).padStart(4, '0').toUpperCase();
        result += `${address}: `;
        
        // Hex bytes
        const slice = bytes.slice(i, i + 16);
        for (let j = 0; j < 16; j++) {
            if (j < slice.length) {
                result += slice[j].toString(16).padStart(2, '0').toUpperCase() + ' ';
            } else {
                result += '   ';
            }
            if (j === 7) result += ' '; // Extra space in middle
        }
        
        result += ' |';
        
        // ASCII representation
        for (let j = 0; j < slice.length; j++) {
            const byte = slice[j];
            result += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        }
        
        result += '|\n';
    }
    
    return result.trim();
}

/**
 * Clean activity logging functions
 */
window.logActivity = function(message) {
    logEnhanced(message, LogType.ACTIVITY);
};

window.logProtocol = function(message, data = null) {
    logEnhanced(message, LogType.PROTOCOL, data);
};

window.logError = function(message) {
    logEnhanced(message, LogType.ERROR);
    
    // Flash error tab if not currently active
    if (currentLogTab !== 'error') {
        const errorTab = document.querySelector(`[onclick="switchLogTab('error')"]`);
        if (errorTab) {
            errorTab.style.background = '#dc3545';
            setTimeout(() => {
                if (!errorTab.classList.contains('active')) {
                    errorTab.style.background = '#2a2a2a';
                }
            }, 2000);
        }
    }
};

/**
 * BLE Command logging helpers
 */
window.logCommand = function(commandName, success = true) {
    const icon = success ? '✅' : '❌';
    const action = success ? 'Read' : 'Failed to read';
    logActivity(`${icon} ${action} ${commandName}`);
};

window.logConnection = function(deviceName, connected = true) {
    const icon = connected ? '✅' : '❌';
    const action = connected ? 'Connected to' : 'Disconnected from';
    logActivity(`${icon} ${action} ${deviceName}`);
};

window.logOTA = function(message, progress = null) {
    let formattedMessage = `🔄 OTA: ${message}`;
    if (progress !== null) {
        formattedMessage += ` (${progress}%)`;
    }
    logActivity(formattedMessage);
};

/**
 * Load template content from file
 */
async function loadTemplate(templateName) {
    try {
        const response = await fetch(`templates/${templateName}-commands.html`);
        if (!response.ok) {
            throw new Error(`Failed to load template: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        return `<div class="section-caption">❌ Failed to load ${templateName} commands</div>`;
    }
}

/**
 * Switch between command tabs with dynamic loading
 */
async function switchCommandTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.command-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the clicked button
    const activeButton = document.querySelector(`[onclick="switchCommandTab('${tabName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.command-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
        
        // Load template content if tab is empty
        if (!activeTab.dataset.loaded) {
            activeTab.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';
            const templateContent = await loadTemplate(tabName);
            activeTab.innerHTML = templateContent;
            activeTab.dataset.loaded = 'true';
        }
        
        // Update button states for all buttons when switching tabs if connected
        if (window.uiController && window.uiController.isConnected()) {
            updateButtonStates(true);
        }
    }
}

/**
 * Preload all essential templates on page load
 */
async function preloadAllTemplates() {
    const templates = ['read', 'system', 'power'];
    const loadPromises = [];
    
    for (const templateName of templates) {
        const tab = document.getElementById(`${templateName}Tab`);
        if (tab && !tab.dataset.loaded) {
            const loadPromise = loadTemplate(templateName).then(templateContent => {
                tab.innerHTML = templateContent;
                tab.dataset.loaded = 'true';
                
                // If this is the default active tab (read), make sure it's visible
                if (templateName === 'read') {
                    tab.classList.add('active');
                }
            }).catch(error => {
                console.error(`Failed to preload ${templateName} template:`, error);
                tab.innerHTML = `<div class="section-caption">❌ Failed to load ${templateName} commands</div>`;
            });
            
            loadPromises.push(loadPromise);
        }
    }
    
    // Wait for all templates to load
    await Promise.all(loadPromises);
    
    console.log('✅ All essential templates preloaded');
}

// Make functions globally available
window.switchCommandTab = switchCommandTab;
window.preloadAllTemplates = preloadAllTemplates;

/**
 * Update connection status area with live connection messages
 */
window.updateConnectionStatus = function(message) {
    // Always add to Activity tab with timestamp
    const timestampedMessage = `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}`;
    if (typeof logActivity !== 'undefined') {
        logActivity(timestampedMessage);
    }
    
    const statusSpan = document.getElementById('status');
    
    // Handle connection success - set final status and stop further updates
    if (message.includes('Connected to')) {
        if (statusSpan) {
            // Keep the full "Connected to DeviceName" message
            statusSpan.textContent = message;
            statusSpan.className = 'connected';
        }
        // Hide the connection message area
        const statusArea = document.getElementById('connectionStatus');
        if (statusArea) {
            statusArea.style.display = 'none';
        }
        return; // Don't process any further connection messages
    }
    
    // Handle disconnection/cancellation
    if (message.includes('Disconnected') || message.includes('cancelled')) {
        if (statusSpan) {
            statusSpan.textContent = 'Disconnected';
            statusSpan.className = 'disconnected';
        }
        // Hide the connection message area
        const statusArea = document.getElementById('connectionStatus');
        if (statusArea) {
            statusArea.style.display = 'none';
        }
        return;
    }
    
    // Skip device detection messages from status line (but keep in Activity)
    if (message.includes('Detected:')) {
        return; // Don't update status line, just log to Activity
    }
    
    // Update main status line with current connection state (only for connection process)
    if (statusSpan && statusSpan.className !== 'connected') {
        // Extract clean message without timestamp for status line
        const cleanMessage = message.replace(/^\[[^\]]+\]\s*/, ''); // Remove timestamp
        statusSpan.textContent = cleanMessage;
        statusSpan.className = 'connecting'; // Add connecting class for styling
    }
};