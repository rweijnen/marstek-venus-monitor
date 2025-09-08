# discover_udp.py
import json, socket, sys, time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 30000
payload = {"id": 0, "method": "Marstek.GetDevice", "params": {"ble_mac": "0"}}

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
sock.settimeout(2.0)

sock.sendto(json.dumps(payload).encode(), ("255.255.255.255", PORT))
print(f"Broadcast sent to 255.255.255.255:{PORT}")

start = time.time()
while time.time() - start < 2.0:
    try:
        data, addr = sock.recvfrom(4096)
        print(f"Reply from {addr}: {data.decode(errors='ignore')}")
    except socket.timeout:
        break
