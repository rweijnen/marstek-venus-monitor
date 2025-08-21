# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static web application for monitoring Marstek Venus E batteries via Web Bluetooth. The entire application is contained in a single `index.html` file with embedded CSS and JavaScript - no build system or dependencies required.

## Development Commands

```bash
# Start local development server (choose one):
python -m http.server 8000
npx serve
php -S localhost:8000

# No build, lint, or test commands - this is a static HTML file
# Testing requires actual BLE hardware (Marstek Venus E battery or CT002 meter)
```

## High-Level Architecture

### Single-File Application Structure
The entire application is in `index.html` with three main sections:
1. **HTML Structure**: UI with connection controls, data display, and command interface
2. **CSS Styles**: Embedded styles with dark theme and responsive design
3. **JavaScript Logic**: BLE protocol implementation and data processing

### Core Components

**BLE Protocol Layer** (`index.html:~350-1500`)
- Custom binary protocol implementation for Marstek Venus E batteries
- Message construction with CRC16-MODBUS checksums
- Response parsing for battery telemetry data
- Command queue management with retry logic

**Data Processing** (`index.html:~1500-2000`)
- Real-time telemetry parsing (voltage, current, SOC, temperatures)
- Alarm status decoding from binary data
- Unit conversions and scaling calculations

**UI State Management** (`index.html:~2000-2500`)
- Connection state handling
- Real-time data updates to DOM
- Command history tracking
- Error handling and user feedback

### Protocol Implementation

The application communicates using a reverse-engineered BLE protocol:
- **Service UUID**: `0000FFE0-0000-1000-8000-00805F9B34FB`
- **Characteristic UUID**: `0000FFE1-0000-1000-8000-00805F9B34FB`
- **Message Format**: Binary with 0xA5A5 header, command bytes, CRC16 checksum, 0x5A5A footer
- **Response Parsing**: Fixed-structure binary responses with telemetry data

### Safety Considerations

When modifying BLE commands or protocol:
- Commands are categorized as READ-ONLY, CONFIGURATION, or DANGEROUS
- DANGEROUS commands can modify battery settings and should be thoroughly tested
- Always preserve existing safety warnings and disclaimers
- Test changes with non-critical hardware first

## Deployment

Automatic deployment to GitHub Pages via `.github/workflows/static.yml`:
- Triggers on push to main branch
- Deploys index.html to https://rweijnen.github.io/marstek-venus-monitor/

## Key Files

- `index.html`: Complete application (HTML, CSS, JavaScript)
- `README.md`: Extensive protocol documentation and reverse-engineering notes
- `.github/workflows/static.yml`: GitHub Pages deployment configuration

## Development Notes

- Web Bluetooth requires HTTPS or localhost for security
- Chrome/Edge recommended for best Web Bluetooth support
- Console logging provides detailed protocol debugging information
- Command responses use little-endian byte ordering for multi-byte values