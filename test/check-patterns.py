#!/usr/bin/env python3

word1 = 0xF44F
word2 = 0x61BA

print(f"word1 = 0x{word1:04X} = {word1:016b}")
print(f"word2 = 0x{word2:04X} = {word2:016b}")

# Check MOVW T3: (word1 & 0xFB50) == 0xF040
movw_mask = 0xFB50
movw_pattern = 0xF040
movw_match = (word1 & movw_mask) == movw_pattern

print(f"\nMOVW T3 check:")
print(f"Mask:    0x{movw_mask:04X} = {movw_mask:016b}")
print(f"Pattern: 0x{movw_pattern:04X} = {movw_pattern:016b}")
print(f"Masked:  0x{word1 & movw_mask:04X} = {word1 & movw_mask:016b}")
print(f"Match: {movw_match}")

# Check MOV.W T2: (word1 & 0xFBEF) == 0xF04F
movw_t2_mask = 0xFBEF
movw_t2_pattern = 0xF04F
movw_t2_match = (word1 & movw_t2_mask) == movw_t2_pattern

print(f"\nMOV.W T2 check:")
print(f"Mask:    0x{movw_t2_mask:04X} = {movw_t2_mask:016b}")
print(f"Pattern: 0x{movw_t2_pattern:04X} = {movw_t2_pattern:016b}")
print(f"Masked:  0x{word1 & movw_t2_mask:04X} = {word1 & movw_t2_mask:016b}")
print(f"Match: {movw_t2_match}")

print(f"\nBoth match? MOVW={movw_match}, MOV.W={movw_t2_match}")
print("The issue is that MOVW check comes first, so it matches incorrectly!")