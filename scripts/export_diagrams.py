#!/usr/bin/env python3
"""Rasterise selected PDF pages to PNG diagram assets (PyMuPDF, no poppler).

Usage:
    python3 scripts/export_diagrams.py "<source.pdf>" <prefix> [pages]

    pages: comma-separated 1-based page numbers, e.g. "5,23,36".
           Omit to export nothing (most modules are text-only).

Writes content/assets/<prefix>-<page>.png at ~150 DPI. Diagrams are optional
'realces' in Momentum — topics render fine without them, so this step never
blocks the pipeline.
"""
import sys
import os
import fitz  # PyMuPDF


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    src, prefix = sys.argv[1], sys.argv[2]
    pages = sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] else []
    os.makedirs("content/assets", exist_ok=True)
    doc = fitz.open(src)
    zoom = 150 / 72
    mat = fitz.Matrix(zoom, zoom)
    for pnum in pages:
        idx = int(pnum) - 1
        pix = doc[idx].get_pixmap(matrix=mat)
        path = f"content/assets/{prefix}-{pnum}.png"
        pix.save(path)
        print("wrote", path)
    if not pages:
        print("no pages requested; nothing exported")


if __name__ == "__main__":
    main()
