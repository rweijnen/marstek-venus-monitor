#!/usr/bin/env python3
"""
Identify what instruction 4F F4 BA 61 actually is.
"""

import struct

def identify_instruction():
    """Try to identify the actual instruction."""
    
    bytes_le = bytes([0x4F, 0xF4, 0xBA, 0x61])
    word1 = struct.unpack('<H', bytes_le[0:2])[0]  # 0xF44F
    word2 = struct.unpack('<H', bytes_le[2:4])[0]  # 0x61BA
    
    print(f"Instruction: {' '.join(f'{b:02X}' for b in bytes_le)}")
    print(f"Word1: 0x{word1:04X} = {word1:016b}")
    print(f"Word2: 0x{word2:04X} = {word2:016b}")
    
    # Check various 32-bit Thumb-2 instruction patterns
    
    print("\nChecking instruction patterns:")
    
    # MOV.W immediate (T2) - 11110 i 00010 S 1111 | 0 imm3 Rd imm8
    if (word1 & 0xFBEF) == 0xF04F:
        print("Matches MOV.W immediate T2 encoding!")
        
        i = (word1 >> 10) & 1
        s = (word1 >> 4) & 1
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        print(f"  i={i}, s={s}, imm3={imm3}, rd={rd}, imm8=0x{imm8:02X}")
        
        # This uses modified immediate (ThumbExpandImm)
        imm12 = (i << 11) | (imm3 << 8) | imm8
        print(f"  imm12 = 0x{imm12:03X}")
        
        # Decode ThumbExpandImm
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
            # Rotated form: 1bcdefgh where the 8-bit immediate is bcdefgh rotated right by 2*rotation
            unrotated_value = 0x80 | (imm8 & 0x7F)  # 1bcdefgh
            rotation = (imm12 >> 7) & 0x1F  # 5-bit rotation
            
            # Rotate right by rotation amount
            immediate = (unrotated_value >> rotation) | ((unrotated_value << (32 - rotation)) & 0xFFFFFFFF)
            immediate &= 0xFFFFFFFF
        
        print(f"  Decoded immediate: {immediate} = 0x{immediate:X}")
        
        if immediate == 1488:
            print("  *** MATCHES TARGET VALUE 1488! ***")
        
        return immediate
    
    # MOVW (T3) - 11110 i 10 0100 imm4 | 0 imm3 Rd imm8  
    elif (word1 & 0xFBF0) == 0xF240:
        print("Matches MOVW T3 encoding")
        
        i = (word1 >> 10) & 1
        imm4 = word1 & 0xF
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        print(f"  Immediate: {immediate} = 0x{immediate:X}")
        
        return immediate
    
    else:
        print("Unknown instruction pattern")
        
        # Let's try to identify by checking bit patterns
        print(f"\nBit analysis of word1 (0x{word1:04X}):")
        for i in range(16):
            bit = (word1 >> (15-i)) & 1
            print(f"  Bit {15-i:2d}: {bit}", end="")
            if i == 4 or i == 9 or i == 11:
                print(" |", end="")
            print()
        
        return None

if __name__ == "__main__":
    identify_instruction()