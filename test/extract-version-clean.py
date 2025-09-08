#!/usr/bin/env python3
"""
Clean version extractor for Marstek Venus firmware.
Extracts SOFT_VERSION, build date/time, and checksum.
NO HARDCODED VALUES.
"""

import sys
import struct
import re
from pathlib import Path

def decode_thumb2_movt_movw(data, offset):
    """
    Decode Thumb-2 32-bit MOV instructions.
    Returns (register, immediate, instruction_type)
    """
    if offset + 3 >= len(data):
        return None, None, None
    
    # Read as two 16-bit little-endian halfwords
    word1 = struct.unpack('<H', data[offset:offset+2])[0]
    word2 = struct.unpack('<H', data[offset+2:offset+4])[0]
    
    # Check for MOV.W immediate (T2 encoding) first - it's more specific
    # 11110 i 00010 S 1111 | 0 imm3 Rd imm8
    if (word1 & 0xFBEF) == 0xF04F:
        i = (word1 >> 10) & 1
        s = (word1 >> 4) & 1
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        # ThumbExpandImm(i:imm3:imm8)
        imm12 = (i << 11) | (imm3 << 8) | imm8
        
        # Decode modified immediate
        if (imm12 & 0xC00) == 0:
            # Simple cases
            if (imm12 & 0x300) == 0x000:
                immediate = imm8
            elif (imm12 & 0x300) == 0x100:
                immediate = (imm8 << 16) | imm8
            elif (imm12 & 0x300) == 0x200:
                immediate = (imm8 << 24) | (imm8 << 8)
            else:  # 0x300
                immediate = (imm8 << 24) | (imm8 << 16) | (imm8 << 8) | imm8
        else:
            # Rotated form: rotate (1 bcdefgh) right by 2*rotation
            unrotated_value = 0x80 | (imm8 & 0x7F)  # 1bcdefgh
            rotation = (imm12 >> 7) & 0x1F  # 5-bit rotation amount
            
            # Rotate right by rotation bits
            immediate = (unrotated_value >> rotation) | ((unrotated_value << (32 - rotation)) & 0xFFFFFFFF)
            immediate &= 0xFFFFFFFF
        
        return rd, immediate, 'MOV.W'
    
    # Check for MOVW (T3 encoding)
    # 11110 i 10 0100 imm4 | 0 imm3 Rd imm8
    if (word1 & 0xFB50) == 0xF040:
        i = (word1 >> 10) & 1
        imm4 = word1 & 0xF
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        # Correct immediate assembly
        immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        return rd, immediate, 'MOVW'
    
    return None, None, None

def extract_datetime_near_version(data, version_offset):
    """
    Extract date and time strings near version strings.
    Pattern: after version strings, there's typically:
    - 0x0D 0x0A (newline)
    - " time:" string
    - some padding bytes
    - Date string (e.g., "Mar  6 2025")
    - Time string (e.g., "17:43:31")
    """
    
    # Search forward from version string for date/time pattern
    search_start = version_offset
    search_end = min(version_offset + 200, len(data))
    
    # Look for " time:" string first
    time_marker = b' time:'
    time_pos = data.find(time_marker, search_start, search_end)
    
    if time_pos == -1:
        return None, None
    
    # Date typically follows a few bytes after " time:"
    # Look for month names
    months = [b'Jan', b'Feb', b'Mar', b'Apr', b'May', b'Jun', 
              b'Jul', b'Aug', b'Sep', b'Oct', b'Nov', b'Dec']
    
    date_str = None
    time_str = None
    
    for month in months:
        month_pos = data.find(month, time_pos, time_pos + 50)
        if month_pos != -1:
            # Extract date string (typically 11 chars: "Mar  6 2025")
            date_end = month_pos
            while date_end < len(data) and date_end < month_pos + 20:
                if data[date_end] == 0:
                    break
                date_end += 1
            
            date_bytes = data[month_pos:date_end]
            try:
                date_str = date_bytes.decode('ascii')
            except:
                pass
            
            # Look for time string after date (format: HH:MM:SS)
            time_pattern = re.compile(rb'\d{1,2}:\d{2}:\d{2}')
            time_search = data[date_end:date_end + 20]
            time_match = time_pattern.search(time_search)
            
            if time_match:
                time_str = time_match.group().decode('ascii')
            
            break
    
    return date_str, time_str

def find_version_patterns(data):
    """Find version patterns using proper ARM decoding."""
    
    # Find SOFT_VERSION string
    soft_version_pos = data.find(b'SOFT_VERSION')
    
    if soft_version_pos == -1:
        return None, None, None
    
    # Search backwards from SOFT_VERSION for ARM instruction patterns
    search_start = max(0, soft_version_pos - 0x1000)
    search_end = soft_version_pos
    
    version = None
    
    # Pattern 1: PUSH {R4,LR} + MOV.W/MOVW R1 + ADR R0
    for offset in range(search_start, search_end - 8):
        if data[offset:offset+2] == b'\x10\xB5':  # PUSH {R4,LR}
            rd, immediate, mov_type = decode_thumb2_movt_movw(data, offset + 2)
            
            if rd == 1 and immediate is not None:  # R1
                if offset + 7 < len(data) and data[offset + 7] == 0xA0:
                    adr_reg = (data[offset + 7] >> 0) & 0x7
                    
                    if adr_reg == 0:  # R0
                        adr_imm = data[offset + 6] & 0xFF
                        adr_pc = ((offset + 6 + 4) & ~3)
                        
                        for base in [0x08000000, 0x08020000, 0]:
                            runtime_pc = base + adr_pc
                            target = runtime_pc + (adr_imm * 4)
                            file_offset = target - base
                            
                            if abs(file_offset - soft_version_pos) < 50:
                                version = immediate
                                break
                        
                        if version:
                            break
    
    # Pattern 2: Just MOV.W/MOVW R1 + ADR R0 (no PUSH)
    if not version:
        for offset in range(search_start, search_end - 6):
            rd, immediate, mov_type = decode_thumb2_movt_movw(data, offset)
            
            if rd == 1 and immediate is not None:
                if offset + 5 < len(data) and data[offset + 5] == 0xA0:
                    adr_reg = (data[offset + 5] >> 0) & 0x7
                    
                    if adr_reg == 0:
                        adr_imm = data[offset + 4] & 0xFF
                        adr_pc = ((offset + 4 + 4) & ~3)
                        
                        for base in [0x08000000, 0x08020000, 0]:
                            runtime_pc = base + adr_pc
                            target = runtime_pc + (adr_imm * 4)
                            file_offset = target - base
                            
                            if abs(file_offset - soft_version_pos) < 50:
                                version = immediate
                                break
                        
                        if version:
                            break
    
    # Pattern 3: MOVS R1 + ADR R0 (8-bit immediate)
    if not version:
        for offset in range(search_start, search_end - 4):
            if offset + 1 < len(data) and data[offset + 1] == 0x21:
                immediate = data[offset]
                
                if data[offset + 3] == 0xA0:
                    adr_imm = data[offset + 2]
                    adr_pc = ((offset + 2 + 4) & ~3)
                    
                    for base in [0x08000000, 0x08020000, 0]:
                        runtime_pc = base + adr_pc
                        target = runtime_pc + (adr_imm * 4)
                        file_offset = target - base
                        
                        if abs(file_offset - soft_version_pos) < 50:
                            version = immediate
                            break
                    
                    if version:
                        break
    
    # Extract date/time near the version string
    date_str, time_str = extract_datetime_near_version(data, soft_version_pos)
    
    return version, date_str, time_str

def analyze_firmware(filepath):
    """Analyze firmware file."""
    path = Path(filepath)
    
    if not path.exists():
        print(f"Error: File '{filepath}' not found")
        return
    
    print(f"Analyzing: {path.name}")
    print(f"Size: {path.stat().st_size:,} bytes")
    print("=" * 60)
    
    with open(path, 'rb') as f:
        data = f.read()
    
    # Check firmware type
    venusc_pos = data.find(b'VenusC')
    if venusc_pos != -1:
        print("Firmware Type: EMS/Control")
    else:
        print("Firmware Type: BMS")
    
    # Find version and build info
    version, date_str, time_str = find_version_patterns(data)
    
    if version:
        print(f"SOFT_VERSION: {version}")
        
        if date_str:
            print(f"Build Date: {date_str}")
        if time_str:
            print(f"Build Time: {time_str}")
    else:
        print("SOFT_VERSION: Not found")
    
    # Calculate checksum
    sum_val = sum(data) & 0xFFFFFFFF
    checksum = (~sum_val) & 0xFFFFFFFF
    print(f"Checksum: 0x{checksum:08X}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract-version-clean.py <firmware.bin>")
        print("\nExtracts SOFT_VERSION and checksum from Marstek Venus firmware.")
        sys.exit(1)
    
    analyze_firmware(sys.argv[1])

if __name__ == "__main__":
    main()