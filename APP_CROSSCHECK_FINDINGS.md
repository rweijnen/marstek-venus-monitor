# Marstek MT Android App — cross-check findings against Venus E firmware

Reverse-engineering findings from the **Marstek MT Android app v1.6.62** (released 2026-04, built on Flutter engine 3.8.1). Purpose: answer the outstanding questions in `ANDROID_APP_CROSSCHECK.md` and flag any places where our monitor's current understanding disagrees with what the app actually does on the wire.

**Source of evidence.** `com.hamedata.marstek.apk` base APK extracted from `MARSTEK_1.6.62_APKPure.xapk`. Flutter app — all protocol logic is in the compiled Dart AOT snapshot at `lib/arm64-v8a/libapp.so`. Decompiled with Blutter into pseudo-Dart with full class/method names and ARM64 disassembly. Output tree at `c:/Work/MT/apk/1.6.62/blutter-out/`.

Offset math used below:
- The app's `VenusRealTimeController.parseBleRealTimeData(frame)` reads the **full frame** (with the 4-byte `[0x73][len][0x23][cmd]` header still attached).
- In the compiled ARM64, `ldrb wN, [x, #R]` reads the raw byte at frame offset `R`. That maps to crosscheck **payload offset `R - 4`**.
- Calibrated against known bytes: `[x, #4]`/`[x, #5]` → `powerOffGrid` (payload `0x00`, int16 LE); `[x, #0x41]` → WiFi RSSI (payload `0x3D`). Both match `ANDROID_APP_CROSSCHECK.md` section 4.

## 1. Correction to `RuntimeInfo.ts` — v156+ bytes are NOT BLE Lock / DoD

The monitor's v156+ labels on payload bytes `0x6D` and `0x6E` are **wrong**. The underlying command handlers (cmd `0x53` BLE Lock, cmd `0x54` DoD) are correct — this only concerns the Runtime Info (cmd `0x03`) response parser.

### Ground truth from the app (what `parseBleRealTimeData` does)

At `parseBleRealTimeData` in `package:cross_power_x/pages/AC_Coupler/controller/venus_realTime_controller.dart`, near disasm offset `0x1086558..0x1086580`:

```
ldrb w2, [x0, #0x70]   ; r2 = frame[0x70] = payload[0x6C]
ldrb w4, [x0, #0x71]   ; r4 = frame[0x71] = payload[0x6D]    (saved to stack)
ldrb w1, [x0, #0x6f]   ; r1 = frame[0x6F] = payload[0x6B]
bl  handleBatteryMask  ; → handleBatteryMask(payload[0x6B], payload[0x6C])
ldur x1, [fp, #-0x20]  ; r1 = saved payload[0x6D]
bl  handleWorkedBatteryPack  ; → handleWorkedBatteryPack(payload[0x6D])
```

Then payload `0x6E` onwards:

```
ldrb w2, [x1, #0x73]   ; r2 = frame[0x73] = payload[0x6F]
; ...maps r2 into SubscriptionStatus enum via cmp-chain {0,1,2,3,else}
```

A sibling code path at `0x1086ca0..` reads `[x0, #0x72]` (= payload `0x6E`) into the same SubscriptionStatus enum mapping (log string `"ACC======ble===VDAC==vidSubscriptionStatus===="`).

### `handleWorkedBatteryPack(n)` — what it does

From `package:cross_power_x/pages/AC_Coupler/controller/venus_helper.dart` at `0xc7d120`:

```
static void handleWorkedBatteryPack(int n) {
  if (Manager.lastWorkedPackIndex == n) return;
  Manager.lastWorkedPackIndex = n;
  // Zero all battery-pack state strings in the list
  for (int i = 0; i < packList.length; i++) packList[i].state = "0";
  // Mark pack #n (1-indexed) as working
  if (n <= packList.length) packList[n-1].state = "1";
}
```

Semantic: **`n` is a 1-based index of the currently active battery pack** in a stacked / parallel battery system (think Venus E Pro with expansion packs). For a single-battery user the value is `1`, which matches Remko's real-device reading of `0x01` that earlier looked inconsistent with "BLE Lock OFF".

### `handleBatteryMask(count, mask)` — what it does

Same file at `0xc7d2f4`:

```
static void handleBatteryMask(int count, int mask) {
  if (Manager.lastMaskHigh == mask) return;
  Manager.lastMaskHigh = mask;
  String bits = mask.toRadixString(2).padLeft(8, "0");  // 8-bit binary
  // Allocate List<BatteryPackInfoModel> of length `count`, assign each bit to one pack
  for (int i = 0; i < count; i++) { /* build pack-info entries from bits[i] */ }
  Manager.batteryPackList = newList;
}
```

Semantic: **`mask` is an 8-bit "installed packs" bitmask**, `count` is the declared total pack count. Only the low `count` bits are meaningful.

### Resulting corrected offset table (payload offsets)

| Payload offset | Current monitor label | **Correct label per app** |
|---|---|---|
| `0x68` | semantic unknown | (reads as part of same cluster — not yet decoded) |
| `0x69` | semantic unknown | " |
| `0x6A` | semantic unknown | " |
| `0x6B` | semantic unknown | **Battery pack count** (arg1 of `handleBatteryMask`) |
| `0x6C` | semantic unknown | **Installed battery-pack bitmask** (arg2 of `handleBatteryMask`; 8-bit) |
| `0x6D` | `bleLock` (v156+ label) — **WRONG** | **Working battery-pack index** (1-based, 0=none) |
| `0x6E` | `depthOfDischarge` (v156+ label) — **WRONG** | **SubscriptionStatus** (enum: 0/1/2/3 → distinct states, else → default) |
| `0x6F` | unknown | SubscriptionStatus-slot (same enum mapping, likely a sibling/secondary subscription field) |

### Why the user's v156 dump still "looked plausible"

- `0x6D = 0x01` read as "BLE Lock ON" — actually "Pack #1 is working" for a single-battery install.
- `0x6E = 0x58` (88) read as "DoD 88%" — actually "SubscriptionStatus = (default)" since `88` is outside {0,1,2,3}. 88 landing in the DoD range was coincidental.

### Where does the app *actually* get BLE Lock and DoD?

**MQTT cloud data**, not BLE runtime info. `VenusRealTimeController.parseMqttRealTimeData` at line 12+ of the same file is a string-key switch that handles:

- `"bl"` — BLE lock state → `Manager[+0x41F]`
- `"dod"` — Depth of Discharge → `Manager[+0x32F]`

For the BLE path, DoD and BLE Lock are *only* exchanged via their dedicated commands (`0x53` GET/SET BLE Lock, `0x54` SET DoD). The app never reads a DoD byte from the runtime-info response.

### Suggested fix for the monitor

In `js/protocol/payloads/RuntimeInfo.ts` (and the equivalent place in the `stable` single-file build):

1. Remove / rename `bleLock` and `depthOfDischarge` fields that read payload `0x6D` / `0x6E`.
2. Add:
   - `batteryPackCount: data[0x6B + 4]`
   - `installedPackMask: data[0x6C + 4]` (render as 8-bit binary)
   - `workingPackIndex: data[0x6D + 4]` (1-based; `0` = none)
   - `subscriptionStatus: data[0x6E + 4]` (enum — values unknown but likely 0=none/1=active/2=expired/3=? — UI can render as number pending further cross-check)
3. For BLE Lock state in the UI: keep relying on the explicit cmd `0x53` GET response (already in the monitor).
4. For DoD in the UI: keep the explicit cmd `0x54` GET path (already in the monitor).

## 2. Answers to specific crosscheck questions (partial)

### Q1 — Offset `0x6D` label in the MT app
**Answered above.** App uses it as `workingPackIndex` passed to `handleWorkedBatteryPack`, not BLE Lock.

### Q2 — Offset `0x6E` parsed as DoD?
**Answered above.** No — app maps it to SubscriptionStatus enum. DoD comes from MQTT key `"dod"` or cmd `0x54`.

### Q3 — Cmd `0x22` / timing profile UI label in the app
**Answer: "Report Interval Setting"** (vendor's English term).

Evidence: l10n key `report_interval_setting` at `pp+0x6aab0`. Translations include:
- English: "Report Interval Setting"
- German: "Berichtsintervall-Einstellung" (Fehlerprotokoll-Meldeintervall is a separate knob for the **error-log** reporting interval — don't confuse the two)
- French: "Réglage de l'intervalle de rapport"
- Chinese: "上报间隔设置"

So the user-visible semantic the vendor chose is **"how often telemetry is reported"**, not "polling rate" / "cooldown" / "timing profile". Matches firmware behaviour loosely — a larger cooldown → sparser updates. Suggest the monitor's UI for cmd `0x22` use "Report Interval Setting" to match the Marstek app, which makes the knob recognisable to users who've seen both.

### Q4 — Cmd `0x20` parallel machine prefix `10,11,12`
**Not yet investigated.** Need to locate the parallel-machine setter in `Blecommon.dart` / `BleManager.dart`.

### Q5 — Unknown bytes named in the MT app
**Partial.** The battery-pack cluster `0x6B/0x6C/0x6D` is identified above. Bytes `0x08`, `0x09`, `0x0B`, `0x31–0x39`, `0x3F`, `0x43`, `0x48`, `0x64`, `0x68–0x6A` not yet mapped.

### Q6 — Status flag bit interpretations (`statusB/C/D`)
**Not yet investigated.**

### Q7 — Cmd `0x18` meter types `2` and `7`
**Partial answer.**

What the app exposes in the CT-select UI (`pages/AC_Coupler/configure/select_ct_page.dart`): six choices — Marstek CT001, CT001.5, CT002, CT003, Shelly Pro 3EM-3CT63, P1 Meter. Icon/label assets found in `pp.txt` around offset `0x15d80..0x15e10`.

The SOFT_VER prefixes `HME-1 .. HME-5` exist as string literals, but they classify **devices** (used in `utils/device_util.dart`'s `checkDeviceEnterType`-style switch), not CT meter types. They do not directly map to cmd `0x18` type bytes.

The cmd `0x18` type byte per UI choice **is not baked as a constant** we could grep. Each entry in the CT list is constructed at runtime via `AddedCtModel(commandCode: ..., ...)` factory calls, which Blutter renders as ARM64 instructions setting `movz x?, #...` for the commandCode arg. Extracting the exact mapping requires either:
  (a) Patiently tracing the CT-list builder for each entry, reading the `movz` value that feeds the `commandCode` named arg; or
  (b) Running the app under Frida (Blutter emits a `blutter_frida.js` script) and logging `AddedCtModel` constructor calls live.

Worth doing if you want to add CT001 / CT001.5 / Shelly Pro 3EM-3CT63 support to the monitor — otherwise the firmware-side view of types `2` and `7` entering the alt handler (`ct_alt_handler` @ `0x80049DC`) suggests they are not intended for normal CT polling; possibly legacy / reserved.

### Q8 — Cmd `0x23` response bug (firmware returns cmd `0x0F` instead of `0x23`)
**Not yet investigated.** Need to find the response dispatcher in `BleManager.dart` and see whether the app tolerates the mismatch or special-cases it.

### Q9 — P1 meter IP single-battery-only
**Not yet investigated.**

### Q10 — EU 800-W mode re-clamp warning
**Not yet investigated.**

## 3. New device types discovered (out-of-band finding)

The app recognises six `MST-*` advertising-name prefixes that the monitor currently does not. Mentioned here for completeness — separate work item from the runtime-info correction above.

| Prefix | Purpose (inferred) | Source file in app |
|---|---|---|
| `MST-TPM2` | CT002 v2 / 100 A CT variant | `pages/CT003/ct_meter_model.dart`, image asset `tpm2_100ct.png` |
| `MST-SMR` | Smart Meter Reader (generic) | `pages/CT003/BleSmr.dart` |
| `MST-P1` | P1-port reader (Dutch/BE DSMR) | strings in `pp.txt` |
| `MST-IR` | IR optical reader | strings in `pp.txt` |
| `MST-TIC` | TIC reader (French Linky/Téléinfo) | strings in `pp.txt` |
| `MST-CHAR` | Charger | strings in `pp.txt` |

CT003 device code path is in `pages/CT003/{ct_CT003_home,ct_CT003_Setting,MqttSmr,BleSmr,ct_meter_select,ct_meter_model}.dart`. Firmware URL: `https://www.hamedata.com/app/download/neng/CT003_All.bin`. Whether CT003 uses the same `[0x73][len][0x23][cmd][...]` framing or a different wire protocol has **not** been confirmed yet — the literal byte `0x73` does not appear as a baked constant in `Blecommon.dart` or `BleAccoupler.dart`, meaning frames are built dynamically at send time (header + XOR checksum prepended/appended). Requires tracing the `sendFrame`/`buildFrame` wrapper in `BleManager.dart` to be sure.

## 4. Method / how to reproduce

1. Extract the xapk: `7z x MARSTEK_1.6.62_APKPure.xapk -o<dir>` → `com.hamedata.marstek.apk`.
2. Extract arm64 lib: `7z e config.arm64_v8a.apk lib/arm64-v8a/libapp.so lib/arm64-v8a/libflutter.so`.
3. Run Blutter (from VS 2022 x64 Native Tools prompt so cmake/ninja/cl.exe are on PATH):
   ```
   python <blutter>/blutter.py <libs_dir> <out_dir>
   ```
   On a cold run this fetches and builds a matching Dart VM source tree (~20–40 min); subsequent runs reuse the cached VM.
4. Relevant files in the output tree under `asm/cross_power_x/`:
   - `pages/AC_Coupler/controller/venus_realTime_controller.dart` — Runtime Info parser (`parseBleRealTimeData`) and MQTT parser (`parseMqttRealTimeData`)
   - `pages/AC_Coupler/controller/venus_helper.dart` — `handleBatteryMask`, `handleWorkedBatteryPack`
   - `Ble/Blecommon.dart`, `Blecommon_M2200N.dart`, `BleAccoupler.dart`, `BleManager.dart`, `ota_util.dart`
   - `pages/CT003/*.dart` — CT003/SMR meter code path

5. For Runtime Info specifically: grep `venus_realTime_controller.dart` for `ldrb.*\[x[0-9]+, #0x<hex>\]` where `<hex>` is `payload_offset + 4`.
