#!/usr/bin/env python3
"""
Debug ARM encoding to understand the correct decoding.
"""

import struct

def analyze_known_pattern():
    """Analyze the known pattern that encodes 1488."""
    
    # Known: 4F F4 BA 61 encodes MOV.W R1, #1488 (0x5D0)
    bytes_le = bytes([0x4F, 0xF4, 0xBA, 0x61])
    
    # As 16-bit words (little-endian)
    word1 = struct.unpack('<H', bytes_le[0:2])[0]
    word2 = struct.unpack('<H', bytes_le[2:4])[0]
    
    print(f"Instruction bytes: {' '.join(f'{b:02X}' for b in bytes_le)}")
    print(f"Word1: 0x{word1:04X} = {word1:016b}")
    print(f"Word2: 0x{word2:04X} = {word2:016b}")
    
    # We know this should give us 1488 (0x5D0)
    target = 1488
    print(f"\nTarget value: {target} = 0x{target:04X} = {target:016b}")
    
    # Try to figure out the encoding
    # MOVW encoding T3: 11110 i 10 0100 imm4 | 0 imm3 Rd imm8
    
    # Extract fields
    print("\nExtracting fields from Word1 (0xF44F):")
    print("  Bits 15-11 (should be 11110): ", bin((word1 >> 11) & 0x1F))
    i = (word1 >> 10) & 1
    print(f"  Bit 10 (i): {i}")
    print("  Bits 9-8 (should be 10): ", bin((word1 >> 8) & 0x3))
    print("  Bits 7-4 (should be 0100): ", bin((word1 >> 4) & 0xF))
    imm4 = word1 & 0xF
    print(f"  Bits 3-0 (imm4): {imm4:04b} = {imm4}")
    
    print("\nExtracting fields from Word2 (0x61BA):")
    print("  Bit 15 (should be 0): ", (word2 >> 15) & 1)
    imm3 = (word2 >> 12) & 0x7
    print(f"  Bits 14-12 (imm3): {imm3:03b} = {imm3}")
    rd = (word2 >> 8) & 0xF
    print(f"  Bits 11-8 (Rd): {rd:04b} = {rd}")
    imm8 = word2 & 0xFF
    print(f"  Bits 7-0 (imm8): {imm8:08b} = 0x{imm8:02X}")
    
    # Now try to combine to get 1488
    print(f"\nCombining to form immediate:")
    print(f"  imm4={imm4}, i={i}, imm3={imm3}, imm8=0x{imm8:02X}")
    
    # Standard interpretation: imm16 = imm4:i:imm3:imm8
    standard = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
    print(f"  Standard (imm4:i:imm3:imm8): {standard} = 0x{standard:04X}")
    
    # But 1488 = 0x05D0 = 0000 0101 1101 0000
    # Let's see what fields would give us 0x05D0
    print(f"\n1488 = 0x05D0 broken down:")
    print(f"  Bits 15-12: {(0x05D0 >> 12) & 0xF:04b} = {(0x05D0 >> 12) & 0xF}")
    print(f"  Bit 11: {(0x05D0 >> 11) & 1}")
    print(f"  Bits 10-8: {(0x05D0 >> 8) & 0x7:03b} = {(0x05D0 >> 8) & 0x7}")
    print(f"  Bits 7-0: {0x05D0 & 0xFF:08b} = 0x{0x05D0 & 0xFF:02X}")
    
    # Hmm, let me check if the encoding is different
    # Maybe the bytes are swapped in the encoding?
    
    # Let's check if we need to swap nibbles or bytes
    print(f"\nTrying different combinations:")
    
    # Swap bytes in immediate
    swap1 = (imm8 << 8) | ((imm3 << 4) | imm4)
    print(f"  (imm8 << 8) | ((imm3 << 4) | imm4): {swap1} = 0x{swap1:04X}")
    
    # Different bit arrangement
    swap2 = ((imm3 & 3) << 8) | imm8 | ((i << 10) | (imm4 << 11))
    print(f"  Complex arrangement: {swap2} = 0x{swap2:04X}")
    
    # What if we just swap the nibbles in imm8?
    imm8_swapped = ((imm8 & 0xF) << 4) | ((imm8 >> 4) & 0xF)
    swap3 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8_swapped
    print(f"  With swapped imm8 nibbles: {swap3} = 0x{swap3:04X}")
    
    # Let's work backwards from 1488
    # If 1488 = 0x05D0 and we have imm4=F, i=1, imm3=6, imm8=BA
    # Maybe there's a transformation?
    
    # Check if BA relates to D0
    print(f"\nRelationship between imm8=0x{imm8:02X} and expected 0xD0:")
    print(f"  XOR: 0x{imm8 ^ 0xD0:02X}")
    print(f"  Complement: 0x{(~imm8) & 0xFF:02X}")
    
    # Actually, let's look at the actual ARM documentation
    # For MOVW T3, the immediate is: imm16 = imm4:i:imm3:imm8
    # But wait, that gives us FEBA not 05D0
    
    # Maybe there's bit reversal or rotation?
    print(f"\nBit manipulations of 0xFEBA to get 0x05D0:")
    feba = 0xFEBA
    target = 0x05D0
    
    # Check various operations
    print(f"  NOT: 0x{(~feba) & 0xFFFF:04X}")
    print(f"  Rotate left 1: 0x{((feba << 1) | (feba >> 15)) & 0xFFFF:04X}")
    print(f"  Rotate right 1: 0x{((feba >> 1) | (feba << 15)) & 0xFFFF:04X}")
    
    # Hmm, NOT of FEBA is 0145, not 05D0
    
    # Let me reconsider the encoding...
    # What if the immediate encoding is more complex?

if __name__ == "__main__":
    analyze_known_pattern()