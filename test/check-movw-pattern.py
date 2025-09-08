#!/usr/bin/env python3
"""
Check for MOV.W instructions that reference the 1488 constant.
"""

import struct

def decode_movw_instruction(data, offset):
    """Decode MOV.W instruction specifically."""
    if offset + 3 >= len(data):
        return None
    
    instr1 = struct.unpack('<H', data[offset:offset+2])[0]
    instr2 = struct.unpack('<H', data[offset+2:offset+4])[0]
    
    # MOV.W immediate pattern: F240-F247 (first half), 0000-7FFF (second half)
    if (instr1 & 0xFBF0) == 0xF240:
        rd = instr2 & 0xF
        imm4 = (instr1 >> 0) & 0xF
        imm3 = (instr2 >> 12) & 0x7
        imm8 = (instr2 >> 4) & 0xFF
        i = (instr1 >> 10) & 0x1
        imm16 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        
        return {
            'register': rd,
            'immediate': imm16,
            'raw1': instr1,
            'raw2': instr2
        }
    
    return None

def check_movw_patterns(filepath):
    """Check for MOV.W patterns around version constants."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Checking MOV.W patterns in {filepath}")
    
    # Constants we're looking for
    target_values = [1488, 103, 153]  # Common version values
    
    for target in target_values:
        print(f"\n=== Searching for MOV.W R1, #{target} (0x{target:X}) ===")
        
        # Calculate what the MOV.W encoding should look like
        # MOV.W R1, #target means rd=1, immediate=target
        
        found_movw = False
        
        # Scan for MOV.W instructions
        for offset in range(0, len(data) - 4, 2):
            movw = decode_movw_instruction(data, offset)
            
            if movw and movw['register'] == 1 and movw['immediate'] == target:
                print(f"Found MOV.W R1, #{target} at 0x{offset:08X}")
                print(f"  Raw bytes: {data[offset]:02X} {data[offset+1]:02X} {data[offset+2]:02X} {data[offset+3]:02X}")
                print(f"  Instruction words: 0x{movw['raw1']:04X} 0x{movw['raw2']:04X}")
                
                # Check what follows this instruction
                next_offset = offset + 4
                if next_offset + 1 < len(data):
                    next_instr = struct.unpack('<H', data[next_offset:next_offset+2])[0]
                    print(f"  Next instruction: 0x{next_instr:04X}")
                    
                    # Check if it's ADR R0
                    if (next_instr & 0xF800) == 0xA000:
                        rd = (next_instr >> 8) & 0x7
                        if rd == 0:
                            print(f"  *** Followed by ADR R0! ***")
                            
                            # Calculate ADR target
                            imm8 = next_instr & 0xFF
                            pc = (next_offset + 4) & 0xFFFFFFFC
                            adr_target = pc + (imm8 << 2)
                            print(f"  ADR points to address: 0x{adr_target:08X}")
                            
                            # Convert to file offset
                            possible_bases = [0x08000000, 0x08020000]
                            for base in possible_bases:
                                if adr_target >= base:
                                    file_offset = adr_target - base
                                    if file_offset < len(data):
                                        # Check if this points to a version string
                                        check_data = data[file_offset:file_offset+20]
                                        if b'VERSION' in check_data:
                                            print(f"  *** ADR points to VERSION string at file offset 0x{file_offset:08X}! ***")
                                            print(f"  String: {check_data}")
                
                found_movw = True
        
        if not found_movw:
            print(f"No MOV.W R1, #{target} found")
    
    # Also show all MOV.W R1 instructions with any immediate
    print(f"\n=== All MOV.W R1 instructions ===")
    count = 0
    for offset in range(0, len(data) - 4, 2):
        movw = decode_movw_instruction(data, offset)
        
        if movw and movw['register'] == 1:
            count += 1
            if count <= 20:  # Show first 20
                print(f"MOV.W R1, #{movw['immediate']} (0x{movw['immediate']:X}) at 0x{offset:08X}")
    
    print(f"Total MOV.W R1 instructions: {count}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python check-movw-pattern.py <firmware.bin>")
        sys.exit(1)
    
    check_movw_patterns(sys.argv[1])