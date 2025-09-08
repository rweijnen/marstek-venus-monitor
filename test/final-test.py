#!/usr/bin/env python3
"""
Final test - check if the pattern search is working.
"""

import struct

def decode_mov_w_t2(word1, word2):
    """Decode MOV.W T2 instruction."""
    # Check for MOV.W immediate (T2 encoding) 
    # 11110 i 00010 S 1111 | 0 imm3 Rd imm8
    if (word1 & 0xFBEF) != 0xF04F:
        return None, None, None
    
    i = (word1 >> 10) & 1
    s = (word1 >> 4) & 1
    imm3 = (word2 >> 12) & 0x7
    rd = (word2 >> 8) & 0xF
    imm8 = word2 & 0xFF
    
    # ThumbExpandImm(i:imm3:imm8)
    imm12 = (i << 11) | (imm3 << 8) | imm8
    
    # Decode modified immediate
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
        # Rotated form
        unrotated_value = 0x80 | (imm8 & 0x7F)
        rotation = (imm12 >> 7) & 0x1F
        immediate = (unrotated_value >> rotation) | ((unrotated_value << (32 - rotation)) & 0xFFFFFFFF)
        immediate &= 0xFFFFFFFF
    
    return rd, immediate, 'MOV.W'

def test_pattern_search(filepath):
    """Test pattern search at the known location."""
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    target_offset = 0x20940
    
    print(f"Testing at known offset 0x{target_offset:08X}:")
    
    # Test PUSH detection
    if data[target_offset:target_offset+2] == b'\x10\xB5':
        print("  PUSH {R4,LR} found OK")
        
        # Test MOV.W detection
        word1 = struct.unpack('<H', data[target_offset+2:target_offset+4])[0]
        word2 = struct.unpack('<H', data[target_offset+4:target_offset+6])[0]
        
        print(f"  MOV.W words: 0x{word1:04X} 0x{word2:04X}")
        
        rd, immediate, instr_type = decode_mov_w_t2(word1, word2)
        
        if rd is not None:
            print(f"  Decoded: {instr_type} R{rd}, #{immediate} OK")
            
            if rd == 1 and immediate == 1488:
                print("  Target instruction found! OK")
                
                # Test ADR detection
                if data[target_offset + 7] == 0xA0:
                    adr_imm = data[target_offset + 6] & 0xFF
                    print(f"  ADR R0, #{adr_imm} found OK")
                    
                    # Calculate where ADR points
                    adr_pc = ((target_offset + 6 + 4) & ~3)
                    
                    for base in [0x08000000, 0x08020000, 0]:
                        runtime_pc = base + adr_pc
                        target = runtime_pc + (adr_imm * 4)
                        file_offset = target - base
                        
                        if 0 <= file_offset < len(data):
                            check_data = data[file_offset:file_offset+20]
                            if b'SOFT_VERSION' in check_data:
                                print(f"  ADR points to SOFT_VERSION! OK")
                                print("  *** COMPLETE PATTERN VERIFIED ***")
                                return True
    
    return False

def simple_search(filepath):
    """Simple byte-by-byte search for the complete pattern."""
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print("\nSearching for complete patterns...")
    
    found_count = 0
    
    for offset in range(len(data) - 8):
        # Look for PUSH {R4,LR}
        if data[offset:offset+2] == b'\x10\xB5':
            # Check if followed by our specific MOV.W pattern
            if data[offset+2:offset+6] == b'\x4F\xF4\xBA\x61':
                # Check if followed by ADR R0
                if offset + 7 < len(data) and data[offset+7] == 0xA0:
                    print(f"Found complete pattern at 0x{offset:08X}")
                    found_count += 1
    
    print(f"Total patterns found: {found_count}")
    return found_count > 0

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin"
    
    print("=== Testing Pattern Recognition ===")
    test_pattern_search(filepath)
    
    print("\n=== Simple Pattern Search ===")
    simple_search(filepath)