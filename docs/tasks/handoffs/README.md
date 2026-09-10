# Shift & Machine Handoff Logs

This directory contains chronological handoff logs created when a developer finishes a development session, hands off a feature to another teammate, or switches machines.

---

## Why Machine Handoffs?
When switching from one workstation to another (or across team handoffs):
- Context on uncommitted ideas or half-tested work is easily lost.
- Teammates in different timezones don't know the exact state of an active branch.
- AI coding assistants can read the latest handoff log to immediately know what to work on next.

---

## How to Create a Handoff Log
Run:
```bash
python3 scripts/new_record.py handoff "feature-or-topic-name"
```
Or copy [`template.md`](template.md) to `YYYY-MM-DD-<author>-<topic>.md` and commit it to your feature branch.
