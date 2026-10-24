# Agent Instructions

## Repository

- `pi-diet-ripgrep` is a minimal Pi extension exposing ripgrep as a first-class exact-search tool.
- Keep the extension focused on literal/exact search; text matches alone do not establish code structure, symbol identity, or behavior.

## Validation and release

- Run `npm run lint` and `npm run build`. Run `npm test` when `rg` is on PATH and a POSIX environment is available; otherwise report the missing test prerequisite rather than treating tests as passed.
- Validate package contents with `npm pack --dry-run`. The package still loads `index.ts`; `dist/` is an optional, ignored build artifact.
- Publication is tag-triggered: push a tested matching `v*` tag only after `main` is pushed.

## Version control

- Use normal Git workflows. Inspect `git status` and the diff before committing or pushing.

## Work tracking

- If the `clu` CLI is installed and the repository has an initialized store, use it as the authoritative source of project tasks and work state: run `clu ready`, claim the relevant task with `clu claim --context`, record notes there, and close completed work after validation.
- If `clu` is unavailable or uninitialized, continue without it and summarize work and outstanding items in the final response. Do not install or initialize optional tools merely to satisfy this guidance.
