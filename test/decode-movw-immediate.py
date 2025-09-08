#!/usr/bin/env python3
"""
Properly decode MOV.W immediate values.
"""

def decode_movw_immediate(word1, word2):
    """
    Decode MOV.W immediate from two 16-bit words.
    
    ARM Thumb-2 MOV.W Rd, #imm16 encoding:
    First word:  1111 0i10 0100 imm4
    Second word: 0imm3 Rd imm8
    
    Where immediate = imm4:i:imm3:imm8
    """
    print(f"  Debug: word1=0x{word1:04X}, word2=0x{word2:04X}")
    
    # Extract fields from first word 
    i = (word1 >> 10) & 0x1
    imm4 = word1 & 0xF
    
    print(f"  From word1: i={i}, imm4=0x{imm4:X}")
    
    # Extract fields from second word
    imm3 = (word2 >> 12) & 0x7
    rd = (word2 >> 8) & 0xF  
    imm8 = word2 & 0xFF
    
    print(f"  From word2: imm3=0x{imm3:X}, rd={rd}, imm8=0x{imm8:02X}")
    
    # Combine to form immediate: imm4:i:imm3:imm8
    immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
    
    print(f"  Immediate calculation: (0x{imm4:X}<<12) | ({i}<<11) | (0x{imm3:X}<<8) | 0x{imm8:02X} = 0x{immediate:04X}")
    
    return immediate, rd

def decode_movw_correct(word1, word2):
    """
    Correct MOV.W decoding based on ARM architecture reference.
    
    For MOV.W Rd, #imm16:
    Encoding T3: 11110i10010011110imm4 Rd imm8
    But this doesn't match our pattern...
    
    Let me try the modified immediate encoding used in MOV.W
    """
    # This might be a modified immediate, not a plain 16-bit immediate
    # Let's try to decode it as ThumbExpandImm
    
    # Extract the 12-bit modified immediate
    i = (word1 >> 10) & 0x1  
    imm3 = (word2 >> 12) & 0x7
    imm8 = word2 & 0xFF
    rd = (word2 >> 8) & 0xF
    
    # Combine i:imm3:imm8 to form 12-bit modified immediate
    imm12 = (i << 11) | (imm3 << 8) | imm8
    
    print(f"  Modified immediate: i={i}, imm3=0x{imm3:X}, imm8=0x{imm8:02X}")
    print(f"  Combined imm12: 0x{imm12:03X}")
    
    # Decode modified immediate (ThumbExpandImm)
    if (imm12 & 0xC00) == 0:  # imm12[11:10] == 00
        # Simple case: immediate = imm8
        immediate = imm8
    else:
        # More complex cases - rotation, etc.
        # For now, let's see if simple case works
        immediate = imm8
    
    return immediate, rd

def analyze_movw_pattern():
    """Analyze the specific MOV.W pattern we found."""
    
    # From the pattern: 4F F4 BA 61
    # This represents MOV.W R1, #0x5D0 (1488 decimal)
    
    word1 = 0xF44F  # Note: little endian, so 4F F4 becomes 0xF44F
    word2 = 0x61BA  # Similarly, BA 61 becomes 0x61BA
    
    print(f"Decoding MOV.W pattern: 4F F4 BA 61")
    print(f"Word 1 (little endian): 0x{word1:04X}")
    print(f"Word 2 (little endian): 0x{word2:04X}")
    
    immediate, rd = decode_movw_immediate(word1, word2)
    
    print(f"Decoded: MOV.W R{rd}, #{immediate} (0x{immediate:X})")
    
    if immediate == 1488:
        print("*** CORRECT! This matches 1488 ***")
    else:
        print(f"*** ERROR: Expected 1488, got {immediate} ***")
        
        # Try swapping byte order
        word1_swapped = 0x4FF4
        word2_swapped = 0xBA61
        
        print(f"\nTrying with different byte order:")
        print(f"Word 1: 0x{word1_swapped:04X}")
        print(f"Word 2: 0x{word2_swapped:04X}")
        
        immediate2, rd2 = decode_movw_immediate(word1_swapped, word2_swapped)
        print(f"Decoded: MOV.W R{rd2}, #{immediate2} (0x{immediate2:X})")
        
        if immediate2 == 1488:
            print("*** CORRECT with swapped byte order! ***")

def test_with_firmware(filepath):
    """Test with the actual firmware bytes."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # We know the pattern is at 0x00020940
    offset = 0x00020940
    
    print(f"\nAnalyzing pattern at 0x{offset:08X}:")
    
    # Extract the actual bytes
    pattern_bytes = data[offset:offset+8]
    print(f"Raw bytes: {' '.join(f'{b:02X}' for b in pattern_bytes)}")
    
    # Extract MOV.W instruction (bytes 2-5)
    movw_bytes = pattern_bytes[2:6]  # 4F F4 BA 61
    print(f"MOV.W bytes: {' '.join(f'{b:02X}' for b in movw_bytes)}")
    
    # Convert to 16-bit words (little endian)
    import struct
    word1, word2 = struct.unpack('<HH', movw_bytes)
    
    print(f"Word 1: 0x{word1:04X}")
    print(f"Word 2: 0x{word2:04X}")
    
    immediate, rd = decode_movw_immediate(word1, word2)
    
    print(f"Decoded: MOV.W R{rd}, #{immediate} (0x{immediate:X})")
    
    if immediate == 1488:
        print("*** SUCCESS! Correctly decoded 1488 ***")
    else:
        print(f"*** Still wrong. Expected 1488, got {immediate} ***")

if __name__ == "__main__":
    analyze_movw_pattern()
    
    import sys
    if len(sys.argv) >= 2:
        test_with_firmware(sys.argv[1])