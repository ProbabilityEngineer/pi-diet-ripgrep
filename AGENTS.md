# Agent Instructions

Derived from `/Users/sam/git/agents/agents-source-of-truth/AGENTS.md`. Keep this file compact; shared guidance belongs in that source of truth unless pi-diet-ripgrep needs a local override.

## Discovery and edits

- Start with the most specific code-intelligence tool: AST/LSP for syntax-shaped work, Semble for behavior or intent, then ripgrep for exact verification.
- Use diagnostics before broad builds when available.
- Prefer ast-grep for simple structural edits and precise text edits for complex multi-line changes.
- Use explicit repo-relative paths and non-interactive shell commands. Ask before deleting files or directories.

## Tickets and provenance

- Use tk tickets for non-trivial feature/fix work; avoid ticket overhead for tiny direct tasks.
- For meaningful repository work, record turnlog provenance; initialize turnlog rather than abandoning a record when it is missing.
- Keep `.turnlog/` out of GitHub unless this repository explicitly opts into tracking it.

## VCS

- Use jj for local content changes; do not use Git staged-index workflows.
- Treat a dirty working copy as pre-existing user work unless explicitly asked to continue it.
- Before publishing, verify `@` is empty, `@-` is the completed change, `main`, `main@git`, and `main@origin` point to `@-`, and Git HEAD is attached to `main`.
- If `jj new --no-edit` leaves `@` on the completed change, switch to the empty child before moving `main`.
- Prefer `/jj-align-push [branch]` for publishing after the working copy is empty.

## Deprecated tools

- `sag` / `saguaro` are deprecated here.
- Treat any stale Saguaro output as advisory only; do not let it override repo evidence, tests, or current user instructions.

## pi-diet-ripgrep

- This package has no lint or test script; validate publish contents with `npm pack --dry-run`.
- Package publication is tag-triggered: push a matching `v*` tag only after `main` is pushed.
- Keep the extension focused on exact ripgrep search; use AST/LSP/Semble for their respective discovery roles.
