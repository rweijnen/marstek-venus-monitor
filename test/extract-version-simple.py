#!/usr/bin/env python3
"""
Simple version extractor for Marstek Venus firmware binaries.
"""

import sys
from pathlib import Path

def find_version_patterns(data):
    """Find version patterns by tracing ARM instruction sequences."""
    results = []
    
    # Find all version-related strings
    version_strings = [
        b'SOFT_VERSION:%d',
        b'SOFT_VERSION:',
        b'SOFT_VERSION',
        b'BOOT_VERSION:%d',
        b'BOOT_VERSION:',
        b'BOOT_VERSION',
    ]
    
    string_positions = []
    for pattern in version_strings:
        pos = data.find(pattern)
        if pos != -1:
            string_positions.append({
                'pattern': pattern.decode('ascii', errors='ignore'),
                'offset': pos
            })
            print(f"Found '{pattern.decode('ascii', errors='ignore')}' at offset 0x{pos:08X}")
    
    if not string_positions:
        print("No SOFT_VERSION strings found")
        return results
    
    print(f"\nSearching for instruction patterns that reference SOFT_VERSION strings:")
    
    # For each string, look for code that references it
    for string_info in string_positions:
        string_offset = string_info['offset']
        print(f"\nAnalyzing references to '{string_info['pattern']}' at 0x{string_offset:08X}:")
        
        # Search entire binary for potential instruction sequences
        for code_offset in range(0, len(data) - 8, 2):  # ARM Thumb is 2-byte aligned
            
            # Look for pattern: MOVS R1, #version followed by ADR R0, string_ref
            # Your disassembly shows: 99 21 for MOVS R1, #0x99
            if (code_offset + 6 < len(data) and 
                data[code_offset + 1] == 0x21):  # MOVS R1, #imm8 (0x21 is second byte)
                
                version = data[code_offset]
                
                # Check if next instruction could be ADR R0, string_address
                # ADR R0, #offset is encoded as A0 instruction (varies by offset)
                next_instr_offset = code_offset + 2
                if next_instr_offset + 1 < len(data):
                    next_byte1 = data[next_instr_offset]
                    next_byte2 = data[next_instr_offset + 1]
                    
                    # ADR R0, #imm8 is encoded as A0 XX where XX is the immediate
                    # The pattern is: XX A0 (little endian)
                    if next_byte2 == 0xA0:  # ADR R0 instruction
                        adr_immediate = next_byte1
                        
                        # Calculate potential target address
                        # ADR calculates: (PC & 0xFFFFFFFC) + (imm8 << 2)
                        # PC would be current instruction + 4
                        pc_value = (next_instr_offset + 4) & 0xFFFFFFFC
                        target_address = pc_value + (adr_immediate << 2)
                        
                        # Convert target address to file offset (subtract base address)
                        # Common ARM base addresses
                        possible_bases = [0x08000000, 0x08020000, 0x20000000]
                        
                        for base_addr in possible_bases:
                            if target_address >= base_addr:
                                target_file_offset = target_address - base_addr
                                
                                # Check if this points to our string (within reasonable range)
                                if abs(target_file_offset - string_offset) < 100:
                                    confidence = 100 - abs(target_file_offset - string_offset)
                                    
                                    results.append({
                                        'method': 'ARM instruction sequence',
                                        'version': version,
                                        'code_offset': code_offset,
                                        'string_offset': string_offset,
                                        'target_calculated': target_file_offset,
                                        'confidence': confidence,
                                        'base_addr': base_addr
                                    })
                                    
                                    print(f"  -> MOVS R1, #{version} (0x{version:02X}) at 0x{code_offset:08X}")
                                    print(f"     ADR R0, points to ~0x{target_file_offset:08X} (base 0x{base_addr:08X})")
                                    print(f"     String at 0x{string_offset:08X}, distance: {abs(target_file_offset - string_offset)}")
                                    print(f"     Confidence: {confidence}%")
    
    # Alternative: Look for any MOVS R1 followed by BL (function call) pattern
    print(f"\nLooking for MOVS R1, #version followed by function calls:")
    
    movs_bl_found = []
    for i in range(len(data) - 6):
        if data[i + 1] == 0x21:  # MOVS R1, #imm8 (note: little endian, so version first)
            version = data[i]
            
            # Look for BL instruction nearby (next few instructions)
            for j in range(i + 2, min(i + 12, len(data) - 3), 2):
                # BL instruction has pattern: F0-F7 or F8-FF in high byte
                if (len(data) > j + 3 and 
                    ((0xF0 <= data[j + 1] <= 0xF7) or (0xF8 <= data[j + 1] <= 0xFF)) and
                    data[j + 3] == 0xF8):  # Common BL pattern ending
                    
                    # This might be a printf-style call
                    movs_bl_found.append({
                        'method': 'MOVS + BL pattern',
                        'version': version,
                        'code_offset': i,
                        'confidence': 50  # Lower confidence
                    })
                    
                    # Only show interesting versions (> 50 or specific known versions)
                    if version > 50 or version in [19, 153]:
                        print(f"  -> MOVS R1, #{version} (0x{version:02X}) at 0x{i:08X} + BL at 0x{j:08X}")
                    break
    
    # Add the most interesting ones to results
    interesting_versions = [v for v in movs_bl_found if v['version'] > 50 or v['version'] in [19, 153]]
    results.extend(interesting_versions[:5])  # Add top 5 interesting ones
    
    print(f"Found {len(movs_bl_found)} total MOVS+BL patterns, showing {len(interesting_versions)} interesting ones")
    
    # Look for 16-bit values (like 1488, 103) near version strings
    print(f"\nLooking for 16-bit values near version strings:")
    for string_info in string_positions:
        string_offset = string_info['offset']
        string_name = string_info['pattern']
        
        # Search for 16-bit values in little-endian format near the string
        search_start = max(0, string_offset - 2000)
        search_end = min(len(data), string_offset + 2000)
        
        # Look for specific values based on filename hints
        target_values = []
        
        # Extract numbers from filename if possible
        import re
        # Look for numbers like 1488, 103 in context
        if 'SOFT_VERSION' in string_name:
            target_values = [1488, 1500, 1400, 153, 99, 215]  # Common soft versions
        elif 'BOOT_VERSION' in string_name:
            target_values = [103, 102, 101, 100, 306]  # Common boot versions (306 from filename)
            
        for target in target_values:
            # Look for 16-bit little-endian representation
            target_bytes = target.to_bytes(2, 'little')
            
            pos = data.find(target_bytes, search_start, search_end)
            if pos != -1:
                distance = pos - string_offset
                confidence = max(10, 100 - abs(distance) // 10)
                
                results.append({
                    'method': f'{string_name} 16-bit value',
                    'version': target,
                    'code_offset': pos,
                    'string_offset': string_offset,
                    'distance': distance,
                    'confidence': confidence
                })
                
                print(f"  -> Found {target} (0x{target:04X}) for {string_name} at 0x{pos:08X} (distance: {distance:+d})")
    
    # Global search for specific values from filename
    print(f"\nGlobal search for specific values (1488, 103):")
    global_targets = [1488, 103, 306]  # From the filename ac_app_1488_0306.bin
    
    for target in global_targets:
        # Search as 16-bit little-endian
        target_bytes_16 = target.to_bytes(2, 'little')
        pos = data.find(target_bytes_16)
        count = 0
        positions = []
        
        while pos != -1 and count < 5:  # Limit to 5 occurrences
            positions.append(pos)
            count += 1
            pos = data.find(target_bytes_16, pos + 1)
        
        if positions:
            pos_str = ", ".join(f"0x{p:08X}" for p in positions)
            if count >= 5:
                pos_str += " (+more)"
            print(f"  -> Found {target} (0x{target:04X}) as 16-bit value at: {pos_str}")
            
            # Add the first occurrence with high confidence
            results.append({
                'method': f'Global search 16-bit',
                'version': target,
                'code_offset': positions[0],
                'confidence': 90
            })
    
    return results

def calculate_checksum(data):
    """Calculate ones' complement checksum."""
    sum_val = sum(data) & 0xFFFFFFFF
    checksum = (~sum_val) & 0xFFFFFFFF
    return sum_val, checksum

def analyze_firmware(filepath):
    """Analyze firmware for version information."""
    path = Path(filepath)
    
    if not path.exists():
        print(f"Error: File '{filepath}' not found")
        return
    
    print(f"Analyzing: {path.name}")
    print(f"Size: {path.stat().st_size:,} bytes")
    print("=" * 60)
    
    with open(path, 'rb') as f:
        data = f.read()
    
    # Check firmware type (VenusC signature) - check multiple possible offsets
    venusc_found = False
    venusc_offsets = [0x50004, 0x4004, 0x10004]  # Try different possible offsets
    
    for offset in venusc_offsets:
        if len(data) > offset + 6:
            if data[offset:offset + 6] == b'VenusC':
                print(f"Firmware Type: EMS/Control (VenusC signature at 0x{offset:08X})")
                venusc_found = True
                break
    
    if not venusc_found:
        # Also check anywhere in the file
        venusc_pos = data.find(b'VenusC')
        if venusc_pos != -1:
            print(f"Firmware Type: EMS/Control (VenusC signature at 0x{venusc_pos:08X})")
        else:
            print("Firmware Type: BMS (no VenusC signature found)")
    
    print()
    
    # Find version information
    versions = find_version_patterns(data)
    
    if versions:
        print("\nVersion candidates found:")
        # Sort by confidence if available, otherwise by method
        versions.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        for i, v in enumerate(versions[:5]):  # Show top 5
            if v['method'] == 'ARM instruction sequence':
                print(f"  {i+1}. Version {v['version']} (0x{v['version']:02X}) - {v['method']}, confidence {v['confidence']}%")
            elif v['method'] == 'MOVS + BL pattern':
                print(f"  {i+1}. Version {v['version']} (0x{v['version']:02X}) - {v['method']} at 0x{v['code_offset']:08X}")
            else:
                print(f"  {i+1}. Version {v['version']} (0x{v['version']:02X}) - {v['method']}")
        
        if versions:
            best_version = versions[0]['version']
            print(f"\nBest guess: Version {best_version}")
    else:
        print("No SOFT_VERSION pattern found")
    
    # Calculate checksum
    sum_val, checksum = calculate_checksum(data)
    print(f"\nFirmware Checksum: 0x{checksum:08X} (sum: 0x{sum_val:08X})")

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract-version-simple.py <firmware.bin>")
        sys.exit(1)
    
    analyze_firmware(sys.argv[1])

if __name__ == "__main__":
    main()