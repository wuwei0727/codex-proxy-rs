"""Audit the lockfile, with a guarded exception for unused SQLx SQLite code."""

import subprocess
import sys


def audit_arguments(tree):
    packages = {line.split()[0] for line in tree.splitlines() if line.strip()}
    if not packages:
        raise ValueError("Empty dependency tree; refusing to apply audit exceptions")
    sqlite_active = "libsqlite3-sys" in packages
    arguments = ["cargo-audit", "audit", "--file", "backend/Cargo.lock"]
    if not sqlite_active:
        # SQLx locks optional SQLite dependencies even for PostgreSQL-only builds.
        # RUSTSEC-2026-0459 requires opening an attacker-controlled SQLite/WAL pair.
        # Check all workspace features and platforms, including dev dependencies;
        # if SQLite ever becomes active, audit it normally (no exception).
        arguments.extend(["--ignore", "RUSTSEC-2026-0459"])
    return arguments


def main():
    result = subprocess.run(
        ["cargo", "tree", "--manifest-path", "backend/Cargo.toml",
         "--locked", "--workspace", "--all-features", "--target", "all",
         "--prefix", "none", "--format", "{p}", "--color", "never"],
        check=True, capture_output=True, text=True,
    )
    arguments = audit_arguments(result.stdout)
    if "--ignore" in arguments:
        print("RUSTSEC-2026-0459: SQLite is absent from the resolved dependency graph; "
              "applying the unused-dependency exception.", flush=True)
    return subprocess.run(arguments, check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
