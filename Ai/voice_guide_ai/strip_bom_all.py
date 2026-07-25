"""Strip UTF-8 BOM from every *.json file in the project tree."""
import pathlib, json, sys

root = pathlib.Path(__file__).resolve().parent
BOM = b"\xef\xbb\xbf"
fixed, clean, invalid, errors = [], [], [], []

for f in sorted(root.rglob("*.json")):
    try:
        raw = f.read_bytes()
        if raw.startswith(BOM):
            raw = raw[3:]
            f.write_bytes(raw)
            fixed.append(f)
        else:
            clean.append(f)
        # Validate JSON
        try:
            json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            invalid.append((f, str(e)))
    except Exception as e:
        errors.append((f, str(e)))

print(f"Scanned      : {len(fixed)+len(clean)+len(errors)}")
print(f"BOM stripped : {len(fixed)}")
print(f"Already clean: {len(clean)}")
print(f"Invalid JSON : {len(invalid)}")
print(f"Read errors  : {len(errors)}")

if fixed:
    print("\nFixed:")
    for p in fixed:
        print(f"  [FIXED] {p.relative_to(root)}")

if invalid:
    print("\nInvalid JSON (after BOM strip):")
    for p, reason in invalid:
        print(f"  [FAIL]  {p.relative_to(root)}")
        print(f"          {reason}")

if errors:
    print("\nRead/Write errors:")
    for p, reason in errors:
        print(f"  [ERROR] {p}")
        print(f"          {reason}")

print("\nDone.")
sys.exit(0 if not invalid and not errors else 1)
