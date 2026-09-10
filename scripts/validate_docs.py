#!/usr/bin/env python3
"""Cross-platform documentation validator.

Checks:
1. All internal relative markdown links resolve to valid target files.
2. All documentation filenames adhere to cross-platform naming (kebab-case, no spaces).
3. Text files have normalized LF line endings.

Usage:
    python3 scripts/validate_docs.py
"""

import os
import re
import sys
import urllib.parse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_DIR = os.path.join(REPO_ROOT, "docs")

LINK_PATTERN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
ALLOWED_FILENAME_PATTERN = re.compile(r"^([a-z0-9._-]+|README\.md|LICENSE)$")


def check_filenames() -> list[str]:
    """Ensure all filenames in docs/ adhere to cross-platform kebab-case."""
    errors = []
    for root, dirs, files in os.walk(DOCS_DIR):
        # Skip gitignored local memory
        if "local" in root.split(os.sep):
            continue
        for name in files + dirs:
            if name == ".gitkeep":
                continue
            if not ALLOWED_FILENAME_PATTERN.match(name):
                rel_path = os.path.relpath(os.path.join(root, name), REPO_ROOT).replace("\\", "/")
                errors.append(
                    f"Invalid filename (must be lowercase alphanumeric with hyphens): {rel_path}"
                )
    return errors


def check_markdown_links() -> list[str]:
    """Verify all internal relative markdown links."""
    errors = []
    md_files = []

    # Collect markdown files
    for root, dirs, files in os.walk(DOCS_DIR):
        if "local" in root.split(os.sep):
            continue
        for f in files:
            if f.endswith(".md"):
                md_files.append(os.path.join(root, f))

    for root_file in [
        os.path.join(REPO_ROOT, "README.md"),
        os.path.join(REPO_ROOT, "AGENTS.md"),
        os.path.join(REPO_ROOT, "GEMINI.md"),
    ]:
        if os.path.exists(root_file):
            md_files.append(root_file)

    for md_path in md_files:
        rel_md = os.path.relpath(md_path, REPO_ROOT).replace("\\", "/")
        with open(md_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        for match in LINK_PATTERN.finditer(content):
            _, raw_url = match.groups()
            raw_url = raw_url.strip()

            # Ignore web links, mailto, anchor-only links
            if (
                raw_url.startswith("http://")
                or raw_url.startswith("https://")
                or raw_url.startswith("mailto:")
                or raw_url.startswith("#")
            ):
                continue

            # Strip anchor if present
            url_no_anchor = raw_url.split("#")[0]
            if not url_no_anchor:
                continue

            # Unquote URL encoding
            decoded_path = urllib.parse.unquote(url_no_anchor)

            # Resolve relative path
            target_dir = os.path.dirname(md_path)
            resolved_target = os.path.normpath(os.path.join(target_dir, decoded_path))

            if not os.path.exists(resolved_target):
                errors.append(
                    f"Broken link in {rel_md}: '{raw_url}' -> unresolved target: {os.path.relpath(resolved_target, REPO_ROOT).replace(chr(92), '/')}"
                )

    return errors


def check_line_endings() -> list[str]:
    """Verify text files have LF line endings without carriage returns."""
    errors = []
    for root, dirs, files in os.walk(DOCS_DIR):
        if "local" in root.split(os.sep):
            continue
        for f in files:
            if f.endswith((".md", ".txt", ".json", ".yaml", ".yml", ".py")):
                file_path = os.path.join(root, f)
                with open(file_path, "rb") as bf:
                    content = bf.read()
                    if b"\r\n" in content:
                        rel_path = os.path.relpath(file_path, REPO_ROOT).replace("\\", "/")
                        errors.append(f"Carriage return (CRLF) detected in {rel_path} (must be LF)")
    return errors


def main():
    print("Running cross-platform documentation verification...")
    all_errors = []

    filename_errors = check_filenames()
    if filename_errors:
        all_errors.extend(filename_errors)

    link_errors = check_markdown_links()
    if link_errors:
        all_errors.extend(link_errors)

    line_errors = check_line_endings()
    if line_errors:
        all_errors.extend(line_errors)

    if all_errors:
        print(f"\nFound {len(all_errors)} validation issue(s):", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    else:
        print("✓ All documentation links, filenames, and line endings are valid!")
        sys.exit(0)


if __name__ == "__main__":
    main()
