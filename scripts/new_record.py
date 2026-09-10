#!/usr/bin/env python3
"""Cross-platform scaffolding CLI for new ADRs, RFCs, PRDs, and Handoffs.

Usage:
    python3 scripts/new_record.py adr "use-postgresql"
    python3 scripts/new_record.py rfc "caching-layer"
    python3 scripts/new_record.py prd "billing-flow"
    python3 scripts/new_record.py handoff "end-of-day-wrapup"
"""

import argparse
import datetime
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

CONFIGS = {
    "adr": {
        "dir": os.path.join(REPO_ROOT, "docs", "memory", "decisions"),
        "template": os.path.join(REPO_ROOT, "docs", "templates", "adr-template.md"),
        "prefix_len": 4,
        "type_name": "ADR",
    },
    "rfc": {
        "dir": os.path.join(REPO_ROOT, "docs", "design", "rfcs"),
        "template": os.path.join(REPO_ROOT, "docs", "templates", "rfc-template.md"),
        "prefix_len": 4,
        "type_name": "RFC",
    },
    "prd": {
        "dir": os.path.join(REPO_ROOT, "docs", "requirements", "prds"),
        "template": os.path.join(REPO_ROOT, "docs", "templates", "prd-template.md"),
        "prefix_len": 4,
        "type_name": "PRD",
    },
    "handoff": {
        "dir": os.path.join(REPO_ROOT, "docs", "tasks", "handoffs"),
        "template": os.path.join(REPO_ROOT, "docs", "templates", "handoff-template.md"),
        "prefix_len": 0,
        "type_name": "Handoff",
    },
}


def slugify(text: str) -> str:
    """Convert text into a clean kebab-case filename."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text.strip("-")


def get_next_number(directory: str, prefix_len: int) -> int:
    """Find the next sequential number in the target directory."""
    if not os.path.exists(directory):
        return 1

    pattern = re.compile(rf"^(\d{{{prefix_len}}})-.*\.md$")
    highest = 0
    for filename in os.listdir(directory):
        match = pattern.match(filename)
        if match:
            num = int(match.group(1))
            if num > highest:
                highest = num
    return highest + 1


def create_record(record_type: str, title: str) -> str:
    cfg = CONFIGS[record_type]
    target_dir = cfg["dir"]
    os.makedirs(target_dir, exist_ok=True)

    today = datetime.date.today().isoformat()
    slug = slugify(title)

    if record_type == "handoff":
        filename = f"{today}-{slug}.md"
        doc_number_str = today
    else:
        next_num = get_next_number(target_dir, cfg["prefix_len"])
        doc_number_str = f"{next_num:0{cfg['prefix_len']}d}"
        filename = f"{doc_number_str}-{slug}.md"

    target_path = os.path.join(target_dir, filename)
    if os.path.exists(target_path):
        print(f"Error: File already exists at {target_path}", file=sys.stderr)
        sys.exit(1)

    template_path = cfg["template"]
    if os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = f"# {cfg['type_name']}-{doc_number_str}: {title}\n\n- **Date**: {today}\n"

    # Replace placeholders
    content = content.replace("[NUMBER]", doc_number_str)
    content = content.replace("YYYY-MM-DD", today)
    content = re.sub(r"\[.*Title.*\]", title.replace("-", " ").title(), content)

    with open(target_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    rel_path = os.path.relpath(target_path, REPO_ROOT).replace("\\", "/")
    print(f"Successfully created {cfg['type_name']} record:")
    print(f"  -> {rel_path}")
    return target_path


def main():
    parser = argparse.ArgumentParser(
        description="Cross-platform record scaffolding tool for ADRs, RFCs, PRDs, and Handoffs."
    )
    parser.add_argument(
        "type",
        choices=["adr", "rfc", "prd", "handoff"],
        help="Type of document to create",
    )
    parser.add_argument("title", help="Title or slug of the document")

    args = parser.parse_args()
    create_record(args.type, args.title)


if __name__ == "__main__":
    main()
