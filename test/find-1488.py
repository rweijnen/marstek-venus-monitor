#!/usr/bin/env python3
"""
Simple search for the value 1488 (0x5D0) in the firmware.
"""

import struct

def find_value_1488(filepath):
    """Find all occurrences of 1488 in different encodings."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Searching for 1488 (0x5D0) in {filepath}")
    print(f"File size: {len(data):,} bytes")
    
    # Find SOFT_VERSION string first
    soft_pos = data.find(b'SOFT_VERSION:%d')
    print(f"SOFT_VERSION string at: 0x{soft_pos:08X}")
    
    target = 1488  # 0x5D0
    
    # Search as 16-bit little-endian
    target_16le = struct.pack('<H', target)  # 0xD0 0x05
    print(f"\n16-bit little-endian search (0x{target_16le.hex()}):")
    
    pos = 0
    count = 0
    while True:
        pos = data.find(target_16le, pos)
        if pos == -1:
            break
        
        distance = pos - soft_pos if soft_pos != -1 else 0
        print(f"  Found at 0x{pos:08X} (distance from SOFT_VERSION: {distance:+d})")
        
        # Show context around this position
        start = max(0, pos - 8)
        end = min(len(data), pos + 16)
        context = data[start:end]
        hex_str = ' '.join(f'{b:02X}' for b in context)
        print(f"    Context: {hex_str}")
        
        # Check if this could be part of a MOV.W instruction
        # MOV.W R1, #imm16 has pattern F240 XXXX where XXXX encodes the immediate
        if pos >= 2:
            prev_word = struct.unpack('<H', data[pos-2:pos])[0]
            if (prev_word & 0xFBF0) == 0xF240:  # Could be MOV.W
                print(f"    *** Possible MOV.W instruction at 0x{pos-2:08X} ***")
        
        count += 1
        pos += 1
        
        if count >= 10:  # Limit output
            break
    
    print(f"Total 16-bit LE occurrences: {count}")
    
    # Search as 32-bit little-endian
    target_32le = struct.pack('<I', target)  # 0xD0 0x05 0x00 0x00
    print(f"\n32-bit little-endian search (0x{target_32le.hex()}):")
    
    pos = 0
    count = 0
    while True:
        pos = data.find(target_32le, pos)
        if pos == -1:
            break
        
        distance = pos - soft_pos if soft_pos != -1 else 0
        print(f"  Found at 0x{pos:08X} (distance from SOFT_VERSION: {distance:+d})")
        count += 1
        pos += 1
        
        if count >= 5:
            break
    
    print(f"Total 32-bit LE occurrences: {count}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python find-1488.py <firmware.bin>")
        sys.exit(1)
    
    find_value_1488(sys.argv[1])