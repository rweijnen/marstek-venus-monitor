#!/usr/bin/env python3
"""
Test direct UDP API calls to specific Marstek device IP
"""

import socket
import json
import time

def test_direct_api(ip, port=30000):
    """Test direct API calls to specific device IP"""
    print(f"Testing direct API to {ip}:{port}")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(2)
    
    # Test commands
    commands = [
        {
            "name": "Device Discovery",
            "cmd": {"id": 1, "method": "Marstek.GetDevice", "params": {"id": 0}}
        },
        {
            "name": "WiFi Status", 
            "cmd": {"id": 2, "method": "Wifi.GetStatus", "params": {"id": 0}}
        }
    ]
    
    for test in commands:
        print(f"\n--- Testing {test['name']} ---")
        try:
            message = json.dumps(test['cmd']).encode('utf-8')
            print(f"Sending: {json.dumps(test['cmd'])}")
            
            sock.sendto(message, (ip, port))
            
            try:
                data, addr = sock.recvfrom(4096)
                response = data.decode('utf-8')
                print(f"Response from {addr[0]}:{addr[1]}")
                print(f"Raw: {response}")
                
                try:
                    json_resp = json.loads(response)
                    print("Parsed JSON:")
                    print(json.dumps(json_resp, indent=2))
                except json.JSONDecodeError:
                    print("Invalid JSON response")
                    
            except socket.timeout:
                print("No response (timeout)")
            except Exception as e:
                print(f"Receive error: {e}")
                
        except Exception as e:
            print(f"Send error: {e}")
    
    sock.close()

if __name__ == "__main__":
    ip = "192.168.20.80"
    
    # Test common ports
    ports = [30000, 8080, 8888, 12345, 50000, 51000, 52000]
    
    print(f"Testing Local API on {ip} across multiple ports...")
    
    for port in ports:
        print(f"\n{'='*50}")
        print(f"TESTING PORT {port}")
        print(f"{'='*50}")
        
        test_direct_api(ip, port)
        
        # Quick check if we got any response
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(0.5)
            test_cmd = {"id": 99, "method": "test", "params": {}}
            sock.sendto(json.dumps(test_cmd).encode(), (ip, port))
            data, addr = sock.recvfrom(1024)
            print(f"[!] Got response on port {port} - API is active!")
            sock.close()
            break
        except:
            sock.close()
            continue