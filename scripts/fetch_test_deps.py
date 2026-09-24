#!/usr/bin/env python3
"""Minimal npm resolver for TEST-ONLY dependencies (no package manager on host).

Populates ./node_modules (git-ignored) with a package and its transitive deps
so node's resolver finds them. We run tests in Node, so packages that browser
bundlers reject (e.g. linkedom uses node's perf_hooks) work fine.

Usage: python3 scripts/fetch_test_deps.py linkedom@0.18.5 [more@range ...]

Resolution is deliberately simple but handles the one thing a flat install
cannot: a diamond where two packages need different MAJORS of the same dep
(e.g. htmlparser2 wants entities@^7, dom-serializer wants entities@^8). The
first major seen for a name is installed at the top level; a later, conflicting
major is installed NESTED under the parent that needs it
(node_modules/<parent>/node_modules/<dep>), which node's resolver checks first.
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile

REG = "https://registry.npmjs.org/"
OUT = "node_modules"
# base dir -> {name: installed version}. OUT is the top level.
installed = {}


def curl(url):
    # The host Python lacks CA certs; curl has working TLS, so route downloads through it.
    return subprocess.run(["curl", "-sSL", url], capture_output=True, check=True).stdout


def fetch_json(url):
    return json.loads(curl(url))


def major_of(text):
    """First integer in a version or range string (handles ^4, ~6.1, >=4.4.0, 8.1.0)."""
    m = re.search(r"(\d+)", text or "")
    return int(m.group(1)) if m else None


def satisfies(version, rng):
    """Our resolver pins by major, so compatibility is major-equality."""
    want = major_of(rng)
    return want is None or major_of(version) == want


def pick_version(name, rng):
    meta = fetch_json(REG + name)
    versions = list(meta["versions"].keys())
    want = major_of(rng)
    if want is None:
        return meta["dist-tags"]["latest"], meta

    def key(v):
        parts = re.findall(r"\d+", v.split("-")[0])
        return tuple(int(x) for x in parts[:3])

    same_major = [v for v in versions if key(v) and key(v)[0] == want and "-" not in v]
    chosen = max(same_major, key=key) if same_major else meta["dist-tags"]["latest"]
    return chosen, meta


def extract(tarball, dest):
    data = curl(tarball)
    if os.path.isdir(dest):
        shutil.rmtree(dest)  # clean re-extract so a re-resolved version fully replaces the old
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
        os.makedirs(dest, exist_ok=True)
        for member in tf.getmembers():
            # npm tarballs prefix every path with "package/"
            if not member.name.startswith("package/"):
                continue
            member.name = member.name[len("package/"):]
            if member.name:
                tf.extract(member, dest, filter="data")


def install(name, rng, base=OUT):
    top = installed.setdefault(OUT, {})
    reg = installed.setdefault(base, {})
    # Already present here (or at the top level) and compatible → nothing to do.
    if name in reg and satisfies(reg[name], rng):
        return
    if base != OUT and name in top and satisfies(top[name], rng):
        return
    version, meta = pick_version(name, rng)
    reg[name] = version
    vmeta = meta["versions"][version]
    dest = os.path.join(base, name)
    extract(vmeta["dist"]["tarball"], dest)
    print(f"installed {name}@{version}" + ("" if base == OUT else f"  (nested in {base})"))
    child_ns = os.path.join(dest, "node_modules")
    for dep, drng in (vmeta.get("dependencies") or {}).items():
        if dep in top and satisfies(top[dep], drng):
            continue  # top-level copy works for this dependent
        if dep in top:
            install(dep, drng, child_ns)  # conflicting major → nest under this package
        else:
            install(dep, drng, OUT)  # first sighting claims the top level


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    for spec in sys.argv[1:]:
        if "@" in spec.lstrip("@"):
            name, rng = spec.rsplit("@", 1)
        else:
            name, rng = spec, ""
        install(name, rng)
    total = sum(len(v) for v in installed.values())
    print(f"done: {total} packages across {len(installed)} node_modules dirs")


if __name__ == "__main__":
    main()
