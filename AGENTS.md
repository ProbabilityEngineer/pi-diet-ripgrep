# Agent Instructions

## Repository

- `pi-diet-ripgrep` is a minimal Pi extension exposing ripgrep as a first-class exact-search tool.
- Keep the extension focused on literal/exact search; use AST, LSP, or Semble tools for structural, symbol, or semantic discovery.

## Validation and release

- There is no lint or test script; validate package contents with `npm pack --dry-run`.
- Publication is tag-triggered: push a tested matching `v*` tag only after `main` is pushed.

## Version control

- Use normal Git workflows. Inspect `git status` and the diff before committing or pushing.

## Work tracking

- Use `clu` as the authoritative source of project tasks and work state.
- At the start of substantial work, run `clu ready`, then use `clu claim --context` or claim the specifically requested task; read inherited context before editing.
- Put newly discovered work, notes, and dependencies in `clu`, not Markdown todo lists.
- Close completed work in `clu` after validation; leave incomplete or blocked work represented there.
