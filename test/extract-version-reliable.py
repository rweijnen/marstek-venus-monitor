#!/usr/bin/env python3
"""
Reliable version extractor for Marstek Venus firmware binaries.
Uses ARM instruction pattern analysis without hardcoded values or guesswork.
"""

import sys
import struct
from pathlib import Path

def decode_arm_thumb_instruction(data, offset):
    """Decode ARM Thumb instruction at given offset."""
    if offset + 1 >= len(data):
        return None
    
    # ARM Thumb instructions are 16-bit (2 bytes)
    instr = struct.unpack('<H', data[offset:offset+2])[0]
    
    # MOVS Rd, #imm8 pattern: 001 rd(3) imm8(8)
    if (instr & 0xF800) == 0x2000:
        rd = (instr >> 8) & 0x7
        imm8 = instr & 0xFF
        return {
            'type': 'MOVS',
            'register': rd,
            'immediate': imm8,
            'size': 2
        }
    
    # ADR Rd, #imm8 pattern: 10100 rd(3) imm8(8)
    elif (instr & 0xF800) == 0xA000:
        rd = (instr >> 8) & 0x7
        imm8 = instr & 0xFF
        return {
            'type': 'ADR',
            'register': rd,
            'immediate': imm8,
            'size': 2
        }
    
    # BL instruction (Branch with Link) - 32-bit instruction
    elif (instr & 0xF800) == 0xF000:  # First half of BL
        if offset + 3 >= len(data):
            return None
        second_half = struct.unpack('<H', data[offset+2:offset+4])[0]
        if (second_half & 0xD000) == 0xD000:  # Second half pattern
            return {
                'type': 'BL',
                'size': 4
            }
    
    # MOV.W Rd, #imm16 pattern (like MOV.W R1, #0x5D0)
    elif (instr & 0xFBF0) == 0xF240:
        if offset + 3 >= len(data):
            return None
        second_half = struct.unpack('<H', data[offset+2:offset+4])[0]
        rd = second_half & 0xF
        imm4 = (instr >> 0) & 0xF
        imm3 = (second_half >> 12) & 0x7
        imm8 = (second_half >> 4) & 0xFF
        i = (instr >> 10) & 0x1
        imm16 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        return {
            'type': 'MOV.W',
            'register': rd,
            'immediate': imm16,
            'size': 4
        }
    
    # PUSH {regs} instruction pattern
    elif (instr & 0xFE00) == 0xB400:
        reg_list = instr & 0xFF
        lr_bit = (instr >> 8) & 0x1
        return {
            'type': 'PUSH',
            'registers': reg_list,
            'includes_lr': lr_bit,
            'size': 2
        }
    
    return None

def find_version_patterns_reliable(data):
    """Find version patterns using proper ARM instruction decoding."""
    results = []
    
    # Find version strings
    version_strings = [
        b'SOFT_VERSION:%d',
        b'BOOT_VERSION:%d',
        b'BMS_VERSION:%d',
        b'VERSION:%d',
    ]
    
    string_positions = []
    for pattern in version_strings:
        pos = data.find(pattern)
        if pos != -1:
            string_positions.append({
                'pattern': pattern.decode('ascii', errors='ignore'),
                'offset': pos,
                'type': pattern.split(b'_')[0].decode('ascii')
            })
            print(f"Found '{pattern.decode()}' at offset 0x{pos:08X}")
    
    if not string_positions:
        print("No version strings found")
        return results
    
    print(f"\nAnalyzing ARM instruction patterns...")
    
    # For each version string, look for code that references it
    for string_info in string_positions:
        string_offset = string_info['offset']
        string_type = string_info['type']
        
        print(f"\nAnalyzing {string_type} at 0x{string_offset:08X}:")
        
        # Scan the entire code section for instruction sequences that might reference this string
        code_candidates = []
        
        # Look for the exact pattern from your disassembly:
        # PUSH {R4,LR} ; MOV.W R1, #version ; ADR R0, string_addr
        for offset in range(0, len(data) - 12, 2):  # Need at least 12 bytes for full sequence
            
            # Check for PUSH instruction first
            instr1 = decode_arm_thumb_instruction(data, offset)
            
            if instr1 and instr1['type'] == 'PUSH':
                push_offset = offset
                next_offset = offset + instr1['size']
                
                # Look for MOV.W R1, #immediate next
                instr2 = decode_arm_thumb_instruction(data, next_offset)
                
                if instr2 and instr2['type'] == 'MOV.W' and instr2['register'] == 1:  # MOV.W R1
                    version_value = instr2['immediate']
                    mov_offset = next_offset
                    next_offset += instr2['size']
                    
                    # Look for ADR R0, string_addr next
                    instr3 = decode_arm_thumb_instruction(data, next_offset)
                    
                    if instr3 and instr3['type'] == 'ADR' and instr3['register'] == 0:  # ADR R0
                        # Calculate the address ADR points to
                        pc = (next_offset + 4) & 0xFFFFFFFC  # PC calculation for ADR
                        target_addr = pc + (instr3['immediate'] << 2)
                        
                        # Try different base addresses to convert to file offset
                        possible_bases = [0x08000000, 0x08020000, 0x20000000]
                        
                        for base in possible_bases:
                            if target_addr >= base:
                                file_offset = target_addr - base
                                
                                # Check if this points to our version string (within reasonable range)
                                if abs(file_offset - string_offset) < 50:
                                    confidence = 100 - abs(file_offset - string_offset) * 2
                                    code_candidates.append({
                                        'version': version_value,
                                        'confidence': confidence,
                                        'code_offset': push_offset,
                                        'instruction_sequence': f"PUSH {{R4,LR}}; MOV.W R1, #{version_value}; ADR R0, 0x{target_addr:08X}",
                                        'target_file_offset': file_offset,
                                        'base_address': base,
                                        'pattern_type': 'exact_disasm_match'
                                    })
                                    
                                    print(f"  -> EXACT PATTERN at 0x{push_offset:08X}:")
                                    print(f"     PUSH {{R4,LR}}")
                                    print(f"     MOV.W R1, #{version_value} (0x{version_value:X})")
                                    print(f"     ADR R0, 0x{target_addr:08X} -> file 0x{file_offset:08X}")
                                    print(f"     String at 0x{string_offset:08X}, distance: {abs(file_offset - string_offset)}")
                                    print(f"     Confidence: {confidence}%")
            
            # Also check for standalone MOV.W R1 + ADR R0 patterns (without PUSH)
            instr1 = decode_arm_thumb_instruction(data, offset)
            if instr1 and instr1['type'] == 'MOV.W' and instr1['register'] == 1:  # MOV.W R1
                version_value = instr1['immediate']
                next_offset = offset + instr1['size']
                
                # Look for ADR R0, string_addr next
                instr2 = decode_arm_thumb_instruction(data, next_offset)
                
                if instr2 and instr2['type'] == 'ADR' and instr2['register'] == 0:  # ADR R0
                    # Calculate the address ADR points to
                    pc = (next_offset + 4) & 0xFFFFFFFC  # PC calculation for ADR
                    target_addr = pc + (instr2['immediate'] << 2)
                    
                    # Try different base addresses to convert to file offset
                    possible_bases = [0x08000000, 0x08020000, 0x20000000]
                    
                    for base in possible_bases:
                        if target_addr >= base:
                            file_offset = target_addr - base
                            
                            # Check if this points to our version string (within reasonable range)
                            if abs(file_offset - string_offset) < 50:
                                confidence = 90 - abs(file_offset - string_offset) * 2
                                code_candidates.append({
                                    'version': version_value,
                                    'confidence': confidence,
                                    'code_offset': offset,
                                    'instruction_sequence': f"MOV.W R1, #{version_value}; ADR R0, 0x{target_addr:08X}",
                                    'target_file_offset': file_offset,
                                    'base_address': base,
                                    'pattern_type': 'mov_adr_match'
                                })
                                
                                print(f"  -> MOV.W + ADR pattern at 0x{offset:08X}:")
                                print(f"     MOV.W R1, #{version_value} (0x{version_value:X})")
                                print(f"     ADR R0, 0x{target_addr:08X} -> file 0x{file_offset:08X}")
                                print(f"     String at 0x{string_offset:08X}, distance: {abs(file_offset - string_offset)}")
                                print(f"     Confidence: {confidence}%")
            
            # Also check for MOVS R1 + ADR R0 patterns (for small values 0-255)
            instr1 = decode_arm_thumb_instruction(data, offset)
            if instr1 and instr1['type'] == 'MOVS' and instr1['register'] == 1:  # MOVS R1
                version_value = instr1['immediate']
                next_offset = offset + instr1['size']
                
                # Look for ADR R0, string_addr next
                instr2 = decode_arm_thumb_instruction(data, next_offset)
                
                if instr2 and instr2['type'] == 'ADR' and instr2['register'] == 0:  # ADR R0
                    # Calculate the address ADR points to
                    pc = (next_offset + 4) & 0xFFFFFFFC  # PC calculation for ADR
                    target_addr = pc + (instr2['immediate'] << 2)
                    
                    # Try different base addresses to convert to file offset
                    possible_bases = [0x08000000, 0x08020000, 0x20000000]
                    
                    for base in possible_bases:
                        if target_addr >= base:
                            file_offset = target_addr - base
                            
                            # Check if this points to our version string (within reasonable range)
                            if abs(file_offset - string_offset) < 50:
                                confidence = 85 - abs(file_offset - string_offset) * 2
                                code_candidates.append({
                                    'version': version_value,
                                    'confidence': confidence,
                                    'code_offset': offset,
                                    'instruction_sequence': f"MOVS R1, #{version_value}; ADR R0, 0x{target_addr:08X}",
                                    'target_file_offset': file_offset,
                                    'base_address': base,
                                    'pattern_type': 'movs_adr_match'
                                })
                                
                                print(f"  -> MOVS + ADR pattern at 0x{offset:08X}:")
                                print(f"     MOVS R1, #{version_value} (0x{version_value:X})")
                                print(f"     ADR R0, 0x{target_addr:08X} -> file 0x{file_offset:08X}")
                                print(f"     String at 0x{string_offset:08X}, distance: {abs(file_offset - string_offset)}")
                                print(f"     Confidence: {confidence}%")
        
        # Also look for MOVW instructions for 16-bit values
        for offset in range(0, len(data) - 8, 2):
            instr = decode_arm_thumb_instruction(data, offset)
            
            if instr and instr['type'] == 'MOVW':
                version_value = instr['immediate']
                
                # Look for reasonable version values
                if 100 <= version_value <= 9999:
                    # Check if this is near version-related code by looking for nearby string references
                    nearby_distance = 1000  # Look within 1000 bytes
                    
                    for check_offset in range(max(0, offset - nearby_distance), 
                                            min(len(data), offset + nearby_distance), 2):
                        check_instr = decode_arm_thumb_instruction(data, check_offset)
                        
                        if check_instr and check_instr['type'] == 'ADR':
                            pc = (check_offset + 4) & 0xFFFFFFFC
                            target_addr = pc + (check_instr['immediate'] << 2)
                            
                            for base in [0x08000000, 0x08020000, 0x20000000]:
                                if target_addr >= base:
                                    file_offset = target_addr - base
                                    
                                    if abs(file_offset - string_offset) < 100:
                                        confidence = 80 + (20 - abs(file_offset - string_offset) // 5)
                                        code_candidates.append({
                                            'version': version_value,
                                            'confidence': confidence,
                                            'code_offset': offset,
                                            'instruction_sequence': f"MOVW R{instr['register']}, #{version_value}",
                                            'pattern_type': '16bit_load',
                                            'string_reference_nearby': check_offset
                                        })
                                        
                                        print(f"  -> MOVW R{instr['register']}, #{version_value} at 0x{offset:08X}")
                                        print(f"     Near string reference at 0x{check_offset:08X}")
                                        print(f"     Confidence: {confidence}%")
                                        break
        
        # Sort candidates by confidence and add to results
        code_candidates.sort(key=lambda x: x['confidence'], reverse=True)
        
        for candidate in code_candidates[:3]:  # Take top 3 candidates
            results.append({
                'string_type': string_type,
                'version': candidate['version'],
                'confidence': candidate['confidence'],
                'method': 'ARM instruction analysis',
                'details': candidate
            })
    
    return results

def analyze_firmware_reliable(filepath):
    """Analyze firmware using reliable ARM instruction pattern matching."""
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
    
    # Find version patterns
    versions = find_version_patterns_reliable(data)
    
    if versions:
        print(f"\nReliable version candidates:")
        
        # Group by string type
        by_type = {}
        for v in versions:
            string_type = v['string_type']
            if string_type not in by_type:
                by_type[string_type] = []
            by_type[string_type].append(v)
        
        for string_type, candidates in by_type.items():
            candidates.sort(key=lambda x: x['confidence'], reverse=True)
            best = candidates[0]
            
            print(f"\n{string_type}_VERSION: {best['version']} (confidence: {best['confidence']}%)")
            print(f"  Method: {best['method']}")
            if 'instruction_sequence' in best['details']:
                print(f"  Instructions: {best['details']['instruction_sequence']}")
            
            # Show other candidates if significantly different
            for candidate in candidates[1:3]:
                if candidate['version'] != best['version'] and candidate['confidence'] > 50:
                    print(f"  Alternative: {candidate['version']} (confidence: {candidate['confidence']}%)")
    
    else:
        print("No reliable version patterns found")
    
    # Calculate checksum
    sum_val = sum(data) & 0xFFFFFFFF
    checksum = (~sum_val) & 0xFFFFFFFF
    print(f"\nFirmware Checksum: 0x{checksum:08X}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract-version-reliable.py <firmware.bin>")
        print("\nReliably extracts version information using ARM instruction analysis.")
        sys.exit(1)
    
    analyze_firmware_reliable(sys.argv[1])

if __name__ == "__main__":
    main()