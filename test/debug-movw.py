#!/usr/bin/env python3
"""
Debug MOV.W instruction decoding.
"""

import struct

def debug_movw():
    """Debug the specific MOV.W pattern we know exists."""
    
    # We know this pattern exists: 10 B5 4F F4 BA 61 13 A0
    # Which is: PUSH {R4,LR} ; MOV.W R1, #0x5D0 ; ADR R0
    
    pattern = bytes([0x10, 0xB5, 0x4F, 0xF4, 0xBA, 0x61, 0x13, 0xA0])
    
    print(f"Known pattern: {' '.join(f'{b:02X}' for b in pattern)}")
    print(f"  PUSH {{R4,LR}}: {pattern[0]:02X} {pattern[1]:02X}")
    print(f"  MOV.W R1, #1488: {pattern[2]:02X} {pattern[3]:02X} {pattern[4]:02X} {pattern[5]:02X}")
    print(f"  ADR R0: {pattern[6]:02X} {pattern[7]:02X}")
    
    # The MOV.W bytes are: 4F F4 BA 61
    movw_bytes = pattern[2:6]
    
    # In little-endian, this becomes two 16-bit words
    word1 = struct.unpack('<H', movw_bytes[0:2])[0]  # 4F F4 -> 0xF44F
    word2 = struct.unpack('<H', movw_bytes[2:4])[0]  # BA 61 -> 0x61BA
    
    print(f"\nMOV.W as 16-bit words (little-endian):")
    print(f"  Word1: 0x{word1:04X} (binary: {word1:016b})")
    print(f"  Word2: 0x{word2:04X} (binary: {word2:016b})")
    
    # MOV.W Rd, #imm16 encoding (T3):
    # Word1: 11110 i 10 0100 imm4
    # Word2: 0 imm3 Rd imm8
    
    # Check if word1 matches the pattern
    if (word1 & 0xFBF0) == 0xF240:
        print("\nWord1 matches MOV.W pattern!")
        
        # Extract fields from word1
        i = (word1 >> 10) & 0x1
        imm4 = word1 & 0xF
        
        print(f"  From word1: i={i}, imm4={imm4:X}")
        
        # Extract fields from word2
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        print(f"  From word2: imm3={imm3:X}, rd={rd}, imm8=0x{imm8:02X}")
        
        # Combine to form immediate: imm4:i:imm3:imm8
        immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        
        print(f"\nImmediate calculation:")
        print(f"  imm4 << 12: 0x{imm4:X} << 12 = 0x{imm4 << 12:04X}")
        print(f"  i << 11:    {i} << 11 = 0x{i << 11:04X}")
        print(f"  imm3 << 8:  0x{imm3:X} << 8 = 0x{imm3 << 8:04X}")
        print(f"  imm8:       0x{imm8:02X}")
        print(f"  Combined:   0x{immediate:04X} = {immediate} decimal")
        
        if immediate == 1488:
            print("\n*** SUCCESS! Correctly decoded 1488! ***")
        else:
            print(f"\n*** ERROR: Got {immediate}, expected 1488 ***")
            
            # Let's verify 1488 in binary
            print(f"\n1488 = 0x5D0 = {1488:016b}")
            print(f"      = 0000 0101 1101 0000")
            print(f"      = imm4=0 i=1 imm3=5 imm8=D0")
            
            # So we expect:
            # imm4 = 0
            # i = 1  
            # imm3 = 5
            # imm8 = 0xD0
            
            print(f"\nExpected fields for 1488:")
            print(f"  imm4=0, i=1, imm3=5, imm8=0xD0")
            print(f"Actual fields:")
            print(f"  imm4={imm4}, i={i}, imm3={imm3}, imm8=0x{imm8:02X}")

if __name__ == "__main__":
    debug_movw()