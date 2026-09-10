# Documentation Standards

Guidelines for writing and updating documentation across the team:

## Formatting & Structure
- Use standard GitHub Flavored Markdown (GFM).
- Every directory under `docs/` must contain a `README.md` that serves as an index and explains the purpose of the directory.
- For architectural and flow diagrams, use **Mermaid** code blocks (````mermaid ... ````) rather than proprietary binary formats or external image links. This ensures diagrams are git-diffable and render automatically on GitHub/GitLab.

## Link Integrity
- All cross-references must use relative Markdown links with the forward slash separator (e.g., `[Overview](../architecture/00-system-overview.md)`).
- Never link to localhost or machine-local file paths.
- Test links by running `python3 scripts/validate_docs.py`.
