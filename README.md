# Marstek Venus E Battery Monitor

🔋 **Web-based monitoring tool for Marstek Venus E batteries via Bluetooth Low Energy**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue)](https://rweijnen.github.io/marstek-venus-monitor/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Experimental](https://img.shields.io/badge/Status-Experimental-orange.svg)](#warning)

## ⚠️ **EXPERIMENTAL SOFTWARE WARNING**

**This is highly experimental testing software. Use at your own risk.**

- This software can send commands to your battery system
- Some commands may modify battery settings or behavior  
- Improper use could potentially damage your equipment
- For advanced users and developers only
- Use in controlled environments with proper safety precautions

## 🚀 **Quick Start**

1. **Open in Browser:** [https://rweijnen.github.io/marstek-venus-monitor/](https://rweijnen.github.io/marstek-venus-monitor/)
2. **Browser Requirements:** Chrome, Edge, or Opera with Web Bluetooth support
3. **Hardware:** Marstek Venus E battery with "MST_ACCP" or "MST-TPM" Bluetooth name
4. **Accept Disclaimer** and connect to your device

## 📱 **Supported Devices**

- **Marstek Venus E Batteries** (MST_ACCP_XXXX)
- **Marstek CT002 Meters** (MST-TPM_XXXX)
- Any Marstek device using HM-compatible BLE protocol

## 🔧 **Features**

### **Real-time Monitoring:**
- ⚡ Battery runtime information (power, SOC, temperatures)
- 📱 Device information (model, MAC, firmware versions)
- 🔋 BMS data (cell voltages, current, capacity, cycle count)
- 📶 WiFi connection status
- 🌐 Network configuration

### **Advanced Diagnostics:**
- 🚨 Error code history with timestamps
- 📝 System event logs
- ⚙️ Configuration data
- 🔧 System parameters
- 🔗 Network settings

### **Safety Features:**
- 🛡️ Comprehensive disclaimer and risk warning
- 📖 Read-only commands prioritized
- 🔒 No destructive operations by default
- ⚠️ Clear experimental status indicators

## 🛠️ **Technical Details**

### **Protocol:**
- **BLE Service:** `0000ff00-0000-1000-8000-00805f9b34fb`
- **Command Format:** `[0x73][Length][0x23][Command][Payload...][Checksum]`
- **Checksum:** XOR of all bytes except checksum
- **Compatible with HM battery protocol**

### **Supported Commands:**
| Command | Description | Type |
|---------|-------------|------|
| `0x03` | Runtime Info | Safe |
| `0x04` | Device Info | Safe |
| `0x08` | WiFi Info | Safe |
| `0x0D` | System Data | Safe |
| `0x13` | Error Codes | Safe |
| `0x14` | BMS Data | Safe |
| `0x1A` | Config Data | Safe |
| `0x1C` | Event Log | Safe |
| `0x21` | Meter IP | Safe |
| `0x24` | Network Info | Safe |

### **Protocol Analysis (from hex dumps):**

#### **Runtime Info (0x03) - 101 bytes response**
```
Payload Offset | Bytes | Description | Scaling | Example
---------------|-------|-------------|---------|--------
[2-3]          | 2     | In1 Power   | None    | 78W
[4-5]          | 2     | In2 Power   | ÷100    | 259 → 2.59W
[6-7]          | 2     | Unknown 1   | ?       | 
[8-9]          | 2     | Unknown 2   | ?       |
[10]           | 1     | Dev Version | None    | 151
[15]           | 1     | Status Flags| Bitmap  | Bit0=WiFi, Bit1=MQTT
[20-21]        | 2     | Out1 Power  | None    | 2W
[24-25]        | 2     | Out2 Power  | ÷10     | 3913 → 391.3W
[33-34]        | 2     | Temp Low    | ÷10     | °C
[35-36]        | 2     | Temp High   | ÷10     | °C
```

#### **BMS Data (0x14) - 80 bytes response**
```
Payload Offset | Bytes | Description | Scaling | Example
---------------|-------|-------------|---------|--------
[0-1]          | 2     | Unknown     | ?       | 212
[2-3]          | 2     | Battery Voltage | ÷10 | 571 → 57.1V
[4-5]          | 2     | Battery Current | ÷10 | 1000 → 100.0A
[6-7]          | 2     | Unknown     | ?       |
[8-9]          | 2     | SOC (%)     | None    | 62%
[10-11]        | 2     | Total Capacity | None | 99%
[12-13]        | 2     | Cycle Count | None    | 5120 cycles
[38]           | 1     | Temperature 1 | None  | 32°C
[39]           | 1     | Temperature 2 | None  | 0°C
[46-77]        | 32    | Cell Voltages | ÷1000 | 16 cells × 2 bytes
```

#### **Device Info (0x04) - Variable length text response**
Returns comma-separated key=value pairs:
- `type`: Device model (e.g., HMG-50)
- `id`: Device serial number
- `mac`: Bluetooth MAC address
- `dev_ver`: Device firmware version
- `bms_ver`: BMS firmware version
- `fc_ver`: FC firmware version/date

#### **Network Info (0x24) - Variable length text response**
Returns comma-separated network configuration:
- `ip`: Device IP address
- `gate`: Gateway IP
- `mask`: Subnet mask
- `dns`: DNS server

#### **WiFi Info (0x08) - Variable length text response**
Returns the connected WiFi network name (SSID)

#### **System Data (0x0D) - 19 bytes response**
```
Payload Offset | Bytes | Description | Notes
---------------|-------|-------------|-------
[0]            | 1     | System Status | 1 = Normal
[1-2]          | 2     | Value 1     | Unknown
[3-4]          | 2     | Value 2     | Unknown
[5-6]          | 2     | Value 3     | Unknown
[7-8]          | 2     | Value 4     | Unknown
[9-10]         | 2     | Value 5     | Unknown
```

#### **Event Log (0x1C) - 180 bytes response**
8-byte records with timestamp and event codes:
```
Offset | Bytes | Description
-------|-------|------------
[0-1]  | 2     | Year (little-endian)
[2]    | 1     | Month
[3]    | 1     | Day
[4]    | 1     | Hour
[5]    | 1     | Minute
[6]    | 1     | Event Type
[7]    | 1     | Event Code
```
Common event codes: 0x94, 0x95, 0x99, 0x9a

#### **Error Codes (0x13) - 280 bytes response**
14-byte records with timestamp and error information:
```
Offset | Bytes | Description
-------|-------|------------
[0-1]  | 2     | Year (little-endian)
[2]    | 1     | Month
[3]    | 1     | Day
[4]    | 1     | Hour
[5]    | 1     | Minute
[6]    | 1     | Error Code (0x80 common)
[7-13] | 7     | Additional error data
```

#### **Meter IP (0x21) - 16 bytes response**
- All 0xFF = No meter configured
- Otherwise returns IP address string

#### **Config Data (0x1A) - 18 bytes response**
```
Payload Offset | Bytes | Description | Example Value
---------------|-------|-------------|---------------
[0]            | 1     | Config Mode | 0x61 (97)
[1]            | 1     | Config Flags| 0x00
[2-3]          | 2     | Reserved    | 0x0000
[4]            | 1     | Config Status | 0x9F (-97 signed)
[5-7]          | 3     | Status Bytes | 0xFF FF FF
[8]            | 1     | Enable Flag 1 | 0x01 (enabled)
[9-11]         | 3     | Reserved    | 0x00 00 00
[12]           | 1     | Enable Flag 2 | 0x01 (enabled)
[13-15]        | 3     | Reserved    | 0x00 00 00
[16]           | 1     | Config Value | 0x51 (81)
[17]           | 1     | Reserved    | 0x00
```
Note: The 0xFF FF FF pattern and signed -97 status suggest error state or unconfigured parameters

### **Data Parsing:**
- **Power Values:** Scaled appropriately (some ÷10 for decimals)
- **SOC:** Percentage (÷100)
- **Voltages:** Cell voltages in volts (÷1000)
- **Temperatures:** Celsius (some ÷10 for decimals)
- **Timestamps:** Parsed from binary to readable format

## 🌐 **Browser Compatibility**

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended |
| Edge | ✅ Full | Recommended |
| Opera | ✅ Full | Good |
| Firefox | ❌ No | No Web Bluetooth |
| Safari | ❌ No | No Web Bluetooth |

## 📋 **Usage Instructions**

1. **Power on** your Marstek battery device
2. **Open** the web app in a supported browser
3. **Accept** the disclaimer and risk warning
4. **Click "Connect"** and select your MST device
5. **Use command buttons** to read battery data
6. **Monitor** real-time information and logs

## 🔬 **Development**

This project is based on reverse engineering the Marstek BLE protocol through firmware analysis. The protocol is compatible with the HM battery series.

### **Related Projects:**
- [HMJS](https://github.com/tomquist/hmjs) - Original HM battery protocol library
- [Marstek Venus E Firmware Notes](https://github.com/rweijnen/marstek-venus-e-firmware-notes) - Protocol research

### **Contributing:**
- Report issues and compatibility findings
- Share protocol discoveries
- Improve safety and error handling
- Add support for more device types

## ⚖️ **Legal**

### **Disclaimer:**
- This software is provided "as is" without warranties
- Users assume full responsibility for any consequences
- Not affiliated with Marstek or battery manufacturers
- For educational and research purposes

### **License:**
MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- **Issues:** [GitHub Issues](https://github.com/rweijnen/marstek-venus-monitor/issues)
- **Discussions:** [GitHub Discussions](https://github.com/rweijnen/marstek-venus-monitor/discussions)
- **Safety Concerns:** Please report immediately

---

**⚠️ Remember: This is experimental software. Always prioritize safety when working with battery systems.**