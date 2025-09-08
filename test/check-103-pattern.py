#!/usr/bin/env python3
"""
Check the context around the MOVS R1, #103 instruction.
"""

with open("c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin", 'rb') as f:
    data = f.read()

target_offset = 0x26984
print(f"Checking context around MOVS R1, #103 at 0x{target_offset:08X}")

# Show bytes around this offset
start = target_offset - 8
end = target_offset + 8
context_bytes = data[start:end]

print(f"Context bytes (0x{start:08X} to 0x{end:08X}):")
for i, b in enumerate(context_bytes):
    offset = start + i
    marker = " <--" if offset == target_offset else ""
    print(f"  0x{offset:08X}: 0x{b:02X}{marker}")

# Check if preceded by PUSH
if target_offset >= 2:
    prev_bytes = data[target_offset-2:target_offset]
    print(f"\nPrevious 2 bytes: {' '.join(f'{b:02X}' for b in prev_bytes)}")
    if prev_bytes == b'\x10\xB5':
        print("  Preceded by PUSH {R4,LR}!")

# Check the MOVS instruction
movs_bytes = data[target_offset:target_offset+2]
print(f"MOVS bytes: {' '.join(f'{b:02X}' for b in movs_bytes)}")
if movs_bytes == b'\x67\x21':  # 103 = 0x67, 0x21 = MOVS R1
    print("  Confirmed MOVS R1, #103")

# Check if followed by ADR
if target_offset + 3 < len(data):
    next_bytes = data[target_offset+2:target_offset+4]
    print(f"Next 2 bytes: {' '.join(f'{b:02X}' for b in next_bytes)}")
    if next_bytes[1] == 0xA0:  # ADR pattern
        print(f"  Followed by ADR R0, #{next_bytes[0]}")
        
        # Check what the ADR points to
        adr_imm = next_bytes[0]
        adr_pc = ((target_offset + 2 + 4) & ~3)
        
        for base in [0x08000000, 0x08020000, 0]:
            runtime_pc = base + adr_pc
            target_addr = runtime_pc + (adr_imm * 4)
            file_offset = target_addr - base
            
            if 0 <= file_offset < len(data):
                check_data = data[file_offset:file_offset+20]
                if b'BOOT_VERSION' in check_data or b'VERSION' in check_data:
                    print(f"    ADR points to version string at 0x{file_offset:08X}")
                    print(f"    Content: {check_data}")
                    break