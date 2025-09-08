#!/usr/bin/env python3
"""
Test pattern searching.
"""

def test_pattern_search(filepath):
    """Test if we can find the known pattern."""
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # We know this exact pattern exists at 0x20940
    known_pattern = bytes([0x10, 0xB5, 0x4F, 0xF4, 0xBA, 0x61, 0x13, 0xA0])
    
    print(f"Searching for known pattern: {' '.join(f'{b:02X}' for b in known_pattern)}")
    
    pos = data.find(known_pattern)
    if pos != -1:
        print(f"Found at offset 0x{pos:08X} - GOOD!")
    else:
        print("Not found - BAD!")
    
    # Now test the search logic
    print("\nTesting search logic:")
    
    for offset in range(pos - 2, pos + 2):
        if offset < 0 or offset + 8 > len(data):
            continue
            
        print(f"\nOffset 0x{offset:08X}:")
        
        # Check for PUSH
        if data[offset:offset+2] == bytes([0x10, 0xB5]):
            print(f"  PUSH found at offset {offset}")
            
            # Check for MOV.W
            if data[offset+2:offset+4] == bytes([0x4F, 0xF4]):
                print(f"  MOV.W pattern found at offset {offset+2}")
                
                # Check for ADR
                if offset + 7 < len(data) and data[offset+7] == 0xA0:
                    print(f"  ADR found at offset {offset+6}")
                    print(f"  *** COMPLETE PATTERN FOUND ***")

if __name__ == "__main__":
    import sys
    test_pattern_search(sys.argv[1])