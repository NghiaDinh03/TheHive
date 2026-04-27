#!/usr/bin/env python3
"""Release/version guardrails for TheHive platform.

Checks:
- APP_VERSION maps to the expected release_class.
- Documentation does not call 0.x migration builds production releases.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

RELEASE_CLASSES = {
    "migration-build": re.compile(r"^0\.\d+\.\d+-migration$"),
    "release-candidate": re.compile(r"^(?:v)?1\.0\.0-rc\.\d+$"),
    "product-release": re.compile(r"^v[1-9]\d*\.\d+\.\d+$"),
}

FORBIDDEN_ZERO_X_PRODUCTION = re.compile(
    r"(?i)(?:\b0\.\d+\.\d+(?:-[a-z0-9.-]+)?\b.{0,80}\bproduction\s+release\b|\bproduction\s+release\b.{0,80}\b0\.\d+\.\d+(?:-[a-z0-9.-]+)?\b)"
)

DEFAULT_DOC_GLOBS = ("*.md", "platform/**/*.md")
DEFAULT_EXCLUDES = (
    ".git",
    "node_modules",
    ".next",
    "platform/frontend/node_modules",
    "platform/frontend/.next",
)


def classify(app_version: str) -> str:
    for release_class, pattern in RELEASE_CLASSES.items():
        if pattern.match(app_version):
            return release_class
    return "development"


def is_excluded(path: Path, root: Path) -> bool:
    rel = path.relative_to(root).as_posix()
    return any(rel == exclude or rel.startswith(exclude.rstrip("/") + "/") for exclude in DEFAULT_EXCLUDES)


def iter_doc_files(root: Path, globs: list[str]) -> list[Path]:
    files: set[Path] = set()
    for glob in globs:
        for path in root.glob(glob):
            if path.is_file() and not is_excluded(path, root):
                files.add(path)
    return sorted(files)


def check_app_version(app_version: str, expected_release_class: str | None) -> list[str]:
    actual = classify(app_version)
    errors: list[str] = []
    if expected_release_class and actual != expected_release_class:
        errors.append(
            f"APP_VERSION {app_version!r} classified as {actual!r}, expected {expected_release_class!r}."
        )
    if actual == "development" and expected_release_class:
        errors.append(
            "Use 0.x.y-migration, 1.0.0-rc.x/v1.0.0-rc.x, or v1.x.y for release builds."
        )
    return errors


def check_docs(root: Path, globs: list[str]) -> list[str]:
    errors: list[str] = []
    for path in iter_doc_files(root, globs):
        text = path.read_text(encoding="utf-8", errors="replace")
        for line_no, line in enumerate(text.splitlines(), start=1):
            if FORBIDDEN_ZERO_X_PRODUCTION.search(line):
                rel = path.relative_to(root).as_posix()
                errors.append(
                    f"{rel}:{line_no}: do not describe 0.x migration builds as production releases: {line.strip()}"
                )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate release version semantics and docs wording.")
    parser.add_argument("--root", default=".", help="Repository root. Defaults to current directory.")
    parser.add_argument("--app-version", required=True, help="Build APP_VERSION to classify.")
    parser.add_argument(
        "--expected-release-class",
        choices=sorted([*RELEASE_CLASSES.keys(), "development"]),
        help="Expected release_class for APP_VERSION.",
    )
    parser.add_argument(
        "--doc-glob",
        action="append",
        dest="doc_globs",
        help="Markdown glob to scan. Can be repeated. Defaults to root docs and platform docs.",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    globs = args.doc_globs or list(DEFAULT_DOC_GLOBS)

    errors = []
    errors.extend(check_app_version(args.app_version, args.expected_release_class))
    errors.extend(check_docs(root, globs))

    if errors:
        print("Release validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Release validation passed: APP_VERSION={args.app_version} release_class={classify(args.app_version)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
