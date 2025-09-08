#!/usr/bin/env python3

with open("c:\\Users\\me\\Downloads\\ac_app_1488_0306.bin", 'rb') as f:
    data = f.read()

target_offset = 0x20940
bytes_at_target = data[target_offset:target_offset+2]
print(f"Actual bytes: {bytes_at_target}")
print(f"Actual bytes hex: {' '.join(f'{b:02X}' for b in bytes_at_target)}")
print(f"Expected: {b'\\x10\\xB5'}")
print(f"Expected hex: {' '.join(f'{b:02X}' for b in b'\\x10\\xB5')}")
print(f"Equal: {bytes_at_target == b'\\x10\\xB5'}")

# Try different representations
push_pattern1 = bytes([0x10, 0xB5])
push_pattern2 = b'\x10\xB5'

print(f"Pattern1: {push_pattern1}")
print(f"Pattern2: {push_pattern2}")
print(f"Match1: {bytes_at_target == push_pattern1}")
print(f"Match2: {bytes_at_target == push_pattern2}")