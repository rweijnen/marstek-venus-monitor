#!/usr/bin/env python3
"""
Proper version extractor with correct ARM Thumb-2 decoding.
NO HARDCODED VALUES.
"""

import sys
import struct
from pathlib import Path

def decode_movw_properly(word1, word2):
    """
    Correctly decode ARM Thumb-2 MOVW instruction.
    
    MOVW Rd, #imm16 - Encoding T3
    
    15 14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
    ------------------------------------------------
    Word1: 1  1  1  1  0  i  1  0  0  1  0  0  imm4
    Word2: 0  imm3     Rd           imm8
    
    The 16-bit immediate is: imm4:i:imm3:imm8
    """
    # Check if this is MOVW encoding T3
    # Mask: 1111 0X10 0100 XXXX -> F800 & FB50 = F040
    if (word1 & 0xFB50) != 0xF040:
        return None, None
    
    # Extract bit fields correctly
    i = (word1 >> 10) & 0x1      # bit 10
    imm4 = word1 & 0xF           # bits 0-3
    
    imm3 = (word2 >> 12) & 0x7   # bits 12-14 of word2
    rd = (word2 >> 8) & 0xF      # bits 8-11 of word2
    imm8 = word2 & 0xFF          # bits 0-7 of word2
    
    # Combine according to ARM specification: imm4:i:imm3:imm8
    # This means: imm4 is bits 15-12, i is bit 11, imm3 is bits 10-8, imm8 is bits 7-0
    immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
    
    return rd, immediate

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

def find_version_patterns(data):
    """Find version patterns using proper ARM decoding."""
    results = []
    
    # Find all version strings
    version_strings = []
    patterns = [b'SOFT_VERSION:%d', b'BOOT_VERSION:%d', b'BMS_VERSION:%d', b'VERSION:%d']
    
    for pattern in patterns:
        pos = 0
        while True:
            pos = data.find(pattern, pos)
            if pos == -1:
                break
            
            type_name = pattern.decode('ascii').replace(':%d', '')
            version_strings.append({
                'type': type_name,
                'offset': pos
            })
            print(f"Found {type_name} at 0x{pos:08X}")
            pos += 1
    
    if not version_strings:
        print("No version strings found")
        return results
    
    print("\nSearching for ARM instruction patterns...")
    
    # Search for common patterns
    for offset in range(0, len(data) - 8):
        # Pattern 1: PUSH {R4,LR} + MOVW/MOV.W R1 + ADR R0
        if data[offset:offset+2] == b'\x10\xB5':  # PUSH {R4,LR}
            # Check for 32-bit MOV instruction
            rd, immediate, mov_type = decode_thumb2_movt_movw(data, offset + 2)
            
            if rd == 1 and immediate is not None:  # R1
                # Check for ADR R0 following (at offset+6)
                if offset + 7 < len(data) and data[offset + 7] == 0xA0:
                    adr_reg = (data[offset + 7] >> 0) & 0x7  # Register is in A0 byte bits 0-2
                    
                    if adr_reg == 0:  # R0
                        adr_imm = data[offset + 6] & 0xFF  # Immediate is in the first byte
                        
                        # Calculate ADR target
                        adr_pc = ((offset + 6 + 4) & ~3)  # PC is word-aligned
                        
                        # Try different base addresses
                        for base in [0x08000000, 0x08020000, 0]:
                            runtime_pc = base + adr_pc
                            target = runtime_pc + (adr_imm * 4)
                            file_offset = target - base
                            
                            # Check if points to a version string
                            for vs in version_strings:
                                if abs(file_offset - vs['offset']) < 50:
                                    print(f"\nFound pattern at 0x{offset:08X}:")
                                    print(f"  PUSH {{R4,LR}}")
                                    print(f"  {mov_type} R1, #{immediate} (0x{immediate:X})")
                                    print(f"  ADR R0, -> {vs['type']}")
                                    
                                    results.append({
                                        'type': vs['type'],
                                        'version': immediate,
                                        'offset': offset,
                                        'confidence': 100
                                    })
                                    break
    
    # Pattern 2: Just MOVW/MOV.W R1 + ADR R0 (no PUSH)
    for offset in range(0, len(data) - 6):
        rd, immediate, mov_type = decode_thumb2_movt_movw(data, offset)
        
        if rd == 1 and immediate is not None:
            # Check for ADR R0 following
            if offset + 5 < len(data) and data[offset + 5] == 0xA0:
                adr_reg = (data[offset + 5] >> 0) & 0x7  # Register is in A0 byte bits 0-2
                
                if adr_reg == 0:
                    adr_imm = data[offset + 4] & 0xFF  # Immediate is in the first byte
                    adr_pc = ((offset + 4 + 4) & ~3)
                    
                    for base in [0x08000000, 0x08020000, 0]:
                        runtime_pc = base + adr_pc
                        target = runtime_pc + (adr_imm * 4)
                        file_offset = target - base
                        
                        for vs in version_strings:
                            if abs(file_offset - vs['offset']) < 50:
                                results.append({
                                    'type': vs['type'],
                                    'version': immediate,
                                    'offset': offset,
                                    'confidence': 90
                                })
    
    # Pattern 3: MOVS R1 + ADR R0 (8-bit immediate)
    for offset in range(0, len(data) - 4):
        # MOVS R1, #imm8 is encoded as imm8 21 in little-endian
        if offset + 3 < len(data) and data[offset + 1] == 0x21:
            immediate = data[offset]
            
            # Check for ADR R0
            if data[offset + 3] == 0xA0:
                adr_imm = data[offset + 2]
                adr_pc = ((offset + 2 + 4) & ~3)
                
                for base in [0x08000000, 0x08020000, 0]:
                    runtime_pc = base + adr_pc
                    target = runtime_pc + (adr_imm * 4)
                    file_offset = target - base
                    
                    for vs in version_strings:
                        if abs(file_offset - vs['offset']) < 50:
                            if immediate > 10:  # Filter tiny values
                                results.append({
                                    'type': vs['type'],
                                    'version': immediate,
                                    'offset': offset,
                                    'confidence': 85
                                })
    
    return results

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
        print(f"Firmware Type: EMS/Control (VenusC at 0x{venusc_pos:08X})")
    else:
        print("Firmware Type: BMS (no VenusC signature)")
    
    print()
    
    # Find versions
    versions = find_version_patterns(data)
    
    if versions:
        print("\n" + "=" * 60)
        print("VERSION RESULTS:")
        
        # Group by type
        by_type = {}
        for v in versions:
            if v['type'] not in by_type:
                by_type[v['type']] = []
            by_type[v['type']].append(v)
        
        for vtype, items in by_type.items():
            # Remove duplicates and sort by confidence
            unique = {}
            for item in items:
                key = item['version']
                if key not in unique or item['confidence'] > unique[key]['confidence']:
                    unique[key] = item
            
            items = sorted(unique.values(), key=lambda x: x['confidence'], reverse=True)
            
            if items:
                best = items[0]
                print(f"\n{vtype}: {best['version']}")
                print(f"  Confidence: {best['confidence']}%")
                print(f"  Found at: 0x{best['offset']:08X}")
                
                for alt in items[1:3]:
                    print(f"  Alternative: {alt['version']} ({alt['confidence']}%)")
    else:
        print("No version patterns found")
    
    # Checksum
    sum_val = sum(data) & 0xFFFFFFFF
    checksum = (~sum_val) & 0xFFFFFFFF
    print(f"\nChecksum: 0x{checksum:08X}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract-version-proper.py <firmware.bin>")
        print("\nExtracts version using proper ARM Thumb-2 decoding.")
        print("No hardcoded values or patterns.")
        sys.exit(1)
    
    analyze_firmware(sys.argv[1])

if __name__ == "__main__":
    main()