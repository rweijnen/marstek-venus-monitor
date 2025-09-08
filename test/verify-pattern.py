#!/usr/bin/env python3
"""
Verify the exact instruction pattern and manually check the calculation.
"""

def manual_check():
    """Manually verify the 1488 (0x5D0) encoding."""
    
    # 1488 decimal = 0x5D0 hex
    target = 1488
    target_hex = 0x5D0
    
    print(f"Target value: {target} decimal = 0x{target_hex:X} hex")
    print(f"Binary: {target:016b}")
    
    # The instruction is: 4F F4 BA 61
    # Let's see if we can figure out how 0x5D0 is encoded
    
    bytes_found = [0x4F, 0xF4, 0xBA, 0x61]
    print(f"Instruction bytes: {' '.join(f'0x{b:02X}' for b in bytes_found)}")
    
    # Convert to 16-bit words (little endian)
    import struct
    word1, word2 = struct.unpack('<HH', bytes(bytes_found))
    print(f"As little-endian words: 0x{word1:04X}, 0x{word2:04X}")
    
    # Try to find 0x5D0 patterns in the instruction
    print(f"\nLooking for 0x5D0 patterns:")
    
    # Check if any combination gives us 0x5D0
    for i in range(4):
        for j in range(i+1, 4):
            combined = (bytes_found[i] << 8) | bytes_found[j]
            if combined == 0x5D0:
                print(f"Found 0x5D0 in bytes {i},{j}: 0x{bytes_found[i]:02X}{bytes_found[j]:02X}")
    
    # Check XOR, ADD, etc.
    for i in range(4):
        for j in range(i+1, 4):
            xor_result = bytes_found[i] ^ bytes_found[j]
            add_result = (bytes_found[i] + bytes_found[j]) & 0xFFFF
            
            if xor_result == (target & 0xFF) or xor_result == ((target >> 8) & 0xFF):
                print(f"XOR bytes {i},{j}: 0x{bytes_found[i]:02X} ^ 0x{bytes_found[j]:02X} = 0x{xor_result:02X}")
            
            if add_result == target:
                print(f"ADD bytes {i},{j}: 0x{bytes_found[i]:02X} + 0x{bytes_found[j]:02X} = 0x{add_result:X}")

def reverse_engineer_encoding():
    """Try to reverse engineer how 1488 is encoded."""
    
    # We know the pattern should encode 1488 (0x5D0)
    # Instruction: 4F F4 BA 61
    
    print("Reverse engineering the encoding...")
    
    # MOV.W with modified immediate uses this encoding:
    # 11110 i 10 0100 imm4 0 imm3 Rd imm8
    
    word1 = 0xF44F  # 4F F4 in little endian
    word2 = 0x61BA  # BA 61 in little endian
    
    print(f"Word1: 0x{word1:04X} = {word1:016b}")
    print(f"Word2: 0x{word2:04X} = {word2:016b}")
    
    # Check if this matches MOV.W pattern: 11110i100100xxxx
    pattern_mask = 0xFBF0
    pattern_value = 0xF240
    
    if (word1 & pattern_mask) == pattern_value:
        print("Matches MOV.W modified immediate pattern!")
        
        # Extract fields
        i = (word1 >> 10) & 0x1
        imm4 = word1 & 0xF
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        print(f"i={i}, imm4=0x{imm4:X}, imm3=0x{imm3:X}, rd={rd}, imm8=0x{imm8:02X}")
        
        # Try different ways to combine these to get 1488
        combinations = [
            (imm4 << 8) | imm8,
            (imm3 << 8) | imm8,
            (i << 12) | (imm4 << 8) | imm8,
            (i << 11) | (imm3 << 8) | imm8,
            (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8,
        ]
        
        for combo in combinations:
            print(f"Combination gives: {combo} (0x{combo:X})")
            if combo == 1488:
                print("*** FOUND THE CORRECT COMBINATION! ***")
    
    # Maybe it's not a modified immediate but MOVW (move wide)?
    # MOVW pattern: 11110i100100imm4 0imm3Rdimm8
    print(f"\nTrying MOVW interpretation...")
    
    # For MOVW, immediate is: imm4:i:imm3:imm8
    if (word1 & 0xFBF0) == 0xF240:
        i = (word1 >> 10) & 0x1
        imm4 = word1 & 0xF
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        # This is the standard MOVW encoding
        imm16 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        
        print(f"MOVW R{rd}, #0x{imm16:04X} ({imm16})")
        
        if imm16 == 1488:
            print("*** MOVW ENCODING WORKS! ***")
        
        # Let's manually verify with our known values
        # We want imm16 = 0x5D0 = 1488
        # 0x5D0 = 0101 1101 0000 (binary)
        # imm4:i:imm3:imm8 format
        
        target_imm4 = (0x5D0 >> 12) & 0xF  # Should be 0
        target_i = (0x5D0 >> 11) & 0x1     # Should be 1  
        target_imm3 = (0x5D0 >> 8) & 0x7   # Should be 5
        target_imm8 = 0x5D0 & 0xFF         # Should be 0xD0
        
        print(f"Expected for 0x5D0: imm4={target_imm4}, i={target_i}, imm3={target_imm3}, imm8=0x{target_imm8:02X}")
        print(f"Actual from bytes: imm4={imm4}, i={i}, imm3={imm3}, imm8=0x{imm8:02X}")

if __name__ == "__main__":
    manual_check()
    print("\n" + "="*50 + "\n")
    reverse_engineer_encoding()