#!/usr/bin/env python3
"""
Debug why extract-version-proper.py is not finding the pattern.
"""

import struct

def debug_pattern_search(filepath):
    """Debug the pattern search around the known offset."""
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    target_offset = 0x20940
    print(f"Debugging pattern search around offset 0x{target_offset:08X}")
    print(f"Data length: {len(data)}")
    
    # Check if we're even hitting this offset in the search
    search_range = range(0, len(data) - 8)
    print(f"Search range: {search_range.start} to {search_range.stop}")
    print(f"Target offset in range: {target_offset in search_range}")
    
    # Check the exact bytes at the target
    if target_offset < len(data) - 8:
        bytes_at_target = data[target_offset:target_offset+8]
        print(f"Bytes at target: {' '.join(f'{b:02X}' for b in bytes_at_target)}")
        
        # Check PUSH detection
        push_bytes = data[target_offset:target_offset+2]
        print(f"PUSH bytes: {' '.join(f'{b:02X}' for b in push_bytes)}")
        print(f"PUSH match: {push_bytes == b'\\x10\\xB5'}")
        
        # Check MOV.W detection  
        if push_bytes == b'\x10\xB5':
            word1 = struct.unpack('<H', data[target_offset+2:target_offset+4])[0]
            word2 = struct.unpack('<H', data[target_offset+4:target_offset+6])[0]
            
            print(f"MOV.W word1: 0x{word1:04X}")
            print(f"MOV.W word2: 0x{word2:04X}")
            
            # Test the exact condition from extract-version-proper.py
            condition1 = (word1 & 0xFBEF) == 0xF04F
            print(f"MOV.W T2 condition: {condition1}")
            
            if condition1:
                i = (word1 >> 10) & 1
                s = (word1 >> 4) & 1
                imm3 = (word2 >> 12) & 0x7
                rd = (word2 >> 8) & 0xF
                imm8 = word2 & 0xFF
                
                print(f"  i={i}, s={s}, imm3={imm3}, rd={rd}, imm8=0x{imm8:02X}")
                
                # Check if rd == 1
                print(f"  rd == 1: {rd == 1}")
    
    # Now let's manually check the search loop logic
    print(f"\nManually checking search loop logic:")
    
    found_patterns = 0
    for offset in range(target_offset - 10, target_offset + 10):
        if offset < 0 or offset + 7 >= len(data):
            continue
            
        if data[offset:offset+2] == b'\x10\xB5':
            print(f"  Found PUSH at 0x{offset:08X}")
            
            # Check for 32-bit MOV instruction
            word1 = struct.unpack('<H', data[offset+2:offset+4])[0]
            word2 = struct.unpack('<H', data[offset+4:offset+6])[0]
            
            # Use the same decode function as extract-version-proper.py
            if (word1 & 0xFBEF) == 0xF04F:
                i = (word1 >> 10) & 1
                s = (word1 >> 4) & 1
                imm3 = (word2 >> 12) & 0x7
                rd = (word2 >> 8) & 0xF
                imm8 = word2 & 0xFF
                
                # ThumbExpandImm decoding
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
                
                if rd == 1:
                    print(f"    MOV.W R1, #{immediate} at 0x{offset:08X}")
                    
                    # Check ADR
                    if offset + 7 < len(data) and data[offset + 7] == 0xA0:
                        adr_reg = (data[offset + 6] >> 3) & 0x7
                        if adr_reg == 0:
                            print(f"    Complete pattern found! Version={immediate}")
                            found_patterns += 1

    print(f"\nTotal patterns found in manual check: {found_patterns}")

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin"
    debug_pattern_search(filepath)