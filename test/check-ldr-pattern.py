#!/usr/bin/env python3
"""
Check for LDR instructions that load version constants.
"""

import struct

def decode_ldr_instruction(data, offset):
    """Decode LDR instruction."""
    if offset + 1 >= len(data):
        return None
    
    instr = struct.unpack('<H', data[offset:offset+2])[0]
    
    # LDR Rd, [PC, #imm8] pattern: 01001 rd(3) imm8(8)
    if (instr & 0xF800) == 0x4800:
        rd = (instr >> 8) & 0x7
        imm8 = instr & 0xFF
        
        # Calculate target address
        pc = (offset + 4) & 0xFFFFFFFC  # PC is aligned
        target_addr = pc + (imm8 << 2)
        
        return {
            'type': 'LDR',
            'register': rd,
            'immediate': imm8,
            'target_addr': target_addr,
            'size': 2
        }
    
    return None

def check_ldr_patterns(filepath):
    """Check for LDR patterns that load version constants."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Checking LDR patterns in {filepath}")
    
    # Find where 1488 is stored as a constant
    target_1488 = struct.pack('<I', 1488)  # 32-bit little endian
    pos_1488 = data.find(target_1488)
    if pos_1488 != -1:
        print(f"Found 1488 constant at file offset 0x{pos_1488:08X}")
        
        # Calculate what the runtime address would be
        possible_bases = [0x08000000, 0x08020000, 0x20000000]
        for base in possible_bases:
            runtime_addr = base + pos_1488
            print(f"  Runtime address with base 0x{base:08X}: 0x{runtime_addr:08X}")
    
    print(f"\n=== Searching for LDR R1 instructions ===")
    
    ldr_r1_count = 0
    for offset in range(0, len(data) - 2, 2):
        ldr = decode_ldr_instruction(data, offset)
        
        if ldr and ldr['register'] == 1:  # LDR R1
            ldr_r1_count += 1
            
            # Calculate file offset from target address
            target_addr = ldr['target_addr']
            
            for base in possible_bases:
                if target_addr >= base:
                    file_offset = target_addr - base
                    
                    if 0 <= file_offset < len(data) - 4:
                        # Read the 32-bit value at this location
                        try:
                            value = struct.unpack('<I', data[file_offset:file_offset+4])[0]
                            
                            # Check if this could be a version number
                            if value in [1488, 103, 153] or (10 <= value <= 9999):
                                print(f"LDR R1, [PC, #{ldr['immediate']}] at 0x{offset:08X}")
                                print(f"  Points to 0x{target_addr:08X} -> file 0x{file_offset:08X}")
                                print(f"  Loads value: {value} (0x{value:X})")
                                
                                if value in [1488, 103, 153]:
                                    print(f"  *** TARGET VERSION VALUE ***")
                                
                                # Check what follows this LDR
                                next_offset = offset + 2
                                if next_offset + 1 < len(data):
                                    next_instr = struct.unpack('<H', data[next_offset:next_offset+2])[0]
                                    
                                    # Check if next is ADR R0
                                    if (next_instr & 0xF800) == 0xA000:
                                        rd = (next_instr >> 8) & 0x7
                                        if rd == 0:
                                            print(f"  *** Followed by ADR R0! ***")
                                            
                                            # Check what ADR points to
                                            adr_imm = next_instr & 0xFF
                                            adr_pc = (next_offset + 4) & 0xFFFFFFFC
                                            adr_target = adr_pc + (adr_imm << 2)
                                            
                                            for adr_base in possible_bases:
                                                if adr_target >= adr_base:
                                                    adr_file_offset = adr_target - adr_base
                                                    if 0 <= adr_file_offset < len(data) - 20:
                                                        adr_data = data[adr_file_offset:adr_file_offset+20]
                                                        if b'VERSION' in adr_data:
                                                            print(f"  *** ADR points to VERSION string! ***")
                                                            print(f"  String: {adr_data}")
                                print()
                        except:
                            pass
            
            if ldr_r1_count >= 20:  # Limit output
                break
    
    print(f"Total LDR R1 instructions checked: {ldr_r1_count}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python check-ldr-pattern.py <firmware.bin>")
        sys.exit(1)
    
    check_ldr_patterns(sys.argv[1])