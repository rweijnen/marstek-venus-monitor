# Marstek Venus E Battery Monitor

🔋 **Web-based monitoring tool for Marstek Venus E batteries via Bluetooth Low Energy**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue)](https://yourusername.github.io/marstek-venus-monitor/)
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

1. **Open in Browser:** [https://yourusername.github.io/marstek-venus-monitor/](https://yourusername.github.io/marstek-venus-monitor/)
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

- **Issues:** [GitHub Issues](https://github.com/yourusername/marstek-venus-monitor/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/marstek-venus-monitor/discussions)
- **Safety Concerns:** Please report immediately

---

**⚠️ Remember: This is experimental software. Always prioritize safety when working with battery systems.**