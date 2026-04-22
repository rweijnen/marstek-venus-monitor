/**
 * Runtime Info Payload Parser (Command 0x03)
 *
 * Field offsets verified against firmware v155 (sub_8008C30 / sub_8013D28).
 * v156+ adds 2 bytes at offsets 0x6D and 0x6E (BLE Lock, Depth of Discharge)
 * — those labels are inherited from earlier code and are NOT firmware-verified
 * against a v156 image.
 */

import { BasePayload } from '../base/Payload.js';
import { IRuntimeInfo } from '../base/types.js';

export class RuntimeInfoPayload extends BasePayload {
    public parse(): IRuntimeInfo {
        if (this.payloadLength < 100) {
            throw new Error(`Runtime info payload too short: ${this.payloadLength} bytes, need at least 100`);
        }

        // Power readings (int16 LE, may be negative)
        const gridPower = this.readInt16LE(0x00);
        const batteryPower = this.readInt16LE(0x02);

        // Status / work-mode
        const workMode = this.readUint8(0x04);
        const statusB = this.readUint8(0x05);
        const statusC = this.readUint8(0x06);
        const statusD = this.readUint8(0x07);
        const userWorkMode = this.safeReadUint8(0x26);
        const autoWorkModeChange = this.safeReadUint8(0x27);

        // Identity
        const deviceFwVersion = this.readUint16LE(0x0C);
        const bmsVersion = this.safeReadUint16LE(0x4F);
        const firmwareBuild = this.parseFirmwareTimestamp(0x51);

        // Energy counters
        const dailyCharge = this.readUint32LE(0x0E) / 100;
        const monthlyCharge = this.readUint32LE(0x12) / 1000;
        const dailyDischarge = this.readUint32LE(0x16) / 100;
        const monthlyDischarge = this.readUint32LE(0x1A) / 100;
        const totalCharge = this.readUint32LE(0x29) / 100;
        const totalDischarge = this.readUint32LE(0x2D) / 100;

        // Power settings
        const powerRating = this.safeReadUint16LE(0x4A);
        const euPowerLimit = this.safeReadUint8(0x47);

        // CT meter / parallel
        const detectedCtType = this.safeReadUint8(0x4C);
        const batteryPhasePos = this.safeReadUint8(0x4D);
        const parallelMode = this.safeReadUint8(0x4E);
        const parallelMachineState = this.safeReadUint8(0x60);
        const ctTimingProfile = this.safeReadUint8(0x5F);
        const generatorEnabled = this.safeReadUint8(0x61);
        const ctShellyPort = this.safeReadUint16BE(0x62);

        // Network / API
        const wifiRssi = this.safeReadUint8(0x3D);
        const httpServerType = this.safeReadUint8(0x3E);
        const localApiEnabled = this.safeReadUint8(0x65);
        const apiPort = this.safeReadUint16LE(0x66);

        // v156+ optional fields (existing labels, not firmware-verified)
        let bleLock: number | undefined;
        let depthOfDischarge: number | undefined;
        if (this.payloadLength >= 111) {
            bleLock = this.safeReadUint8(0x6D);
            depthOfDischarge = this.safeReadUint8(0x6E);
        }

        // Derived status flags
        const epsEnabled = this.parseEPSStatus(statusB, statusC, statusD);
        const statusFlags = this.parseStatusFlags(statusB, statusC, statusD);

        // Unknown bytes (value known, semantic unknown)
        const unknowns = {
            u1_0x08: this.safeReadUint8(0x08),
            u2_0x09: this.safeReadUint16LE(0x09),
            u3_0x0B: this.safeReadUint8(0x0B),
            u4_0x1E: this.readUint32LE(0x1E),
            u5_0x31: this.safeReadUint16LE(0x31),
            u6_0x33: this.safeReadUint16LE(0x33),
            u7_0x35: this.readUint32LE(0x35),
            u8_0x39: this.readUint32LE(0x39),
            u9_0x3F: this.readUint32LE(0x3F),
            u10_0x43: this.readUint32LE(0x43),
            u11_0x48: this.safeReadUint16LE(0x48),
            u12_0x64: this.safeReadUint8(0x64),
            u13_0x68: this.safeReadUint8(0x68),
            u14_0x69: this.safeReadUint8(0x69),
            u15_0x6A: this.safeReadUint8(0x6A),
            u16_0x6B: this.safeReadUint8(0x6B),
            u17_0x6C: this.safeReadUint8(0x6C),
        };

        return {
            gridPower,
            batteryPower,
            workMode,
            statusB,
            statusC,
            statusD,
            userWorkMode,
            autoWorkModeChange,
            deviceFwVersion,
            bmsVersion,
            firmwareBuild,
            dailyCharge,
            monthlyCharge,
            dailyDischarge,
            monthlyDischarge,
            totalCharge,
            totalDischarge,
            powerRating,
            euPowerLimit,
            detectedCtType,
            batteryPhasePos,
            parallelMode,
            parallelMachineState,
            ctTimingProfile,
            generatorEnabled,
            ctShellyPort,
            wifiRssi,
            httpServerType,
            localApiEnabled,
            apiPort,
            bleLock,
            depthOfDischarge,
            epsEnabled,
            statusFlags,
            unknowns,
        };
    }

    private parseEPSStatus(_statusB: number, _statusC: number, _statusD: number): boolean | undefined {
        // EPS status is not reliably encoded in the status flag bytes.
        // Users should rely on cmd 0x0F responses for accurate EPS state.
        return undefined;
    }

    private parseStatusFlags(statusB: number, statusC: number, statusD: number) {
        // Bit interpretations are not firmware-verified — inherited from earlier code.
        return {
            epsEnabled: undefined,
            p1MeterConnected: (statusB & 0x02) !== 0,
            ecoTrackerConnected: (statusB & 0x04) !== 0,
            networkActive: (statusB & 0x08) !== 0,
            workModeState: statusC & 0x0F,
            dataQualityOk: (statusC & 0x10) !== 0,
            errorState: statusD & 0x07,
            serverConnected: (statusD & 0x08) !== 0,
            httpActive: (statusD & 0x10) !== 0,
            raw: { statusB, statusC, statusD }
        };
    }

    private getWorkModeString(mode: number): string {
        const modes: { [key: number]: string } = {
            0x00: 'Auto',
            0x01: 'Standby',
            0x02: 'Charging',
            0x03: 'Sell Electricity',
            0x04: 'UPS/EPS',
            0x05: 'Force Charge',
            0x06: 'Grid Export',
            0x07: 'Schedule/TOU'
        };
        const modeText = modes[mode] || `Unknown (0x${mode.toString(16).padStart(2, '0')})`;
        return `${mode} (${modeText})`;
    }

    private getDetectedCtTypeString(t: number): string {
        const types: { [key: number]: string } = {
            0: 'None / not detected',
            3: 'HME-4 (CT002)',
            4: 'Shelly Pro EM',
            6: 'HME-3 (CT003)',
            7: 'Shelly EM Gen3',
            8: 'Shelly Pro EM 50'
        };
        const name = types[t] || `Unknown (${t})`;
        return `${t} — ${name}`;
    }

    private getPhasePosString(p: number): string {
        const phases: { [key: number]: string } = {
            0: 'Unassigned',
            1: 'Phase A',
            2: 'Phase B',
            3: 'Phase C'
        };
        return `${p} — ${phases[p] || 'Unknown'}`;
    }

    private getParallelStateString(s: number): string {
        const states = ['OFF', 'READY', 'ON'];
        return `${s} — ${states[s] || 'Unknown'}`;
    }

    private getCtTimingProfileString(v: number): string {
        // Each unit of the multiplier adds 1200 ticks ≈ 1.2 s of extra cooldown
        // after each successful CT read, on top of the fixed ~0.8 s base loop.
        const extraMs = v * 1200;
        const totalMs = 800 + extraMs;
        const labels = ['fastest (no extra delay)', 'default', 'slowest'];
        const label = labels[v] || 'unknown';
        return `${v} — ${label} (~${(totalMs / 1000).toFixed(1)} s per CT cycle; +${(extraMs / 1000).toFixed(1)} s extra)`;
    }

    private parseFirmwareTimestamp(offset: number): string {
        try {
            const timestampStr = this.readString(offset, 12);
            if (timestampStr.length >= 10 && /^\d+/.test(timestampStr)) {
                const cleaned = timestampStr.padEnd(12, '0').slice(0, 12);
                return `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)} ${cleaned.slice(8,10)}:${cleaned.slice(10,12)}`;
            }
        } catch (e) {
            console.warn(`Failed to parse firmware timestamp at offset ${offset}:`, e);
        }
        return 'Unknown';
    }

    public toHTML(): string {
        try {
            const data = this.parse();
            let html = '<h3>⚡ Runtime Information</h3><div class="data-grid">';

            // Power
            html += `<div><strong>Backup Power (0x00):</strong> ${data.gridPower} W</div>`;
            html += `<div><strong>Battery Power (0x02):</strong> ${data.batteryPower} W</div>`;
            html += `<div><strong>Power Rating (0x4A):</strong> ${data.powerRating} W</div>`;
            html += `<div><strong>EU 800 W Power Limit (0x47):</strong> ${data.euPowerLimit === 1 ? 'Active (limited to 800 W)' : data.euPowerLimit === 0 ? 'Off (full 2500 W)' : `Raw ${data.euPowerLimit}`}</div>`;

            // Work mode
            html += `<div><strong>Work Mode (0x04):</strong> ${this.getWorkModeString(data.workMode)}</div>`;
            html += `<div><strong>User Work Mode (0x26):</strong> ${data.userWorkMode}</div>`;
            html += `<div><strong>Auto Work-Mode Change (0x27):</strong> ${data.autoWorkModeChange === 1 ? 'On' : data.autoWorkModeChange === 0 ? 'Off' : `Raw ${data.autoWorkModeChange}`}</div>`;
            html += `<div><strong>Status Flags B/C/D:</strong> ${data.statusB}/${data.statusC}/${data.statusD} (0x${data.statusB.toString(16).padStart(2,'0')}/0x${data.statusC.toString(16).padStart(2,'0')}/0x${data.statusD.toString(16).padStart(2,'0')})</div>`;

            // Derived status (unverified interpretations — rendered small)
            if (data.statusFlags) {
                const sf = data.statusFlags;
                html += `<div class="status-details" style="margin-left: 10px; font-size: 0.9em; color: #666;">`;
                html += `<div>📡 <strong>Connections:</strong> `;
                const connections = [];
                if (sf.p1MeterConnected) connections.push('P1 Meter');
                if (sf.ecoTrackerConnected) connections.push('Eco-Tracker');
                if (sf.serverConnected) connections.push('Server');
                html += connections.length > 0 ? connections.join(', ') : 'None';
                html += `</div>`;
                html += `<div>🔧 <strong>System:</strong> `;
                const systemStatus = [];
                if (sf.networkActive) systemStatus.push('Network Active');
                if (sf.httpActive) systemStatus.push('HTTP Active');
                if (sf.dataQualityOk) systemStatus.push('Data Quality OK');
                html += systemStatus.length > 0 ? systemStatus.join(', ') : 'Idle';
                html += `</div>`;
                if (sf.errorState > 0) {
                    const errorTypes = ['None', 'Meter Disconnect', 'Connection Error', 'HTTP Error', 'Timeout', 'Data Error', 'P1 Warning', 'Eco-Tracker Warning'];
                    html += `<div>⚠️ <strong>Error State:</strong> ${errorTypes[sf.errorState] || `Error ${sf.errorState}`}</div>`;
                }
                if (sf.workModeState !== data.workMode) {
                    html += `<div>⚙️ <strong>Work Mode State:</strong> ${sf.workModeState}</div>`;
                }
                html += `<div style="font-style:italic; font-size:0.85em;">(bit-field interpretation not firmware-verified)</div>`;
                html += `</div>`;
            }

            // CT meter / parallel
            html += `<div><strong>Detected CT Type (0x4C):</strong> ${this.getDetectedCtTypeString(data.detectedCtType)}</div>`;
            html += `<div><strong>Battery Phase Position (0x4D):</strong> ${this.getPhasePosString(data.batteryPhasePos)}</div>`;
            html += `<div><strong>Parallel Mode flag (0x4E):</strong> ${data.parallelMode === 1 ? 'Enabled' : data.parallelMode === 0 ? 'Disabled' : `Raw ${data.parallelMode}`}</div>`;
            html += `<div><strong>Parallel Machine State (0x60):</strong> ${this.getParallelStateString(data.parallelMachineState)}</div>`;
            html += `<div><strong>CT Timing Profile (0x5F):</strong> ${this.getCtTimingProfileString(data.ctTimingProfile)}</div>`;
            html += `<div><strong>Generator (0x61):</strong> ${data.generatorEnabled === 1 ? 'On' : data.generatorEnabled === 0 ? 'Off' : `Raw 0x${data.generatorEnabled.toString(16).padStart(2,'0')}`}</div>`;
            html += `<div><strong>Shelly CT Meter Port (0x62 BE):</strong> ${data.ctShellyPort} (default 1010 for CT002/CT003/Shelly EM Gen2)</div>`;

            // Network / API
            html += `<div><strong>WiFi RSSI (0x3D):</strong> ${data.wifiRssi}</div>`;
            html += `<div><strong>HTTP Server Type (0x3E):</strong> ${data.httpServerType} (subdomain selector for hamedata.com, set by cmd 0x02)</div>`;
            html += `<div><strong>Local API (0x65/0x66):</strong> ${data.localApiEnabled === 1 ? `<span style="color: #28a745;">Enabled</span>` : `<span style="color: #dc3545;">Disabled</span>`} — port ${data.apiPort}</div>`;

            // Energy
            html += `<div><strong>Daily Charge:</strong> ${data.dailyCharge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Daily Discharge:</strong> ${data.dailyDischarge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Monthly Charge:</strong> ${data.monthlyCharge.toFixed(3)} kWh</div>`;
            html += `<div><strong>Monthly Discharge:</strong> ${data.monthlyDischarge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Total Charge:</strong> ${data.totalCharge.toFixed(2)} kWh</div>`;
            html += `<div><strong>Total Discharge:</strong> ${data.totalDischarge.toFixed(2)} kWh</div>`;

            // Firmware / identity
            html += `<div><strong>Device FW Version (0x0C):</strong> ${data.deviceFwVersion}</div>`;
            html += `<div><strong>BMS Version (0x4F):</strong> ${data.bmsVersion}</div>`;
            html += `<div><strong>Firmware Build (0x51):</strong> ${data.firmwareBuild}</div>`;

            // v156+ (unverified)
            if (data.bleLock !== undefined) {
                html += `<div><strong>BLE byte (0x6D):</strong> ${data.bleLock} <span style="font-style:italic; color:#a00; font-size:0.9em;">(existing "BLE Lock" label unverified — real-world data contradicts; send cmd 0x53 [0x0B] to compare)</span></div>`;
            }
            if (data.depthOfDischarge !== undefined) {
                html += `<div><strong>Depth of Discharge (0x6E):</strong> ${data.depthOfDischarge}% <span style="font-style:italic; color:#888; font-size:0.9em;">(plausible, unverified)</span></div>`;
            }

            // Unknown bytes — raw values known, semantic not
            html += `<details style="margin-top: 10px;"><summary style="cursor: pointer; font-weight: bold;">Unknown fields (value known, semantic unknown)</summary><div style="margin-left: 10px; font-size: 0.9em;">`;
            const u = data.unknowns;
            html += `<div>Unknown1 (0x08, u8): ${u.u1_0x08}</div>`;
            html += `<div>Unknown2 (0x09, u16 LE): ${u.u2_0x09}</div>`;
            html += `<div>Unknown3 (0x0B, u8): ${u.u3_0x0B}</div>`;
            html += `<div>Unknown4 (0x1E, u32 LE): ${u.u4_0x1E}</div>`;
            html += `<div>Unknown5 (0x31, u16 LE): ${u.u5_0x31}</div>`;
            html += `<div>Unknown6 (0x33, u16 LE): ${u.u6_0x33}</div>`;
            html += `<div>Unknown7 (0x35, u32 LE): ${u.u7_0x35}</div>`;
            html += `<div>Unknown8 (0x39, u32 LE): ${u.u8_0x39}</div>`;
            html += `<div>Unknown9 (0x3F, u32 LE): ${u.u9_0x3F}</div>`;
            html += `<div>Unknown10 (0x43, u32 LE): ${u.u10_0x43}</div>`;
            html += `<div>Unknown11 (0x48, u16 LE): ${u.u11_0x48}</div>`;
            html += `<div>Unknown12 (0x64, u8): ${u.u12_0x64} <em>(set by BLE cmd 0x26, clamped 30..119, default 100)</em></div>`;
            html += `<div>Unknown13 (0x68, u8): ${u.u13_0x68}</div>`;
            html += `<div>Unknown14 (0x69, u8): ${u.u14_0x69}</div>`;
            html += `<div>Unknown15 (0x6A, u8): ${u.u15_0x6A}</div>`;
            html += `<div>Unknown16 (0x6B, u8): ${u.u16_0x6B}</div>`;
            html += `<div>Unknown17 (0x6C, u8): ${u.u17_0x6C}</div>`;
            html += `</div></details>`;

            html += '</div>';
            return html;
        } catch (error) {
            return `<h3>⚡ Runtime Information</h3><div class="error">Failed to parse runtime data: ${(error as Error).message}</div>`;
        }
    }
}
