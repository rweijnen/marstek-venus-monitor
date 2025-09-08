#!/usr/bin/env python3
"""
Simple UDP test for Marstek Local API (Windows compatible - no emojis)
"""

import socket
import json
import time
import sys

def test_port(port, method="Marstek.GetDevice"):
    """Test a single port with given method"""
    print(f"Testing port {port} with method {method}...")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(1)
    
    cmd = {
        "id": 0,
        "method": method,
        "params": {"id": 0}
    }
    
    try:
        message = json.dumps(cmd).encode('utf-8')
        sock.sendto(message, ('255.255.255.255', port))
        print(f"Sent: {json.dumps(cmd)}")
        
        start_time = time.time()
        while time.time() - start_time < 1:
            try:
                data, addr = sock.recvfrom(4096)
                response = data.decode('utf-8')
                print(f"Response from {addr[0]}:{addr[1]}")
                print(f"Raw: {response}")
                
                try:
                    json_resp = json.loads(response)
                    print("JSON Response:")
                    print(json.dumps(json_resp, indent=2))
                    return True
                except:
                    print("Not valid JSON")
                    return True
                    
            except socket.timeout:
                continue
            except Exception as e:
                print(f"Error: {e}")
                break
                
    except Exception as e:
        print(f"Send error: {e}")
    finally:
        sock.close()
    
    print("No response")
    return False

def main():
    print("=" * 50)
    print("Marstek UDP Test (Simple)")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    else:
        port = 30000
        
    print(f"Testing port {port}")
    print()
    
    # Test discovery
    print("1. Testing Marstek.GetDevice...")
    found1 = test_port(port, "Marstek.GetDevice")
    print()
    
    # Test WiFi status  
    print("2. Testing Wifi.GetStatus...")
    found2 = test_port(port, "Wifi.GetStatus")
    print()
    
    if found1 or found2:
        print(f"SUCCESS: Device responded on port {port}")
    else:
        print(f"NO RESPONSE on port {port}")
        print("Make sure:")
        print("- Local API is enabled via BLE")
        print("- Device is on same network")
        print("- Correct port number")

if __name__ == "__main__":
    main()