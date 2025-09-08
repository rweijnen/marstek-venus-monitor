#!/usr/bin/env python3

with open("c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin", 'rb') as f:
    data = f.read()

target_offset = 0x20940

print("Debugging ADR instruction:")
print(f"Byte at offset+6: 0x{data[target_offset + 6]:02X}")
print(f"Byte at offset+7: 0x{data[target_offset + 7]:02X}")

adr_byte = data[target_offset + 6]
print(f"ADR byte: 0x{adr_byte:02X} = {adr_byte:08b}")

adr_reg = (adr_byte >> 3) & 0x7
adr_imm = adr_byte & 0xFF

print(f"Extracted adr_reg: {adr_reg}")
print(f"Extracted adr_imm: {adr_imm}")
print(f"adr_reg == 0: {adr_reg == 0}")

# The pattern should be: 13 A0
# 13 = 0001 0011
# Bits 3-5 are the register: (0001 0011 >> 3) & 0x7 = 0010 & 0111 = 2
# So adr_reg should be 2, not 0!

print(f"\nCorrect ADR decoding:")
print(f"ADR register field (bits 3-5): {(adr_byte >> 3) & 0x7}")
print(f"ADR immediate field (bits 0-7): {adr_byte & 0xFF}")

# For ADR R0, the register field should be 0
# But we have 13 = 0001 0011, so reg field = 010 = 2
# This means it's ADR R2, not ADR R0!

# Wait, let me check the ADR encoding
# ADR Rd, label is encoded as: 1010 0 Rd imm8
# So for "13 A0", we have:
# 13 = 0001 0011 (this is the immediate)  
# A0 = 1010 0000 (this is 1010 0 000 where 000 is R0)

print(f"\nCorrect interpretation:")
print(f"13 A0 = ADR R0, #19")
print(f"Register is in the A0 byte: {(data[target_offset + 7] >> 0) & 0x7} = {(0xA0 >> 0) & 0x7}")