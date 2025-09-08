#!/usr/bin/env python3
"""
Extract version information from Marstek Venus firmware binaries.

This script searches for version patterns in ARM Thumb firmware binaries,
looking for:
1. SOFT_VERSION string followed by MOVS instruction with version byte
2. Build date strings
3. Version number patterns in ARM instructions
"""

import sys
import struct
import re
from pathlib import Path

def find_soft_version(data):
    """
    Find SOFT_VERSION string and nearby MOVS R1, #imm8 instruction.
    ARM Thumb MOVS R1, #imm8 is encoded as: 0x21 followed by immediate value
    """
    versions = []
    
    # Search for SOFT_VERSION string (case insensitive)
    patterns = [b'SOFT_VERSION', b'Soft_Version', b'soft_version', b'SoftVersion']
    
    for pattern in patterns:
        offset = 0
        while True:
            pos = data.find(pattern, offset)
            if pos == -1:
                break
                
            print(f"Found '{pattern.decode()}' at offset 0x{pos:08X}")
            
            # Look for MOVS R1, #imm8 instruction nearby (before and after the string)
            # Search within 200 bytes before and after the string
            search_start = max(0, pos - 200)
            search_end = min(len(data), pos + 200)
            search_region = data[search_start:search_end]
            
            # MOVS R1, #imm8 is 0x21 followed by immediate byte
            for i in range(len(search_region) - 1):
                if search_region[i] == 0x21:
                    version_byte = search_region[i + 1]
                    if 1 <= version_byte <= 255:  # Reasonable version range
                        abs_offset = search_start + i
                        versions.append({
                            'type': 'SOFT_VERSION MOVS R1',
                            'value': version_byte,
                            'decimal': version_byte,
                            'hex': f'0x{version_byte:02X}',
                            'offset': abs_offset,
                            'string_offset': pos
                        })
                        print(f"  -> Found MOVS R1, #{version_byte} (0x{version_byte:02X}) at offset 0x{abs_offset:08X}")
                        
            offset = pos + 1
    
    # Also look for standalone MOVS R1, #0x99 pattern (153 decimal)
    target_version = 0x99
    for i in range(len(data) - 1):
        if data[i] == 0x21 and data[i + 1] == target_version:
            versions.append({
                'type': 'MOVS R1, #0x99',
                'value': target_version,
                'decimal': target_version,
                'hex': f'0x{target_version:02X}',
                'offset': i
            })
            print(f"Found exact pattern MOVS R1, #0x99 at offset 0x{i:08X}")
    
    return versions

def find_version_patterns(data):
    """
    Find other version-like patterns in the binary.
    Look for MOVS instructions with typical version numbers.
    """
    versions = []
    
    # MOVS R0-R7, #imm8 instructions (0x20-0x27 followed by immediate)
    for i in range(len(data) - 1):
        if 0x20 <= data[i] <= 0x27:
            imm = data[i + 1]
            # Look for reasonable version numbers (1-255, but typically < 999)
            if 1 <= imm <= 255:
                # Check if this looks like a version context
                # Look for nearby version-related strings
                context_start = max(0, i - 50)
                context_end = min(len(data), i + 50)
                context = data[context_start:context_end]
                
                # Check for version-related keywords nearby
                if (b'VERSION' in context or 
                    b'version' in context or 
                    b'Version' in context or
                    b'VER' in context):
                    
                    reg = data[i] - 0x20
                    versions.append({
                        'type': f'MOVS R{reg}',
                        'value': imm,
                        'decimal': imm,
                        'hex': f'0x{imm:02X}',
                        'offset': i
                    })
    
    return versions

def find_build_dates(data):
    """
    Find build date strings in the firmware.
    """
    dates = []
    
    # Common date patterns
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    for month in months:
        pattern = month.encode('ascii')
        offset = 0
        
        while True:
            pos = data.find(pattern, offset)
            if pos == -1:
                break
                
            # Try to extract full date string
            # Look for pattern like "May 30 2025" or "30 May 2025"
            try:
                # Get surrounding context
                start = max(0, pos - 10)
                end = min(len(data), pos + 20)
                context = data[start:end]
                
                # Try to extract as string
                date_str = ''
                for byte in context:
                    if 32 <= byte <= 126:  # Printable ASCII
                        date_str += chr(byte)
                    else:
                        date_str += ' '
                
                # Clean up and look for date pattern
                date_str = ' '.join(date_str.split())
                
                # Match various date formats
                date_patterns = [
                    r'(\w{3})\s+(\d{1,2})\s+(\d{4})',  # May 30 2025
                    r'(\d{1,2})\s+(\w{3})\s+(\d{4})',  # 30 May 2025
                    r'(\d{4})-(\d{2})-(\d{2})',        # 2025-05-30
                    r'(\d{2})/(\d{2})/(\d{4})',        # 05/30/2025
                ]
                
                for pattern in date_patterns:
                    match = re.search(pattern, date_str)
                    if match:
                        dates.append({
                            'date': match.group(0),
                            'offset': pos
                        })
                        break
                        
            except:
                pass
                
            offset = pos + 1
    
    # Also look for __DATE__ macro expansions (compiler date strings)
    date_macro_pattern = b'__DATE__'
    pos = data.find(date_macro_pattern)
    if pos != -1:
        dates.append({
            'date': '__DATE__ macro found',
            'offset': pos
        })
    
    return dates

def find_version_strings(data):
    """
    Find version strings in various formats.
    """
    version_strings = []
    
    # Look for common version string patterns
    patterns = [
        rb'[Vv]ersion[:\s]+(\d+\.?\d*\.?\d*)',
        rb'[Vv]er[:\s]+(\d+\.?\d*\.?\d*)',
        rb'V(\d+\.?\d*\.?\d*)',
        rb'v(\d+\.?\d*\.?\d*)',
        rb'(\d+\.\d+\.\d+)',  # x.y.z format
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, data):
            try:
                version_str = match.group(1).decode('ascii')
                version_strings.append({
                    'version': version_str,
                    'offset': match.start()
                })
            except:
                pass
    
    return version_strings

def hex_dump(data, offset, length=32):
    """
    Create a hex dump of data at given offset.
    """
    end = min(len(data), offset + length)
    lines = []
    
    for i in range(offset, end, 16):
        hex_part = []
        ascii_part = []
        
        for j in range(16):
            if i + j < end:
                byte = data[i + j]
                hex_part.append(f"{byte:02X}")
                if 32 <= byte <= 126:
                    ascii_part.append(chr(byte))
                else:
                    ascii_part.append('.')
            else:
                hex_part.append('  ')
                ascii_part.append(' ')
        
        hex_str = ' '.join(hex_part[:8]) + '  ' + ' '.join(hex_part[8:])
        ascii_str = ''.join(ascii_part)
        lines.append(f"{i:08X}: {hex_str} |{ascii_str}|")
    
    return '\n'.join(lines)

def find_all_strings(data, min_length=4):
    """
    Find all ASCII strings in the binary.
    """
    strings = []
    current_string = ""
    start_offset = 0
    
    for i, byte in enumerate(data):
        if 32 <= byte <= 126:  # Printable ASCII
            if not current_string:
                start_offset = i
            current_string += chr(byte)
        else:
            if len(current_string) >= min_length:
                strings.append({
                    'string': current_string,
                    'offset': start_offset,
                    'length': len(current_string)
                })
            current_string = ""
    
    # Handle string at end of file
    if len(current_string) >= min_length:
        strings.append({
            'string': current_string,
            'offset': start_offset,
            'length': len(current_string)
        })
    
    return strings

def analyze_firmware(filepath):
    """
    Analyze a firmware binary file for version information.
    """
    path = Path(filepath)
    
    if not path.exists():
        print(f"Error: File '{filepath}' not found")
        return
    
    print(f"Analyzing firmware: {path.name}")
    print(f"File size: {path.stat().st_size:,} bytes")
    print("=" * 60)
    
    with open(path, 'rb') as f:
        data = f.read()
    
    # Check for VenusC signature to determine firmware type
    venusc_offset = 0x50004
    firmware_type = "Unknown"
    if len(data) > venusc_offset + 6:
        if data[venusc_offset:venusc_offset + 6] == b'VenusC':
            firmware_type = "EMS/Control"
        else:
            firmware_type = "BMS"
    
    print(f"Firmware Type: {firmware_type}")
    print()
    
    # Find all strings containing "version" or "soft"
    print("All strings containing 'version' or 'soft':")
    all_strings = find_all_strings(data, min_length=4)
    version_related = [s for s in all_strings if 
                      'version' in s['string'].lower() or 
                      'soft' in s['string'].lower() or
                      'ver' in s['string'].lower()]
    
    if version_related:
        for s in version_related:
            print(f"  - '{s['string']}' at offset 0x{s['offset']:08X}")
    else:
        print("  - None found")
    print()
    
    # Search for specific offset mentioned in disassembly (0x802A408)
    # Convert to file offset by subtracting base address
    disasm_addr = 0x802A408
    possible_offsets = [
        disasm_addr - 0x8000000,  # Common ARM base
        disasm_addr - 0x8020000,  # Another common base
        disasm_addr,              # Direct offset
        disasm_addr & 0xFFFFFF,   # Lower 24 bits
    ]
    
    print("Checking disassembly address patterns:")
    for offset in possible_offsets:
        if 0 <= offset < len(data) - 32:
            print(f"Offset 0x{offset:08X} (from addr 0x{disasm_addr:08X}):")
            print(hex_dump(data, offset, 64))
            print()
    
    # Look for all MOVS R1, #imm8 patterns (0x21 XX)
    print("All MOVS R1, #imm8 patterns:")
    movs_r1_patterns = []
    for i in range(len(data) - 1):
        if data[i] == 0x21:
            imm = data[i + 1]
            movs_r1_patterns.append({
                'value': imm,
                'offset': i
            })
    
    # Group by value and show most common
    from collections import Counter
    value_counts = Counter(p['value'] for p in movs_r1_patterns)
    
    print(f"Found {len(movs_r1_patterns)} MOVS R1 instructions:")
    for value, count in value_counts.most_common(10):
        offsets = [p['offset'] for p in movs_r1_patterns if p['value'] == value]
        offset_str = ", ".join(f"0x{off:08X}" for off in offsets[:3])
        if len(offsets) > 3:
            offset_str += f" (+{len(offsets)-3} more)"
        print(f"  - Value {value} (0x{value:02X}): {count} times at {offset_str}")
    print()
    
    # Find SOFT_VERSION
    print("SOFT_VERSION patterns:")
    soft_versions = find_soft_version(data)
    if soft_versions:
        for v in soft_versions:
            print(f"  - Version {v['decimal']} ({v['hex']}) at offset 0x{v['offset']:08X}")
    else:
        print("  - Not found")
    print()
    
    # Find version patterns in MOVS instructions
    print("Version patterns in ARM instructions:")
    version_patterns = find_version_patterns(data)
    if version_patterns:
        # Deduplicate and show unique values
        seen = set()
        for v in version_patterns:
            if v['value'] not in seen:
                seen.add(v['value'])
                print(f"  - {v['type']} with value {v['decimal']} ({v['hex']}) at offset 0x{v['offset']:08X}")
    else:
        print("  - Not found")
    print()
    
    # Find version strings
    print("Version strings:")
    version_strings = find_version_strings(data)
    if version_strings:
        # Deduplicate
        seen = set()
        for v in version_strings:
            if v['version'] not in seen:
                seen.add(v['version'])
                print(f"  - Version '{v['version']}' at offset 0x{v['offset']:08X}")
    else:
        print("  - Not found")
    print()
    
    # Find build dates
    print("Build dates:")
    dates = find_build_dates(data)
    if dates:
        # Deduplicate
        seen = set()
        for d in dates:
            if d['date'] not in seen:
                seen.add(d['date'])
                print(f"  - '{d['date']}' at offset 0x{d['offset']:08X}")
    else:
        print("  - Not found")
    print()
    
    # Calculate firmware checksum (ones' complement)
    sum_val = sum(data) & 0xFFFFFFFF
    checksum = (~sum_val) & 0xFFFFFFFF
    print(f"Firmware Checksum:")
    print(f"  - Sum: 0x{sum_val:08X}")
    print(f"  - Ones' complement: 0x{checksum:08X}")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    if soft_versions:
        print(f"  Most likely version: {soft_versions[0]['decimal']}")
    elif version_patterns:
        # Find most common version number
        from collections import Counter
        version_counts = Counter(v['value'] for v in version_patterns)
        most_common = version_counts.most_common(1)[0]
        print(f"  Most likely version: {most_common[0]} (found {most_common[1]} times)")
    elif version_strings:
        print(f"  Version string: {version_strings[0]['version']}")
    else:
        print("  Version not identified")

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract-version.py <firmware.bin>")
        print("\nExtracts version information from Marstek Venus firmware binaries.")
        sys.exit(1)
    
    analyze_firmware(sys.argv[1])

if __name__ == "__main__":
    main()