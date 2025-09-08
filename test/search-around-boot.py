#!/usr/bin/env python3
"""
Search for instructions around the BOOT_VERSION string.
"""

import struct

def decode_thumb2_movt_movw(data, offset):
    if offset + 3 >= len(data):
        return None, None, None
    
    word1 = struct.unpack('<H', data[offset:offset+2])[0]
    word2 = struct.unpack('<H', data[offset+2:offset+4])[0]
    
    # Check for MOV.W immediate (T2 encoding) first
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

with open("c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin", 'rb') as f:
    data = f.read()

# Find BOOT_VERSION string
boot_version_pos = data.find(b'BOOT_VERSION')
print(f"BOOT_VERSION found at 0x{boot_version_pos:08X}")

# Search backwards from the BOOT_VERSION string for code patterns
print(f"\\nSearching for code patterns before BOOT_VERSION...")

search_start = max(0, boot_version_pos - 0x1000)  # Search 4KB back
search_end = boot_version_pos

found_patterns = []

for offset in range(search_start, search_end - 8, 2):
    # Look for PUSH {R4,LR}
    if data[offset:offset+2] == b'\\x10\\xB5':
        # Check for 32-bit MOV instruction
        rd, immediate, mov_type = decode_thumb2_movt_movw(data, offset + 2)
        
        if rd == 1 and immediate is not None:
            # Check for ADR R0
            if offset + 7 < len(data) and data[offset + 7] == 0xA0:
                adr_reg = (data[offset + 7] >> 0) & 0x7
                
                if adr_reg == 0:  # R0
                    adr_imm = data[offset + 6] & 0xFF
                    
                    # Calculate ADR target
                    adr_pc = ((offset + 6 + 4) & ~3)
                    
                    for base in [0x08000000, 0x08020000, 0]:
                        runtime_pc = base + adr_pc
                        target = runtime_pc + (adr_imm * 4)
                        file_offset = target - base
                        
                        # Check if points near BOOT_VERSION string
                        if abs(file_offset - boot_version_pos) < 100:
                            print(f"  Pattern at 0x{offset:08X}: {mov_type} R1, #{immediate} -> BOOT_VERSION")
                            found_patterns.append(immediate)
                            break

# Also check for MOVS patterns
for offset in range(search_start, search_end - 4):
    if offset + 1 < len(data) and data[offset + 1] == 0x21:  # MOVS R1, #imm8
        immediate = data[offset]
        
        # Check if followed by ADR R0
        if offset + 3 < len(data) and data[offset + 3] == 0xA0:
            adr_reg = (data[offset + 3] >> 0) & 0x7
            
            if adr_reg == 0:
                adr_imm = data[offset + 2]
                adr_pc = ((offset + 2 + 4) & ~3)
                
                for base in [0x08000000, 0x08020000, 0]:
                    runtime_pc = base + adr_pc
                    target = runtime_pc + (adr_imm * 4)
                    file_offset = target - base
                    
                    if abs(file_offset - boot_version_pos) < 100:
                        print(f"  MOVS at 0x{offset:08X}: MOVS R1, #{immediate} -> BOOT_VERSION")
                        found_patterns.append(immediate)
                        break

print(f"\\nFound version candidates: {set(found_patterns)}")

# Search further back if we didn't find 103
if 103 not in found_patterns:
    print(f"\\n103 not found, searching wider area...")
    search_start = max(0, boot_version_pos - 0x5000)  # Search 20KB back
    
    for offset in range(search_start, boot_version_pos - 0x1000, 100):  # Sample every 100 bytes
        if offset + 1 < len(data) and data[offset + 1] == 0x21 and data[offset] == 103:
            print(f"  Found MOVS R1, #103 at 0x{offset:08X}")
            
            # Check context
            context = data[max(0, offset-10):offset+10]
            print(f"    Context: {' '.join(f'{b:02X}' for b in context)}")