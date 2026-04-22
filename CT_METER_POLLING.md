# Battery → CT Meter Polling

How the Marstek Venus E battery (firmware v155, `202509161548003ff722863.bin`) discovers and polls a Marstek CT meter over the LAN. Focus: **CT002** and **CT003** (user-confirmed: `HME-3` is CT003; `HME-4` is CT002).

> **Source references.** All function/global addresses are for firmware **v155** (`202509161548003ff722863.bin`) loaded at base `0x08000000`. A separate IDA database of the **CT002 meter firmware** (`202507021110400569f6547.bin`) was cross-checked for the model identifier.

## TL;DR

- The battery MCU does **not** run an IP stack. UDP is sent over UART to a Quectel WiFi/cellular module using `AT+QIOPEN` / `AT+QISEND` / `AT+QIRD`.
- The CT meter listens on **UDP port 12345**. The destination IP is **not** set over BLE — it is discovered via a `"hame"` 4-byte UDP probe on port 12345 (`ct_meter_discovery_state_machine`).
- BLE cmd `0x21` is a separate feature — it sets the **HomeWizard P1 meter** IP (HTTP `/api/v1/data`), not the CT meter. Both meter types can be configured but only one is in active use at a time, and the P1 path is understood to be single-battery (not multi-battery / parallel-capable).
- Two polling variants share the same state machine: a **binary CT002/CT003 frame** (SOH/STX/len/`|`-fields/ETX/checksum) or a **JSON-RPC** body for Shelly EM / EM Gen3 / Pro EM 50.
- The base period is **hard-coded in the firmware** (≈ 300 ticks between dispatcher iterations). No command exposes this loop period. However, the **extra post-parse cooldown** (0 / ~1.2s / ~2.4s after each successful read) is tied to `g_timing_profile_idx` (`byte_2000302E`, 0..2), writable by BLE cmd `0x22` — see "Can the interval be changed?".
- The parsed response has 28 fields. The control loop consumes: total + A/B/C phase power (all paths), and — when at least one charge/discharge-power field is non-zero — a per-phase slice of charge/discharge-power fields picked via `ct_select_phase_power`.

## Model ↔ type-string mapping

| Marstek model | Type string on wire | `g_ct_meter_type` | Source |
|---|---|---|---|
| CT002 | `HME-4` | `3` | String present in CT002 firmware at file offset `0x106c0` (`\| H M E - 4`); battery firmware hard-codes `"HME-4"` (`ct002_build_query` at `0x801FFCA`). |
| CT003 | `HME-3` | `4` | User-confirmed. Battery firmware sends `"HME-3"` at `0x801FFD6`; response-sniffer recognises `HME-3` at `0x8025AA8`. |
| Shelly EM (Gen2) | JSON `EM.GetStatus` | `1` | |
| Shelly EM Gen3 / Pro EM 50 | JSON `EM1.GetStatus` | `5` or `6` | |

`g_ct_meter_type` (= `byte_20003025`) is set by **BLE command `0x18`** (dispatcher case 24 at `0x8006A80`). The accompanying 12-byte ASCII meter MAC goes into `g_ct_meter_mac_ascii` (= `dword_20004127`).

Reverse-direction mapping — after a response is parsed, `byte_20001614` holds the *detected* type:

| Response contained | `byte_20001614` | Set at |
|---|---|---|
| `"HME-4"` | 3 | `ct002_parse_response` `0x8025A32` |
| `"HME-3"` | 6 | `ct002_parse_response` `0x8025A38` |
| `"a_act_power"` (Shelly Pro EM) | 4 | `ct_meter_poll_state_machine` `0x8022DAC` |
| `"shellyemg3"` | 7 | `0x8022DF8` |
| `"shellyproem50"` | 8 | `0x8022DF8` |

## Transport — `AT+QIOPEN` / `AT+QISEND`

Three AT commands are used by the poll state machine:

```
AT+QIOPEN=<connid>,"UDP SERVICE","<host>",<remote_port>,<local_port>,<mode>
AT+QISEND=<connid>,<len>,"<payload>","<host>",<remote_port>
AT+QIRD=<connid>[,<len>]
```

- `<connid>` = `g_ct_qiopen_connid` (`byte_2000161A`), typically `0` or `1`.
- `<host>` = `g_szMonitorIP` (`qword_2000F178` — actually the full IP string buffer, not a 64-bit value despite the name).
- `<remote_port>` in the poll path = **`12345`** (literal `MOVW R7,#0x3039` at `0x8022CB2` and `MOVW R0,#0x3039` at `0x80250DA`).
- `<mode>` = `1` in the main poll path (transparent) and `0` in the discovery path.

Two parallel state machines exist:

- **`ct_meter_discovery_state_machine`** (`sub_8025028`) — announces presence with the literal ASCII probe `"hame"` (4 bytes) on UDP `<ip>:12345`. This probe is also sent from the user's `C:/Work/MT/firmware/CT002/send-hame.ps1`, confirming the meter listens for it.
- **`ct_meter_poll_state_machine`** (`sub_8022B6C`) — the periodic data poll. Covered below.

## Polling cadence

Driven from FreeRTOS task via **`sub_80055BC`** (`0xD6` bytes). Each invocation:

1. Checks connectivity flag `byte_2000095E`. If unconnected, resets state and sleeps 300 ticks.
2. Checks configured meter type `g_ct_meter_type`. If `0`/`2`/`7`, calls `ct_alt_handler` (formerly `sub_80049DC`) and sleeps 300 ticks.
3. Otherwise calls `ct_meter_poll_state_machine` (one state transition per call).
4. Picks the next sleep based on the new state:
   - `g_ct_state == 3` (waiting for response parse) → **5 ticks**
   - `byte_20001613 != 0` (response just parsed) → **500 ticks**
   - default → **300 ticks**

All delays go through `sub_802DECC`, which is **FreeRTOS `vTaskDelay`** (verified by the `..\..\SDK\FreeRTOS\tasks.c` reference at line 1308 inside the function — this is the well-known line number of the `configASSERT` that `vTaskDelay` calls when preemption is disabled).

> **Tick-to-ms assumption.** `configTICK_RATE_HZ` could not be extracted from the binary directly. Assuming the STM32 firmware default of 1000 Hz (1 ms/tick), the values above are **≈ 300 ms / 5 ms / 500 ms**. A round-trip poll (send → recv → parse) therefore takes roughly 300 ms + 5 ms + 500 ms ≈ **~800 ms** per cycle under normal conditions. A tick rate of 100 Hz would make all of these 10× larger; the values are consistent with typical HAL-timer configurations so 1 kHz is most likely.

After a successful CT parse, the handler additionally calls `vTaskDelay(1200 * ct_post_parse_delay_multiplier())` at `0x8022E58`. The multiplier function (formerly `sub_80142B0`) returns `g_timing_profile_idx` clamped to 0..2 — see the adjustable-interval section below.

### `ct_alt_handler` (step 2 above)

For meter types `0` / `2` / `7` the main state machine is bypassed and this handler runs instead:

```c
if (byte_2000095E) {                   // connected
    sub_80049C8();                     // purpose not traced
    sub_80049B4(...);                  // purpose not traced
} else {                               // not connected
    byte_2000161B       = 1;
    g_ct_qiopen_connid  = 0;
    sub_8004BA0();                     // purpose not traced
}
```

What types `0` / `2` / `7` correspond to isn't explicitly labelled, but by elimination against the types we do know (`1`=Shelly EM Gen2, `3`=HME-4/CT002, `4`=HME-3/CT003, `5`/`6`=Shelly Gen3/Pro EM 50): `0` is probably "no CT / disabled", `2` and `7` are other meter paths (P1 is a plausible match for one of them given the user's P1 note, but this is not confirmed from the code here).

### Can the interval be changed?

**Base loop (300/5/500 ticks): no — hard-coded.**
- Every numeric delay in `sub_80055BC` (`0x12C=300`, `5`, `0x1F4=500`) is an immediate literal.
- No BLE/MQTT handler writes the CT state bytes (`byte_2000160E/F`, `byte_20001613/4/6/7/8/9/A`) with anything other than `0`, `1`, or the meter-type byte.
- Searching all MQTT strings for `poll|interval|period|rate|refresh|ct_poll` returned zero matches.

**Post-parse cooldown: yes, via BLE cmd `0x22` which writes `g_timing_profile_idx` (`byte_2000302E`, EEPROM `0x37B`).**

> **Naming caveat.** I initially labelled this byte "HTTP server type" by analogy to the nearby server-type setters. **That was wrong.** The real "HTTP server type" (selects `%s.hamedata.com` subdomain) is `byte_20003092` at EEPROM `0x441`, set by BLE cmd `0x02` and MQTT `Set http server type` (log at `0x800E4A4` reads `byte_20003092`; `[HTTP] URL server type: %d` at `0x800B6A0` also logs `byte_20003092`). `byte_2000302E` has **no log string** naming it — only its *effects* are visible. `g_timing_profile_idx` is my own neutral placeholder.

The extra delay inserted after each successful CT parse is `vTaskDelay(1200 * ct_post_parse_delay_multiplier())` at `0x8022E58`. The multiplier function (at `0x80142B0`) is:

```c
uint8_t ct_post_parse_delay_multiplier(void) {
    if (g_timing_profile_idx >= 3) {
        return (g_ct_meter_type == 4 /* HME-3 / CT003 */) ? 2 : 1;
    }
    return g_timing_profile_idx;   // 0, 1, or 2
}
```

The setter (`set_timing_profile_idx` at `0x8006368`) clamps input to 0..2, so the `>= 3` branch is unreachable through normal control channels. That leaves three observable behaviours:

| `g_timing_profile_idx` | Multiplier | Extra cooldown (@ 1 ms/tick) |
|---|---|---|
| `0` | `0` | **0 ticks (disabled)** |
| `1` | `1` | 1200 ticks ≈ **1.2 s** |
| `2` | `2` | 2400 ticks ≈ **2.4 s** |

The same byte is also read by `sub_80142D4` → `sub_8005458`, which uses it as an index into a lookup table to pick timeout values for some float-compare debounce state machine (`1000 * v` and `1000 * (v+3)` ms grace/hard timeouts). **So changing this byte affects two different things**: the CT post-parse cooldown AND a debounce window somewhere else. The second path was not fully traced — change with care.

To get the **fastest possible** CT poll, set `g_timing_profile_idx = 0` via **BLE cmd `0x22`** (dispatcher case 34 @ `0x8007852`), 1 byte = `0`. At that setting, the per-cycle delay drops from `300 + 5 + 500 + 1200 ≈ 2.0 s` to `300 + 5 + 500 + 0 ≈ 0.8 s` — a ~2.5× speedup.

**To change the base 300/500-tick loop** there is still no command path — firmware patch only, cleanest knob is `MOV.W R6, #0x12C` at `0x80055C4` (default-loop delay).

### Reading the current `g_timing_profile_idx`

**Yes, it is readable** — via **BLE cmd `0x03`** ("Get work status info", dispatcher case 3). `sub_8008C30` at `0x8008D2C` stores `ct_post_parse_delay_multiplier()` into `byte_20003D8E`, which is offset `0x0E` within the 109-byte (`0x6D`) payload sent by `ble_build_frame(3, &word_20003D2F, 0x6D)`. For in-range values (0/1/2), multiplier == raw value, so you can read `g_timing_profile_idx` directly from the work-status response. The `>=3` branch is unreachable via normal command paths, so this equivalence holds in practice.

MQTT equivalent: the "Get work data" handler likely exposes the same field — not verified exact offset in MQTT payload.

**Factory default.** `sub_8005DA0` init at `0x800604A`:
```c
v57 = byte_20003028;                    // mirror @ EEPROM 0x375
if ( byte_20003028 != 2 )
    v57 = g_timing_profile_idx;         // primary @ EEPROM 0x37B
g_timing_profile_idx = v57;
```
The setter writes both slots together, so they normally match. On an uninitialised unit (both bytes = `0xFF`), `g_timing_profile_idx` ends up `0xFF` — the `>= 3` branch of `ct_post_parse_delay_multiplier` then returns `2` for HME-3/CT003 (the default `g_ct_meter_type`) or `1` otherwise. So a factory-fresh CT003-paired unit runs at the maximum 2.4 s cooldown until commissioned.

**Practical recipe:**
1. Send BLE cmd `0x03` (work status info), read byte `[0x0E]` of the response payload to observe the current multiplier.
2. If you want to change: send BLE cmd `0x22` with value `0` (fastest) / `1` / `2` (slowest).
3. Repeat step 1 to confirm the change took effect.

## Query frame — `ct002_build_query` (`sub_801FF78`)

Builds a binary frame into the caller's buffer using `sub_8027628` (a helper that wraps payload with SOH/STX/`|`-fields/ETX/checksum). The fields, in order:

| Position | Content | Source |
|---|---|---|
| 0 | `<battery_device_type>` e.g. `HMG-50` | `g_device_type_string` |
| 1 | `<battery_id>` (ASCII) | `dword_20003667`+13 B at `byte_20003DEC` |
| 2 | `HME-4` or `HME-3` | `dword_2000ECD0`, hard-coded per `g_ct_meter_type` |
| 3 | `<ct_meter_mac>` 12 ASCII hex chars | `dword_2000ECD6` (from `g_ct_meter_mac_ascii`) or zeros |
| 4 | phase position char `0`/`A`/`B`/`C`/`D` | `byte_2000ECE3` from `byte_20000478` |
| 5 | some float→int value (only when `byte_20002FB4 ∈ {0, 5}`) | `*(float*)&dword_200024DC` |

On the wire this becomes:
```
SOH STX <ascii-total-length> | HMG-50 | <bat_id> | HME-4 | 009c17c24819 | 0 | 0 ETX <xor-lsb-hex-2>
```

This matches `build_query()` in `query-ct-meter2.py` exactly (`'|' + '|'.join([device_type, battery_mac, ct_type, ct_mac, '0', '0'])`).

## Response parsing — `ct002_parse_response` (`sub_8025338`)

Entry conditions (all verified at function start):
- Buffer pointer and output pointer both non-null (`0x8025346`).
- Header = SOH STX (`0x8025370` — compared against `dword_8025600`).
- ASCII length field matches actual buffer length (`0x8025392`).
- ETX at offset `-3` (`0x8025392`).
- XOR checksum of everything before the 2-char hex checksum matches (`0x80253C0`, via `sub_8014BDC`).

If any check fails, returns `0` and discards the message.

Fields are extracted by repeatedly calling a tokenizer (`sub_8002458`) on `|` (`0x802560C` literal) into an array of up to 32 pointers. The 28 used fields are then converted (`sub_8002742` = atoi) and stored as named globals:

| # | Label (Python) | Storage | Type | Width |
|---|---|---|---|---|
| 0 | `meter_dev_type` | `byte_2000ECE8[2]` | ASCII | 6 B |
| 1 | `meter_mac_code` | `byte_2000ECE8[8]` | ASCII | 13 B |
| 2 | `hhm_dev_type` | `byte_2000ECE8[21]` | ASCII | 7 B |
| 3 | `hhm_mac_code` | `byte_2000ECE8[28]` | ASCII | 13 B |
| 4 | `A_phase_power` | `dword_2000ED14` | int | 4 B |
| 5 | `B_phase_power` | `dword_2000ED18` | int | 4 B |
| 6 | `C_phase_power` | `dword_2000ED1C` | int | 4 B |
| 7 | `total_power` | `dword_2000ED20` | int | 4 B |
| 8 | `A_chrg_nb` | `byte_2000ED24` | u8 | 1 B |
| 9 | `B_chrg_nb` | `dword_2000ED28` | int | 4 B |
| 10 | `C_chrg_nb` | `byte_2000ED2C` | u8 | 1 B |
| 11 | `ABC_chrg_nb` | `dword_2000ED30` | int | 4 B |
| 12 | `wifi_rssi` | `byte_2000ED34` | int8 | 1 B |
| 13 | `info_idx` | `byte_2000ED35` | u8 | 1 B |
| 14 | `x_chrg_power` | `dword_2000ED38` | int | 4 B |
| 15 | `A_chrg_power` | `dword_2000ED3C` | int | 4 B |
| 16 | `B_chrg_power` | `dword_2000ED40` | int | 4 B |
| 17 | `C_chrg_power` | `dword_2000ED44` | int | 4 B |
| 18 | `ABC_chrg_power` | `dword_2000ED48` | int | 4 B |
| 19 | `x_dchrg_power` | `dword_2000ED4C` | int | 4 B |
| 20 | `A_dchrg_power` | `dword_2000ED50` | int | 4 B |
| 21 | `B_dchrg_power` | `dword_2000ED54` | int | 4 B |
| 22 | `C_dchrg_power` | `dword_2000ED58` | int | 4 B |
| 23 | `ABC_dchrg_power` | `dword_2000ED5C` | int | 4 B |
| 24 | `low_price_ele_in` | `dword_2000ED60` | int | 4 B |
| 25 | `normal_price_ele_in` | `dword_2000ED64` | int | 4 B |
| 26 | `low_price_ele_out` | `dword_2000ED68` | int | 4 B |
| 27 | `normal_price_ele_out` | `dword_2000ED6C` | int | 4 B |

Every one of these is also emitted to the UART debug log (`sub_80238B4 "ct002_get_info.<field>=%..."`).

### Downstream consumers

After parsing, only a small subset is actually fed into the control path:

1. **`a3[0..3]` = total, A, B, C phase power** — the caller (`ct_meter_poll_state_machine`, `0x8022A80`) receives these on stack as `v37..v40` and forwards them with `xQueueGenericSend(g_ct_data_queue, &v37, 0 /* no wait */, 2 /* queueOVERWRITE */)` at `0x8022E48`. This is FreeRTOS `xQueueGenericSend` — verified by the `..\..\SDK\FreeRTOS\queue.c` line-number references (844–849) inside the function. With `xCopyPosition = 2` (`queueOVERWRITE`) the queue behaves as a **latest-value mailbox** that holds only the most recent sample — perfect for sensor data that the control loop wants to read whenever it's ready, with each new reading replacing the prior one. This is the only place the CT data crosses into the rest of the system.

2. **Sanity gates** (rejects the response):
   - `meter_mac_code` (field 1) must match either `dword_2000ECD0` (the currently configured `HME-*` label) — this is the symmetric "sender recognises us" check.
   - `hhm_mac_code` (field 3) must match `g_ct_meter_mac_ascii` when that's set to something other than `"0000"`.
   - If either check fails, the response is discarded and no update happens (`0x8025A10`).

3. **Per-phase fan-out** — `ct_select_phase_power` (`sub_8004C1C` @ `0x8004C1C`):
   - Triggered only when at least one `*_chrg_power` / `*_dchrg_power` field is non-zero (`0x8025A74`).
   - Picks one phase based on `g_battery_phase_pos` (`byte_20000478`, `0/1/2/3` = unassigned/A/B/C) and writes to the caller's buffer (`a3` = `v37`, a 40-byte struct):

   | Offset | Value | Source |
   |---|---|---|
   | `a3+16` | `x_dchrg_power` (cross-phase discharge) | `dword_2000ED4C` |
   | `a3+20` | `x_chrg_power` (cross-phase charge) | `dword_2000ED38` |
   | `a3+24` | discharge-power **for the selected phase** | `A_/B_/C_dchrg_power` or `ABC_dchrg_power` (default) |
   | `a3+28` | charge-power **for the selected phase** | `A_/B_/C_chrg_power` or `ABC_chrg_power` (default) |
   | `a3+32` | `word_2000ECE4` (the float→int value the battery puts in its own query frame) | — |
   | `a3+36` | charge-counter **for the selected phase** | `A_/B_/C_chrg_nb` or `ABC_chrg_nb` |

   - **Parallel-mode override** (`g_parallel_mode == 1`, formerly `byte_20003024`): the four phase-charge-counter bytes and the four phase-charge/discharge-power words are **summed** and written to `a3+24/+28/+36` instead — so a parallel-stacked battery sees the combined load across all phases regardless of its own phase assignment.

4. **`info_idx` duplicate detection**:
   - If the just-received `info_idx` (field 13) equals `byte_20001621` (the previous value) *and* is non-zero, the function returns `2` (success-but-duplicate) without forwarding (`0x8025A4E`). This lets the caller discard redundant samples.

5. **`wifi_rssi`, `*_chrg_nb`, `low/normal_price_ele_*`** — stored in globals but not re-read anywhere in the firmware I walked. They exist for logging / future use.

## BLE configuration summary

| BLE cmd | Dispatcher case | Effect |
|---|---|---|
| `0x18` | 24 @ `0x80073A2` | **CT meter type** — calls `ct_reset_state()` first, then sets `g_ct_meter_type` (1 / 3 / 4 / 5 / 6), copies 12-byte meter MAC into `g_ct_meter_mac_ascii`, sets `byte_2000160E = 1` to force re-discovery. |
| `0x21` | 33 @ `0x800779C` | **P1 meter (HomeWizard) IP** — read/write `g_p1_meter_ip` (`byte_2000366B`, EEPROM `0x3500`). Sub-cmd `10` writes, sub-cmd `11` reads. The value is consumed by `sub_800D338` (MQTT/HTTP handler, only xrefs at `0x800E898` and `0x800EC3C`) and used with `AT+QHTTPCFG="url","http://<ip>/api/v1/data"` (`0x800B6EC`). **Not** used by the CT poll path. Log strings confirming this: `[HTTP] Read P1 meter ip: %s` (`0x800AD7C`), `!!! [HTTP] Warning : P1 METER DISCONNECT!!!` (`0x800A414`), `[MQTT] Set P1 IP...` (`0x800EC6C`). Understood to be single-battery only. |
| `0x02` | 2 @ `0x8006B80` | **HTTP server type** (subdomain selector for cloud telemetry) — writes `byte_20003092` at EEPROM `0x441`, clamped to 0..2. Log: `[BLE] Set server type: %d, real type: %d` (`0x8006EE0`). Response echoes the actually-stored value. |
| `0x22` | 34 @ `0x8007852` | **Timing profile index** (unnamed by firmware; see caveat in "Post-parse cooldown" section). Calls `set_timing_profile_idx(frame[4])`, clamps to 0..2, persists at EEPROM `0x37B` and mirrored at `0x375`. Affects the CT post-parse cooldown AND an unrelated debounce window in `sub_8005458`. Response echoes the raw input (not the stored value). |
| `0x24` | 36 @ `0x80078A6` | Read the dev-net-info string (`g_dev_net_info` / `byte_2000F188`) — useful for debugging what host the modem is currently using. |

### `ct_reset_state` (formerly `sub_8020AF4`)

Called before any CT-type change (BLE cmd `0x18`, MQTT `meter=<n>`). Resets cached CT state so the newly-configured meter is fully re-discovered:

```c
byte_20000488       = 1;
byte_20000489       = 1;
byte_20000475       = 0;
flt_200004A8        = 0.0f;
word_20000486       = 0;
byte_20000477       = 1;
g_battery_phase_pos = 0;     // back to "unassigned"
sub_8005790();               // re-trigger discovery (only xref from sub_80054F0)
sub_8003378();               // purpose not traced
```

## MQTT configuration

The firmware also accepts remote configuration over MQTT (Quectel `AT+QMTSUB`/`QMTPUB`, topic `marstek_energy/<gid>/App/<devid>/ctrl`). `sub_8011470` is the "Set meter type" handler (`[MQTT] Set meter type = %d` at `0x80116A8`). It parses `meter=<n>` and optional `mac=<12hex>` from the payload and routes to the same globals as BLE cmd `0x18`:

```c
if (g_ct_meter_type != v13 && v13 < 8) {
    sub_8020AF4();
    g_ct_meter_type = v13;
    byte_2000160E = 1;   // re-discovery trigger
}
```

Other MQTT handlers observed — same command surface as BLE, mostly mirroring:
`Set work mode`, `Set manual/economy mode`, `Set local time`, `Set reset`, `Set develop mode`, `Set mode auto change`, `Set eps enable/disable`, `Set http server type`, `Get err code/bms data info`, `Set ver/max charge/max discharge power`, `Set FC41D URL OTA`, `Get event log info`, `Info active upgrade`, `Set parallel machine enable`, `Get meter ip info`, `Set P1 IP`, `Set generator enable`, `Get now power data num`, `Set local api`.

**None of these handlers exposes a poll-rate knob.**

## Talking to a CT002 directly

You can talk to a CT002 over UDP:12345 without going through the battery at all. Minimal Python (based on `C:/Work/MT/scripts/query-ct-meter2.py`):

```python
build_query('HMG-50', battery_mac='acd9298922aa', ct_mac='009c17c24819', ct_type='HME-4')
```

The meter will respond with a 28-field `|`-separated frame. For a CT003, substitute `ct_type='HME-3'`.

## Caveats

- All four functions flagged previously as untraced are now covered:
  - `sub_80142B0` → `ct_post_parse_delay_multiplier` (full trace — drives the post-parse cooldown from `g_timing_profile_idx`)
  - `sub_80049DC` → `ct_alt_handler` (wrapper — dispatches two subroutines `sub_80049C8` / `sub_80049B4` / `sub_8004BA0` whose own contents were not traced)
  - `sub_802F700` → `xQueueGenericSend` (FreeRTOS identified by `queue.c` line numbers)
  - `sub_8020AF4` → `ct_reset_state` (state-clear for CT type switch; the two subroutines it calls at the end, `sub_8005790` and `sub_8003378`, are not fully traced)
- `ct_select_phase_power` (formerly `sub_8004C1C`) is fully traced — see the per-phase fan-out section.
- Tick-to-ms conversion assumes `configTICK_RATE_HZ = 1000` (commonly the case on this class of STM32 firmware, but not confirmed from this binary).
- "Connectivity flag" `byte_2000095E` is assumed to be the Wi-Fi/LAN-up indicator because `sub_80055BC` gates on it before any CT work, but its exact semantics were not traced here.
- The P1 meter path (HomeWizard, HTTP `/api/v1/data`) is documented in the BLE/MQTT tables but the full request/response flow and its interaction with the CT path were not traced. The user notes it is single-battery only.
- `g_timing_profile_idx == 0` effect on cloud telemetry (empty subdomain prefix) is **not** tested — only the effect on the CT cooldown multiplier is proven by the code.
