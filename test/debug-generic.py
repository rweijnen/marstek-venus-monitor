#!/usr/bin/env python3
"""
Debug why generic script isn't finding patterns.
"""

import struct

def decode_movw_instruction(word1, word2):
    """Decode MOV.W instruction."""
    print(f"    Checking: word1=0x{word1:04X} & 0xFBF0 = 0x{word1 & 0xFBF0:04X}, expect 0xF240")
    if (word1 & 0xFBF0) != 0xF240:
        print(f"    Pattern doesn't match!")
        return None, None
    print(f"    Pattern matches!")
    
    i = (word1 >> 10) & 0x1
    imm4 = word1 & 0xF
    imm3 = (word2 >> 12) & 0x7
    rd = (word2 >> 8) & 0xF
    imm8 = word2 & 0xFF
    
    immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
    
    return rd, immediate

def debug_search(filepath):
    """Debug the search at the known offset."""
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # We know the pattern is at 0x20940
    target_offset = 0x20940
    
    print(f"Checking known pattern location at 0x{target_offset:08X}")
    
    # Check PUSH
    if data[target_offset:target_offset+2] == bytes([0x10, 0xB5]):
        print("  PUSH {R4,LR} found - OK")
    else:
        print("  PUSH not found - ERROR")
    
    # Check MOV.W
    if data[target_offset+2:target_offset+4] == bytes([0x4F, 0xF4]):
        print("  MOV.W pattern found - OK")
        
        # Extract and decode
        movw_bytes = data[target_offset+2:target_offset+6]
        word1 = struct.unpack('<H', movw_bytes[0:2])[0]
        word2 = struct.unpack('<H', movw_bytes[2:4])[0]
        
        print(f"  Word1: 0x{word1:04X}, Word2: 0x{word2:04X}")
        
        rd, immediate = decode_movw_instruction(word1, word2)
        
        if rd is not None:
            print(f"  Decoded: R{rd}, immediate={immediate}")
            
            if rd == 1:
                print("  Register is R1 - OK")
            else:
                print(f"  Register is R{rd}, not R1 - ERROR")
                
            if immediate == 1488:
                print("  Immediate is 1488 - OK")
            else:
                print(f"  Immediate is {immediate}, not 1488 - ERROR")
        else:
            print("  Failed to decode - ERROR")
    else:
        print("  MOV.W pattern not found - ERROR")
    
    # Check ADR
    if target_offset + 7 < len(data) and data[target_offset+7] == 0xA0:
        print("  ADR R0 found - OK")
        
        adr_immediate = data[target_offset+6]
        print(f"  ADR immediate: 0x{adr_immediate:02X}")
        
        # Calculate target
        adr_offset = target_offset + 6
        pc = (adr_offset + 4) & 0xFFFFFFFC
        
        # Check different bases
        for base in [0x08000000, 0x08020000, 0x20000000, 0]:
            runtime_pc = base + pc
            adr_target = runtime_pc + (adr_immediate << 2)
            file_target = adr_target - base
            
            # Check if points to SOFT_VERSION
            if 0 <= file_target < len(data):
                check_data = data[file_target:file_target+20]
                if b'SOFT_VERSION' in check_data:
                    print(f"  ADR points to SOFT_VERSION with base 0x{base:08X} - OK")
                    break
    else:
        print("  ADR not found - ERROR")

if __name__ == "__main__":
    import sys
    debug_search(sys.argv[1])