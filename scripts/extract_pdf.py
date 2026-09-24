#!/usr/bin/env python3
"""Draft content extractor for Momentum.

Usage:
    python3 scripts/extract_pdf.py "<source.pdf>" <module-id> <accent-hex> <out.json>

Reads a course PDF with PyMuPDF (fitz) and writes two files:
    <out>.txt  full page-by-page text, for hand curation
    <out>      a ContentFile skeleton (module with empty topics/items)

PyMuPDF replaces the original pypdf+poppler plan: it extracts text AND can
rasterise pages (see export_diagrams.py) with no system `poppler` dependency,
which this machine lacks. The real content is authored by hand from the .txt.
"""
import sys
import os
import json
import fitz  # PyMuPDF


def main():
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(2)
    src, module_id, accent, out = sys.argv[1:5]
    doc = fitz.open(src)
    txt_path = os.path.splitext(out)[0] + ".txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        for i, page in enumerate(doc):
            f.write(f"\n===== PAGE {i + 1} =====\n")
            f.write(page.get_text())
    skeleton = {
        "version": 1,
        "module": {
            "id": module_id,
            "title": {"en": module_id, "es": module_id},
            "accent": accent,
            "topics": [],
            "items": [],
        },
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(skeleton, f, ensure_ascii=False, indent=2)
    print(f"wrote {txt_path} ({doc.page_count} pages) and skeleton {out}")


if __name__ == "__main__":
    main()
