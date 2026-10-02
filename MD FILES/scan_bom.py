import sys, os, json
sys.stdout.write("Scanning voice_guide_ai JSON files...\n")
sys.stdout.flush()
bom = b'\xef\xbb\xbf'
bom_files = []
parse_errors = []
base = os.path.join(os.path.dirname(__file__), 'Ai', 'voice_guide_ai')
for root, dirs, files in os.walk(base):
    for fname in files:
        if not fname.endswith('.json'):
            continue
        fp = os.path.join(root, fname)
        try:
            raw = open(fp, 'rb').read(3)
            if raw == bom:
                bom_files.append(fp)
            else:
                try:
                    json.loads(open(fp, encoding='utf-8').read())
                except Exception as e:
                    parse_errors.append((fp, str(e)[:100]))
        except Exception as e:
            parse_errors.append((fp, str(e)[:100]))

sys.stdout.write(f"BOM files: {len(bom_files)}\n")
sys.stdout.write(f"Parse errors: {len(parse_errors)}\n")
for f in bom_files:
    sys.stdout.write(f"BOM: {f}\n")
for f, e in parse_errors:
    sys.stdout.write(f"ERR: {f} | {e}\n")
sys.stdout.flush()
