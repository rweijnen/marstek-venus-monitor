#!/usr/bin/env python3
"""
Test instruction decoding to verify MOV.W pattern detection.
"""

import struct

def decode_arm_thumb_instruction(data, offset):
    """Decode ARM Thumb instruction at given offset."""
    if offset + 1 >= len(data):
        return None
    
    # ARM Thumb instructions are 16-bit (2 bytes)
    instr = struct.unpack('<H', data[offset:offset+2])[0]
    
    print(f"Offset 0x{offset:08X}: Raw instruction 0x{instr:04X}")
    
    # MOVS Rd, #imm8 pattern: 001 rd(3) imm8(8)
    if (instr & 0xF800) == 0x2000:
        rd = (instr >> 8) & 0x7
        imm8 = instr & 0xFF
        print(f"  -> MOVS R{rd}, #{imm8} (0x{imm8:02X})")
        return {
            'type': 'MOVS',
            'register': rd,
            'immediate': imm8,
            'size': 2
        }
    
    # MOV.W Rd, #imm16 pattern (32-bit instruction)
    elif (instr & 0xFBF0) == 0xF240:
        if offset + 3 >= len(data):
            return None
        second_half = struct.unpack('<H', data[offset+2:offset+4])[0]
        print(f"  Second half: 0x{second_half:04X}")
        
        rd = second_half & 0xF
        imm4 = (instr >> 0) & 0xF
        imm3 = (second_half >> 12) & 0x7
        imm8 = (second_half >> 4) & 0xFF
        i = (instr >> 10) & 0x1
        imm16 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        
        print(f"  -> MOV.W R{rd}, #{imm16} (0x{imm16:04X})")
        print(f"     Breakdown: imm4={imm4:X}, i={i}, imm3={imm3:X}, imm8={imm8:02X}")
        
        return {
            'type': 'MOV.W',
            'register': rd,
            'immediate': imm16,
            'size': 4
        }
    
    # ADR Rd, #imm8 pattern: 10100 rd(3) imm8(8)
    elif (instr & 0xF800) == 0xA000:
        rd = (instr >> 8) & 0x7
        imm8 = instr & 0xFF
        print(f"  -> ADR R{rd}, #{imm8}")
        return {
            'type': 'ADR',
            'register': rd,
            'immediate': imm8,
            'size': 2
        }
    
    # PUSH {regs} instruction pattern
    elif (instr & 0xFE00) == 0xB400:
        reg_list = instr & 0xFF
        lr_bit = (instr >> 8) & 0x1
        print(f"  -> PUSH {{regs=0x{reg_list:02X}, LR={lr_bit}}}")
        return {
            'type': 'PUSH',
            'registers': reg_list,
            'includes_lr': lr_bit,
            'size': 2
        }
    
    else:
        print(f"  -> Unknown instruction")
        return None

def test_instruction_decoding(filepath):
    """Test instruction decoding around known version strings."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Find SOFT_VERSION string
    pos = data.find(b'SOFT_VERSION:%d')
    if pos == -1:
        print("SOFT_VERSION string not found")
        return
    
    print(f"SOFT_VERSION string found at offset 0x{pos:08X}")
    print("Testing instruction decoding in nearby areas...\n")
    
    # Look for MOV.W R1, #0x5D0 pattern (1488 decimal)
    target_value = 1488  # 0x5D0
    print(f"Looking for MOV.W R1, #{target_value} (0x{target_value:X})...")
    
    # Search a reasonable range around the string
    search_start = max(0, pos - 5000)
    search_end = min(len(data), pos + 5000)
    
    found_patterns = []
    
    for offset in range(search_start, search_end - 4, 2):
        instr = decode_arm_thumb_instruction(data, offset)
        if instr and instr['type'] == 'MOV.W' and instr['register'] == 1:
            if instr['immediate'] == target_value:
                found_patterns.append(offset)
                print(f"\n*** FOUND TARGET at 0x{offset:08X} ***")
                
                # Check next instruction for ADR
                next_offset = offset + 4
                next_instr = decode_arm_thumb_instruction(data, next_offset)
                if next_instr and next_instr['type'] == 'ADR' and next_instr['register'] == 0:
                    print(f"*** FOLLOWED BY ADR R0 at 0x{next_offset:08X} ***")
    
    print(f"\nFound {len(found_patterns)} instances of MOV.W R1, #{target_value}")
    
    # Also search for any MOV.W R1 with any immediate
    print(f"\nSearching for any MOV.W R1, #immediate patterns...")
    
    mov_w_count = 0
    for offset in range(search_start, search_end - 4, 2):
        instr = decode_arm_thumb_instruction(data, offset)
        if instr and instr['type'] == 'MOV.W' and instr['register'] == 1:
            mov_w_count += 1
            if mov_w_count <= 10:  # Show first 10
                print(f"  MOV.W R1, #{instr['immediate']} at 0x{offset:08X}")
    
    print(f"Total MOV.W R1 instructions found: {mov_w_count}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python test-instruction-decode.py <firmware.bin>")
        sys.exit(1)
    
    test_instruction_decoding(sys.argv[1])