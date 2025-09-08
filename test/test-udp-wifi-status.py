#!/usr/bin/env python3
"""
Test UDP WiFi status for Marstek Local API
Tests Wifi.GetStatus method on various ports
"""

import socket
import json
import time
import sys

def discover_devices(port=30000, timeout=1):
    """
    Send UDP broadcast to get WiFi status from Marstek devices
    
    Args:
        port: UDP port number (default 30000)
        timeout: Response timeout in seconds
    """
    print(f"🔍 Testing Wifi.GetStatus on port {port}...")
    
    # Create UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout)
    
    # WiFi status command
    wifi_cmd = {
        "id": 0,
        "method": "Wifi.GetStatus",
        "params": {
            "id": 0
        }
    }
    
    try:
        # Send broadcast
        message = json.dumps(wifi_cmd).encode('utf-8')
        broadcast_addr = ('255.255.255.255', port)
        
        print(f"📤 Sending broadcast to {broadcast_addr[0]}:{broadcast_addr[1]}")
        print(f"📋 WiFi command: {json.dumps(wifi_cmd)}")
        
        sock.sendto(message, broadcast_addr)
        
        # Listen for responses
        devices_found = []
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                data, addr = sock.recvfrom(4096)
                response_text = data.decode('utf-8')
                
                print(f"📡 Response from {addr[0]}:{addr[1]}")
                print(f"📄 Raw response: {response_text}")
                
                try:
                    response_json = json.loads(response_text)
                    devices_found.append({
                        'ip': addr[0],
                        'port': addr[1],
                        'response': response_json
                    })
                    
                    print(f"✅ Valid JSON response:")
                    print(json.dumps(response_json, indent=2))
                    
                    # Check for WiFi status data
                    if 'result' in response_json and isinstance(response_json['result'], dict):
                        result = response_json['result']
                        print(f"🌐 WiFi Status Data:")
                        for key, value in result.items():
                            print(f"   • {key}: {value}")
                    
                except json.JSONDecodeError:
                    print(f"⚠️  Invalid JSON response")
                    devices_found.append({
                        'ip': addr[0],
                        'port': addr[1],
                        'raw_data': response_text
                    })
                
                print("-" * 50)
                
            except socket.timeout:
                continue
            except Exception as e:
                print(f"❌ Error receiving data: {e}")
                break
    
    except Exception as e:
        print(f"❌ Error sending broadcast: {e}")
    
    finally:
        sock.close()
    
    # Summary
    print(f"\n📊 WiFi status test completed:")
    print(f"   • Devices found: {len(devices_found)}")
    print(f"   • Timeout: {timeout}s")
    print(f"   • Port tested: {port}")
    
    if devices_found:
        print(f"\n🎯 Responding devices:")
        for i, device in enumerate(devices_found, 1):
            print(f"   {i}. {device['ip']}:{device.get('port', 'unknown')}")
            if 'response' in device and 'result' in device['response']:
                result = device['response']['result']
                if 'ssid' in result:
                    print(f"      WiFi SSID: {result['ssid']}")
                if 'ip' in result:
                    print(f"      Device IP: {result['ip']}")
    else:
        print(f"\n❌ No devices responded on port {port}")
        print(f"   Make sure:")
        print(f"   • Device Local API is enabled via BLE")
        print(f"   • Device is connected to same network")
        print(f"   • Port {port} is configured correctly")
        print(f"   • No firewall blocking UDP traffic")

def scan_port_range(start_port, end_port, timeout=1):
    """Scan a range of ports for Marstek devices"""
    port_count = end_port - start_port + 1
    
    print(f"🔍 Scanning {port_count} ports ({start_port}-{end_port}) with {timeout}s timeout...")
    
    all_devices = []
    for i, port in enumerate(range(start_port, end_port + 1), 1):
        # Progress indicator for large ranges
        if port_count > 20:
            progress = (i / port_count) * 100
            print(f"📡 [{progress:5.1f}%] Testing port {port}...", end=' ')
        else:
            print(f"📡 Testing port {port}...", end=' ')
            
        devices = discover_devices_silent(port, timeout)
        if devices:
            print(f"✅ Found {len(devices)} device(s)")
            all_devices.extend(devices)
            print(f"🛑 Stopping scan - device found on port {port}")
            break
        else:
            print("❌")
    
    return all_devices

def discover_devices_silent(port, timeout=1):
    """Silent version that returns results without printing"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout)
    
    wifi_cmd = {
        "id": 0,
        "method": "Wifi.GetStatus",
        "params": {
            "id": 0
        }
    }
    
    devices_found = []
    
    try:
        message = json.dumps(wifi_cmd).encode('utf-8')
        broadcast_addr = ('255.255.255.255', port)
        sock.sendto(message, broadcast_addr)
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                data, addr = sock.recvfrom(4096)
                response_text = data.decode('utf-8')
                
                try:
                    response_json = json.loads(response_text)
                    devices_found.append({
                        'ip': addr[0],
                        'port': port,
                        'response': response_json
                    })
                except json.JSONDecodeError:
                    devices_found.append({
                        'ip': addr[0],
                        'port': port,
                        'raw_data': response_text
                    })
            except socket.timeout:
                continue
            except Exception:
                break
    except Exception:
        pass
    finally:
        sock.close()
    
    return devices_found

def main():
    print("=" * 60)
    print("🌐 Marstek UDP WiFi Status Test")
    print("=" * 60)
    
    if len(sys.argv) == 1:
        # Default: scan common ports
        print("🔍 Scanning common Marstek ports...")
        common_ports = [30000, 8080, 8888, 12345, 50000, 51000, 52000]
        
        all_devices = []
        for port in common_ports:
            print(f"\n📡 Testing port {port}...")
            devices = discover_devices(port, timeout=1)
            all_devices.extend(devices)
            if devices:
                print(f"🛑 Stopping scan - device found on port {port}")
                break
        
        print(f"\n📊 Summary: Found {len(all_devices)} total device(s)")
        
    elif len(sys.argv) == 2:
        # Single port
        try:
            port = int(sys.argv[1])
            discover_devices(port)
        except ValueError:
            print("❌ Invalid port number")
            
    elif len(sys.argv) == 3:
        # Port range
        try:
            start_port = int(sys.argv[1])
            end_port = int(sys.argv[2])
            all_devices = scan_port_range(start_port, end_port)
            
            if all_devices:
                print(f"\n🎯 Summary - Found devices on:")
                for device in all_devices:
                    print(f"   • {device['ip']}:{device['port']}")
                    if 'response' in device and 'result' in device['response']:
                        result = device['response']['result']
                        if 'ssid' in result:
                            print(f"     WiFi SSID: {result['ssid']}")
                        if 'ip' in result:
                            print(f"     Device IP: {result['ip']}")
        except ValueError:
            print("❌ Invalid port range")
    else:
        print("Usage:")
        print("  python test-udp-wifi-status.py                  # Test common ports")
        print("  python test-udp-wifi-status.py 30000            # Test single port")
        print("  python test-udp-wifi-status.py 30000 30010      # Test port range")
        print("\nAll scans use 1 second timeout and stop on first device found.")

if __name__ == "__main__":
    main()