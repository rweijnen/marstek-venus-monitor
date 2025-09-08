#!/usr/bin/env python3
"""
Search for the exact opcode pattern from the disassembly.
"""

def find_exact_pattern(filepath):
    """Find the exact opcode pattern for version printing."""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Searching for exact opcode patterns in {filepath}")
    
    # Pattern from disassembly:
    # Code:08022940 10 B5                 PUSH {R4,LR}
    # Code:08022942 4F F4 BA 61          MOV.W R1, #0x5D0 (1488)  
    # Code:08022946 13 A0                ADR R0, string
    
    # The exact bytes to search for
    pattern_1488 = bytes([0x10, 0xB5, 0x4F, 0xF4, 0xBA, 0x61, 0x13, 0xA0])
    
    print(f"Searching for PUSH + MOV.W R1, #1488 + ADR pattern:")
    print(f"Pattern bytes: {' '.join(f'{b:02X}' for b in pattern_1488)}")
    
    pos = data.find(pattern_1488)
    if pos != -1:
        print(f"*** EXACT PATTERN FOUND at 0x{pos:08X} ***")
        
        # Show context
        start = max(0, pos - 16)
        end = min(len(data), pos + 32)
        context = data[start:end]
        
        print(f"Context around match:")
        for i in range(0, len(context), 16):
            line_start = start + i
            line_data = context[i:i+16]
            hex_str = ' '.join(f'{b:02X}' for b in line_data)
            ascii_str = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in line_data)
            
            marker = ""
            if line_start <= pos < line_start + 16:
                marker = " <- MATCH"
            
            print(f"{line_start:08X}: {hex_str:<48} |{ascii_str}|{marker}")
        
        # Calculate ADR target
        adr_offset = pos + 6  # ADR instruction is at offset +6
        adr_immediate = data[pos + 6] & 0xFF  # Get immediate from ADR instruction (13 A0 -> immediate = 0x13)
        
        # Calculate PC and target address
        pc = (adr_offset + 4) & 0xFFFFFFFC  # PC for ADR calculation
        
        # Try different base addresses
        possible_bases = [0x08000000, 0x08020000]
        for base in possible_bases:
            runtime_pc = base + pc
            adr_target = runtime_pc + (adr_immediate << 2)
            file_target = adr_target - base
            
            print(f"\nADR calculation with base 0x{base:08X}:")
            print(f"  ADR immediate: 0x{adr_immediate:02X}")
            print(f"  PC at ADR: 0x{runtime_pc:08X}")
            print(f"  ADR target: 0x{adr_target:08X}")
            print(f"  File offset: 0x{file_target:08X}")
            
            if 0 <= file_target < len(data) - 20:
                target_data = data[file_target:file_target+20]
                print(f"  Data at target: {target_data}")
                
                if b'SOFT_VERSION' in target_data:
                    print(f"  *** ADR POINTS TO SOFT_VERSION STRING! ***")
    else:
        print("Exact pattern not found")
    
    # Also search for variations - maybe different immediate values or slight variations
    print(f"\n=== Searching for PUSH + MOV.W R1 + ADR patterns with any immediate ===")
    
    # PUSH {R4,LR} = 10 B5
    # MOV.W R1, #imm = 4F F4 XX XX (where XX XX encodes the immediate) 
    # ADR R0, #imm = XX A0 (where XX is the immediate)
    
    push_movw_pattern = bytes([0x10, 0xB5, 0x4F, 0xF4])
    
    pos = 0
    count = 0
    while True:
        pos = data.find(push_movw_pattern, pos)
        if pos == -1:
            break
        
        # Check if followed by ADR R0 (XX A0 pattern)
        if pos + 7 < len(data):
            potential_adr = data[pos + 6:pos + 8]
            if potential_adr[1] == 0xA0:  # ADR R0 pattern
                # Extract immediate from MOV.W
                movw_bytes = data[pos + 4:pos + 6]  # XX XX part of MOV.W
                imm_low = movw_bytes[0]
                imm_high = movw_bytes[1]
                
                # Decode MOV.W immediate (simplified)
                # This is a complex encoding, but for our purposes, let's extract what we can
                immediate = ((imm_high & 0x7F) << 8) | imm_low
                
                print(f"Found PUSH + MOV.W R1, #{immediate} + ADR at 0x{pos:08X}")
                
                if immediate == 1488 or 100 <= immediate <= 2000:
                    print(f"  *** Interesting value: {immediate} ***")
                
                count += 1
                if count >= 10:
                    break
        
        pos += 1
    
    print(f"Found {count} PUSH + MOV.W + ADR patterns")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python find-exact-pattern.py <firmware.bin>")
        sys.exit(1)
    
    find_exact_pattern(sys.argv[1])