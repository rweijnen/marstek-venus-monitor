#!/usr/bin/env python3
import struct

def decode_thumb2_movt_movw(data, offset):
    if offset + 3 >= len(data):
        return None, None, None
    
    word1 = struct.unpack('<H', data[offset:offset+2])[0]
    word2 = struct.unpack('<H', data[offset+2:offset+4])[0]
    
    print(f"Decoding: word1=0x{word1:04X}, word2=0x{word2:04X}")
    
    # Check for MOVW (T3 encoding)
    if (word1 & 0xFB50) == 0xF040:
        print("Matched MOVW T3 encoding")
        i = (word1 >> 10) & 1
        imm4 = word1 & 0xF
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        immediate = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8
        return rd, immediate, 'MOVW'
    
    # Check for MOV.W immediate (T2 encoding) 
    if (word1 & 0xFBEF) == 0xF04F:
        print("Matched MOV.W T2 encoding")
        i = (word1 >> 10) & 1
        s = (word1 >> 4) & 1
        imm3 = (word2 >> 12) & 0x7
        rd = (word2 >> 8) & 0xF
        imm8 = word2 & 0xFF
        
        imm12 = (i << 11) | (imm3 << 8) | imm8
        print(f"imm12 = 0x{imm12:03X}")
        
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
    
    print("No match found")
    return None, None, None

with open("c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin", 'rb') as f:
    data = f.read()

target_offset = 0x20940 + 2  # Skip PUSH, go to MOV instruction
result = decode_thumb2_movt_movw(data, target_offset)
print(f"Result: {result}")