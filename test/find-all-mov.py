#!/usr/bin/env python3
"""
Find all MOV instructions in the firmware.
"""

import struct

def decode_thumb2_movt_movw(data, offset):
    if offset + 3 >= len(data):
        return None, None, None
    
    word1 = struct.unpack('<H', data[offset:offset+2])[0]
    word2 = struct.unpack('<H', data[offset+2:offset+4])[0]
    
    # Check for MOV.W immediate (T2 encoding) first - it's more specific
    if (word1 & 0xFBEF) == 0xF04F:
        i = (word1 >> 10) & 1
        s = (word1 >> 4) & 1
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        imm12 = (i << 11) | (imm3 << 8) | imm8
        
        if (imm12 & 0xC00) == 0:
            if (imm12 & 0x300) == 0x000:
                immediate = imm8
            elif (imm12 & 0x300) == 0x100:
                immediate = (imm8 << 16) | imm8
            elif (imm12 & 0x300) == 0x200:
                immediate = (imm8 << 24) | (imm8 << 8)
            else:  # 0x300
                immediate = (imm8 << 24) | (imm8 << 16) | (imm8 << 8) | imm8
        else:
            unrotated_value = 0x80 | (imm8 & 0x7F)
            rotation = (imm12 >> 7) & 0x1F
            immediate = (unrotated_value >> rotation) | ((unrotated_value << (32 - rotation)) & 0xFFFFFFFF)
            immediate &= 0xFFFFFFFF
        
        return rd, immediate, 'MOV.W'
    
    # Check for MOVW (T3 encoding)
    if (word1 & 0xFB50) == 0xF040:
        i = (word1 >> 10) & 1
        imm4 = word1 & 0xF
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        return rd, immediate, 'MOVW'
    
    return None, None, None

def find_all_mov(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print("Searching for all MOV instructions...")
    
    mov_instructions = []
    
    # Search for 32-bit MOV instructions
    for offset in range(0, len(data) - 4, 2):  # Step by 2 for 16-bit alignment
        rd, immediate, mov_type = decode_thumb2_movt_movw(data, offset)
        
        if rd is not None:
            mov_instructions.append({
                'offset': offset,
                'type': mov_type,
                'register': rd,
                'immediate': immediate
            })
    
    # Search for MOVS R1 instructions (8-bit immediate)
    for offset in range(0, len(data) - 2):
        if offset + 1 < len(data) and data[offset + 1] == 0x21:  # MOVS R1, #imm8
            immediate = data[offset]
            mov_instructions.append({
                'offset': offset,
                'type': 'MOVS',
                'register': 1,
                'immediate': immediate
            })
    
    # Filter for interesting values
    print(f"Found {len(mov_instructions)} MOV instructions")
    
    interesting_values = [103, 1488, 153]  # The versions we're looking for
    
    print(f"\nFiltering for interesting values: {interesting_values}")
    
    for mov in mov_instructions:
        if mov['immediate'] in interesting_values:
            print(f"  0x{mov['offset']:08X}: {mov['type']} R{mov['register']}, #{mov['immediate']}")
    
    # Also look for values in reasonable range
    print(f"\nAll MOV instructions with values 50-2000:")
    
    for mov in sorted(mov_instructions, key=lambda x: x['immediate']):
        if 50 <= mov['immediate'] <= 2000:
            print(f"  0x{mov['offset']:08X}: {mov['type']} R{mov['register']}, #{mov['immediate']}")

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin"
    find_all_mov(filepath)