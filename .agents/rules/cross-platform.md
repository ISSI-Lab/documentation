# Cross-Platform Rules

These rules ensure projects function identically whether developed on macOS, Ubuntu/Debian Linux, Windows 10/11 (PowerShell or WSL), or cloud dev containers.

## 1. File & Directory Naming
- Use only lowercase alphanumeric characters and hyphens (`[a-z0-9-]`).
- Avoid spaces, underscores in document titles, or mixed capitalization to prevent collisions on case-insensitive filesystems (macOS APFS and Windows NTFS).

## 2. Line Endings
- All text files must use Unix-style line feeds (`LF`, `\n`).
- Git attributes (`.gitattributes`) enforce this automatically, but editors should be configured to use LF.

## 3. Path Formats
- Always use forward slashes (`/`) in import statements, markdown links, dockerfiles, and scripts.
- Never rely on Windows backslashes (`\`).

## 4. Machine State Isolation
- Secrets and machine-local configurations belong in `.env` (copied from `.env.example`).
- Never check credentials, tokens, or machine-specific connection strings into Git.
- Use `docs/memory/local/` for private developer scratchpads.
