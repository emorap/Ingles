#!/usr/bin/env python3
"""Build a portable, single-file `momentum.html`.

NO-BUILD toolchain: instead of a bundler we lean on web standards. Every ES
module reachable from `src/main.js` is base64-inlined as a `data:` module and
wired together through an inline <script type="importmap">. Relative import
specifiers are rewritten to stable bare keys (the module's repo-relative path)
that the import map resolves to the corresponding data: URL — so cross-module
imports keep working with zero relative-path resolution at runtime. The CSS and
the content JSON are inlined too (the content fetch is repointed at a data:
URL), yielding one self-contained file that runs from file:// or a share.

Interactive correctness (a real browser opening the file) is a manual check;
this script verifies the module graph is complete and every import resolves.
"""
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRY = os.path.join(ROOT, "src", "main.js")
CSS = os.path.join(ROOT, "src", "styles", "theme.css")
CONTENT = os.path.join(ROOT, "content", "tenses.json")
INDEX = os.path.join(ROOT, "index.html")
OUT = os.path.join(ROOT, "momentum.html")

# Matches the specifier in `from '...'` and side-effect `import '...'`, only
# when it is a relative path (starts with ./ or ../). Bare/URL specifiers and
# non-import strings (e.g. fetch('./x')) are left untouched.
IMPORT_RE = re.compile(r"""(\bfrom\s+|\bimport\s+)(['"])(\.\.?/[^'"]+)(['"])""")


def rel_key(path):
    """Stable bare-specifier key for a module = its repo-relative POSIX path."""
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def collect(entry):
    """DFS the relative-import graph from `entry`. Returns {abs_path: source}."""
    modules = {}
    stack = [entry]
    while stack:
        path = stack.pop()
        if path in modules:
            continue
        if not os.path.isfile(path):
            sys.exit(f"build: missing module {rel_key(path)}")
        src = open(path, encoding="utf-8").read()
        modules[path] = src
        for _, _, spec, _ in IMPORT_RE.findall(src):
            dep = os.path.normpath(os.path.join(os.path.dirname(path), spec))
            stack.append(dep)
    return modules


def rewrite_imports(path, src, keys):
    """Replace each relative specifier with its bare key from `keys`."""
    def repl(m):
        spec = m.group(3)
        dep = os.path.normpath(os.path.join(os.path.dirname(path), spec))
        if dep not in keys:
            sys.exit(f"build: unresolved import {spec!r} in {rel_key(path)}")
        return f"{m.group(1)}{m.group(2)}{keys[dep]}{m.group(4)}"
    return IMPORT_RE.sub(repl, src)


def data_url(mime, text):
    b64 = base64.b64encode(text.encode("utf-8")).decode("ascii")
    return f"data:{mime};base64,{b64}"


def main():
    modules = collect(ENTRY)
    keys = {path: rel_key(path) for path in modules}

    # Repoint the content fetch at an inlined data: URL so it works offline /
    # from file:// with no server.
    content_json = open(CONTENT, encoding="utf-8").read()
    content_url = data_url("application/json", content_json)

    imports = {}
    for path, src in modules.items():
        rewritten = rewrite_imports(path, src, keys)
        if path == ENTRY:
            rewritten = rewritten.replace("./content/tenses.json", content_url)
        imports[keys[path]] = data_url("text/javascript", rewritten)

    importmap = json.dumps({"imports": imports}, ensure_ascii=False)
    css = open(CSS, encoding="utf-8").read()
    entry_key = keys[ENTRY]

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0F172A" />
  <title>Momentum — Sigue el impulso</title>
  <style>
{css}
  </style>
  <script type="importmap">
{importmap}
  </script>
</head>
<body>
  <div id="app"></div>
  <script type="module">import {json.dumps(entry_key)};</script>
</body>
</html>
"""
    open(OUT, "w", encoding="utf-8").write(html)
    print(f"✓ {rel_key(OUT)} — {len(modules)} modules inlined, {len(html)} bytes")


if __name__ == "__main__":
    main()
