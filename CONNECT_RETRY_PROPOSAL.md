# Connect + retry simplification proposal

Comparison of the current `js/ble-protocol.js` connection / retry logic against what the Marstek MT Android app (v1.6.62) actually does, with a proposed simpler replacement.

## What the Android app does (ground truth)

**BLE plugin:** `flutter_blue_elves` (Android-only). On Android, `BluetoothGatt` keeps the link alive automatically — no app-level keepalive reads.

**Connect flow** — `BleManager.connectDevice(info, isReConnect, nextConnect, onConnected, onNotConnected, onNotFoundDevice)`:

1. Call `Device::connect()` (flutter_blue_elves).
2. Attach **four** listeners: `setDiscoveryStreamListener`, `setStateStreanListener`, `setNotifyResultListener`, `setBleRssiListener`.
3. Start a `Timer.periodic(Duration(seconds: 1))` for app-side state housekeeping (refreshing MAC, updating `DeviceListController`) — **not** BLE keepalive.

**No "wait-for-stabilization" delays. No retry-inside-connect loop. No service-discovery timeout dance.** Connect either works or it fires the state stream with a disconnected state — in which case the state-stream handler decides whether to reconnect.

**Disconnect handling** — in `setStateStreanListener`'s closure:
1. Log `[handleStateStream]监听蓝牙状态变化流, 处于(<state>)`.
2. Clear in-memory "connected" flags (`BleManager.field_3f`, `Manager.field_727`).
3. Fan out to registered listeners (4 fields dispatched via indirect call).
4. `Device::destroy()` — clean up plugin state.
5. Log `[handleStateStream]监听蓝牙状态变化流(isReConnect_local 设定为 <bool>)` — the local reconnect flag is derived from `BleManager.field_2b`.
6. If reconnect flag is true, schedule a new `connectDevice(..., isReConnect: true, nextConnect: N+1)` — that's the retry path.

**Command-level retry** — every frame write goes through `CommonCommand.retryOnTimeoutWithNoTag(action, verifier, {checkResult, onError, onSuccess, retryTimes: 3, timeout: Duration(seconds: 5)})`. Defaults: **3 attempts, 5 s timeout per attempt**, with a success verifier. So a dropped response packet retries the frame, not the connection.

**Durations found in the app's const Duration pool** (μs values):
25 ms · 250 ms · 1 s · 2 s · 3 s · 5 s · 10 s · 15 s · 10 min · 4 hr. No 25-second or 60-second value — no explicit keepalive.

## What the monitor currently does

### `connect()` — `js/ble-protocol.js:306` (~320 lines)

Nested delays per attempt (up to 3 attempts):

1. 1 s pre-delay after `requestDevice` (`Preparing device connection`).
2. `gatt.connect()` with a **15 s** race timeout.
3. **2 s / 4 s / 6 s** variable "stabilization wait" depending on attempt number.
4. `getPrimaryService(SERVICE_UUID)` with a **15 s** race timeout.
5. On service-discovery failure: log debug info + list all services + wait **8 s** + retry with **20 s** timeout.
6. On second service-discovery failure: wait **12 s** + final retry with **30 s** timeout.
7. If the attempt still failed: back off 2 s / 5 s / 8 s and try again from step 2.

**Worst-case cumulative wait per failed attempt:** 1 + 15 + 6 + 15 + 8 + 20 + 12 + 30 = **107 seconds**, then another 8 s backoff before next attempt. Three attempts = **~5 minutes** before the retry dialog shows.

### `sendCommand()` — `js/ble-protocol.js:1046`

- Writes the frame, fires a 3 s cleanup timer that just clears `currentCommand`.
- **Retries only if the write itself throws**, not on missing response.
- No success verifier. A dropped notification packet silently fails with no retry.

### `startKeepalive()` — 25 s silent GATT read

Correct in principle (Web Bluetooth has weaker GATT session guarantees than Android); ~25 s is well under the battery's 60 s idle-disconnect so this is safe insurance.

## The three problems in the real-world log the user shared

```
[18:04:56] 🔄 Connection attempt 1/3...
[18:04:56] ⏳ Waiting for device to stabilize (2s)...
[18:04:58] ⚠️ Device disconnected during stabilization wait - retrying connection
[18:05:04] 🔍 Discovering services...
[18:05:19] ⚠️ Service not immediately available: Immediate service discovery timeout after 15s
```

1. The **2 s "stabilization wait" actively hurts** — the device disconnected *during* the wait. Without the wait, the immediate `getPrimaryService` call would have succeeded.
2. The **15 s service-discovery timeout masks a 1 s failure** — either the service is there and answers in <500 ms, or it isn't and waiting 15 s doesn't bring it back. The extra wait only extends user-visible failure time.
3. After disconnect the code falls back to retries that recompose with more 4 s / 6 s stabilization waits on top, so the total time to a clean error message stretches to the minutes range.

## Root-cause: Web Bluetooth ≠ Android BluetoothGatt

The monitor's wait ladder originated as a defensive workaround for quirks (service not exposed immediately after pairing, etc.). On **Web Bluetooth specifically**:

- `device.gatt.connect()` resolves **after** link-layer connection + MTU negotiation. There's no stabilization phase the browser is hiding from you. If `getPrimaryService` throws immediately after, the device either didn't finish GATT init or disconnected — and neither is fixed by waiting.
- `gattserverdisconnected` is a terminal event for that session. Re-connecting requires either a user gesture (`requestDevice`) or a cached-device reconnect via `navigator.bluetooth.getDevices()` (Chrome 113+). Retry-in-loop without surfacing the disconnect just masks the real state.
- Chrome does **not** require the app to generate keepalive traffic to hold the GATT session — the OS does that. The 25 s keepalive read is purely defense against the **device-side** idle timeout.

## Proposal

Three independent changes, ordered by value. Apply any or all.

---

### Change 1 — Flatten `connect()` (biggest win)

Replace the current 320-line function with a small, linear one. No stabilization wait; short, meaningful timeouts; fail fast with a clear error.

```js
const CONNECT_TIMEOUT_MS = 10_000;   // gatt.connect() — device response time
const DISCOVER_TIMEOUT_MS = 3_000;   // getPrimaryService — should be sub-second

async function connect() {
    if (connectionInProgress) {
        log('⚠️ Connection already in progress');
        return;
    }
    connectionCancelled = false;
    connectionInProgress = true;

    try {
        log('🔍 Searching for Marstek devices...');
        device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'MST' }],
            optionalServices: [SERVICE_UUID]
        });
        if (connectionCancelled) return;
        logActivity(`📱 Found device: ${device.name}`);

        log('🔗 Connecting to GATT...');
        server = await withTimeout(device.gatt.connect(), CONNECT_TIMEOUT_MS,
            'GATT connect timeout');

        log('🔍 Discovering service...');
        const service = await withTimeout(server.getPrimaryService(SERVICE_UUID),
            DISCOVER_TIMEOUT_MS, 'Service discovery timeout');

        log('🔍 Discovering characteristics...');
        const chars = await service.getCharacteristics();
        characteristics = {};
        for (const char of chars) {
            characteristics[char.uuid] = char;
            if (char.properties.notify && char.uuid.includes('ff02')) {
                await char.startNotifications();
                char.removeEventListener('characteristicvaluechanged', handleUnifiedNotification);
                char.addEventListener('characteristicvaluechanged', handleUnifiedNotification);
                log('📡 Notifications enabled for FF02');
            }
        }

        device.addEventListener('gattserverdisconnected', onDisconnected);
        onConnected(device);
        startKeepalive();
        log('✅ Connected');
    } catch (err) {
        log(`❌ Connection failed: ${err.message}`);
        cleanupAfterFailedConnect();
        showRetryDialog();
    } finally {
        connectionInProgress = false;
    }
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            createTrackedTimeout(() => reject(new Error(label)), ms))
    ]);
}
```

Notes:
- **No stabilization delay.** The 2–6 s wait was the direct cause of the "disconnected during wait" failure in the real log.
- **3 s service-discovery timeout.** If it doesn't come back in 3 s, it's gone. Chrome answers a live service in under 500 ms.
- **No inner retry loop.** One attempt, clear failure, user decides whether to retry (and `showRetryDialog` already exists in the codebase for that).
- Disconnect handling moves to a dedicated `onDisconnected` function — smaller blast radius.
- Keep `startKeepalive()` — it's correct.

---

### Change 2 — Add command-level retry (matches app's pattern)

The app retries individual frames, not the connection. Port that.

```js
// Matches CommonCommand.retryOnTimeoutWithNoTag in the app:
//   retryTimes: 3, timeout: Duration(seconds: 5)
const DEFAULT_CMD_TIMEOUT_MS = 5_000;
const DEFAULT_CMD_RETRIES = 3;

async function sendCommandWithRetry(commandType, commandName, payload = null, {
    retries = DEFAULT_CMD_RETRIES,
    timeoutMs = DEFAULT_CMD_TIMEOUT_MS,
    verifier,  // (response) => bool — optional success check
} = {}) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await sendAndWaitForResponse(
                commandType, commandName, payload, timeoutMs);
            if (!verifier || verifier(response)) return response;
            lastError = new Error(`Response verification failed for ${commandName}`);
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                log(`🔄 Retrying ${commandName} (attempt ${attempt + 1}/${retries}): ${err.message}`);
            }
        }
    }
    log(`❌ ${commandName} failed after ${retries} attempts: ${lastError.message}`);
    throw lastError;
}

async function sendAndWaitForResponse(commandType, commandName, payload, timeoutMs) {
    const command = createCommandMessage(commandType, payload);
    const writeChar = Object.values(characteristics).find(
        c => c.properties.write || c.properties.writeWithoutResponse);
    if (!writeChar) throw new Error('No writable characteristic');

    // Race the write + async-response-handler's promise for cmd against a timeout.
    // AsyncResponseHandler (response-handler.js) already has the 500ms quiet-window
    // reassembly — we just need it to expose a promise that resolves on next matching
    // response. If the API isn't there yet, add a `waitFor(cmd, timeoutMs)` method.
    const responsePromise = window.asyncResponseHandler.waitFor(commandType, timeoutMs);
    await writeChar.writeValueWithoutResponse(command);
    if (commandName !== 'Keepalive') resetKeepaliveTimer();
    return responsePromise;
}
```

Implementation note: `AsyncResponseHandler` (`js/response-handler.js`) already buffers multi-packet responses using its 500 ms quiet window. It needs a small API addition — `waitFor(commandByte, timeoutMs)` returning a promise that resolves with the next matching reassembled response (or rejects on timeout). Everything else can stay as is.

Existing `sendCommand(commandType, commandName, payload, retryCount)` becomes a thin shim for backward compatibility, delegating to `sendCommandWithRetry`. Buttons that currently fire-and-forget can keep their current UX; places that need to read the response (already exists in the CT info flow, DoD read, etc.) benefit from the reliable retry.

---

### Change 3 — Cache the device across sessions (Chrome 113+)

Add an optional fast-reconnect path that avoids `requestDevice` when the user previously authorized a device.

```js
async function connect() {
    if (connectionInProgress) return;
    connectionInProgress = true;
    try {
        // Try silent reconnect to previously-authorized device first
        device = null;
        if (navigator.bluetooth.getDevices) {
            const known = await navigator.bluetooth.getDevices();
            const mst = known.find(d => d.name?.startsWith('MST'));
            if (mst) {
                log(`⚡ Found previously-paired device: ${mst.name}`);
                device = mst;
            }
        }
        // Fall back to picker if no cached device
        if (!device) {
            device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'MST' }],
                optionalServices: [SERVICE_UUID]
            });
        }
        // … rest of connect flow from Change 1 …
```

Only works in Chromium-based browsers with the `chrome://flags/#enable-web-bluetooth-new-permissions-backend` flag (on by default in Chrome 113+). Safely guarded by the `getDevices` feature check.

---

## What not to change

- **Keepalive (25 s silent GATT read)** — still needed on Web Bluetooth; the battery firmware's 60 s idle disconnect is a device-side thing that the app doesn't trigger because users actively poll.
- **`AsyncResponseHandler`'s 500 ms quiet-window reassembly** — correct and already matches how the battery splits responses across BLE packets.
- **The `stable` branch's single-file version** — don't touch; it's the antique deployed to site root.

## Rough estimate of impact

On a healthy first connection:
- Before: `1 s prep` + `~300 ms gatt.connect` + `2 s stabilize` + `~200 ms discover` = **~3.5 s** in the best case.
- After: `~300 ms gatt.connect` + `~200 ms discover` = **~500 ms**.

On a disconnect-during-stabilize (the log the user shared):
- Before: `~5 minutes` through the full retry ladder before retry dialog.
- After: fails in ~10 s with a clear error, user taps Retry.

On a transient packet drop during normal command traffic:
- Before: button silently no-ops, user retries manually.
- After: automatic 3× retry with 5 s timeout per attempt, succeeds on first packet-drop.
