# pi-diet-ripgrep spec

## Summary

`pi-diet-ripgrep` is a minimal Pi extension that exposes ripgrep as a first-class tool for exact text and regex search with a small prompt footprint.

The extension is intentionally "diet": it should add as little system-prompt overhead as possible while still being useful enough to prefer over raw `bash "rg ..."` for common literal-search workflows.

## Problem

Pi already supports:
- LSP for symbol-aware navigation
- AST tools for structural search
- Semble for semantic discovery
- `bash` for ad hoc `rg`

What is missing is a compact, structured, exact-text search tool that:
- is cheaper and safer than freeform shell use
- has consistent defaults
- returns structured results
- preserves a clear routing boundary: use `rg` for exact text, not semantic or structural discovery

## Goals

1. Expose a first-class ripgrep tool for exact text/regex search.
2. Keep added prompt footprint to roughly 100-200 tokens, ideally under 200.
3. Return concise structured output suitable for agent use.
4. Bound output size and support truncation safely.
5. Avoid duplicating guidance already covered by Pi's built-in search/routing instructions.

## Non-goals

- Replacing LSP, AST, or semantic tools.
- Becoming a full grep UI.
- Supporting every ripgrep flag.
- Adding large prompt instructions, examples, or verbose routing prose.

## Intended use

Use `rg` when the task needs:
- exact literals
- regex search
- finding strings, log messages, config keys, TODOs, identifiers by text
- quick scoped verification after semantic/AST discovery

Do not prefer `rg` for:
- definitions/references/types
- structural code patterns
- semantic behavior discovery

## Tool shape

### Name

`rg`

### Description

Short form only, e.g.:

> Exact text/regex search with ripgrep. Use for literal search, not semantic or structural discovery.

### Parameters

Keep the schema compact. Initial proposal:

- `query: string` — pattern to search for
- `paths?: string[]` — files/directories to search
- `glob?: string[]` — include globs
- `caseSensitive?: boolean`
- `word?: boolean` — word-boundary match
- `context?: number` — surrounding lines
- `maxMatches?: number` — hard cap on returned matches

Included in v1 because the prompt cost is acceptable:
- `hidden?: boolean` — include hidden files when explicitly requested
- `fixedStrings?: boolean` — treat query as a literal string instead of regex

## Output

Return:
- human-readable concise text summary
- structured details with matches

Suggested details shape:

```json
{
  "query": "TODO",
  "searchedPaths": ["."],
  "matchCount": 3,
  "truncated": false,
  "matches": [
    {
      "path": "src/a.ts",
      "line": 12,
      "column": 4,
      "text": "// TODO: tighten validation"
    }
  ]
}
```

## Execution behavior

Use `rg --json` under the hood so results are structured and easier to parse safely.

Default behavior:
- no color
- line numbers included
- column included when available
- cwd defaults to current Pi cwd
- if `paths` omitted, search `.`

## Truncation and limits

The tool must hard-bound output.

Initial rules:
- truncate text output at Pi's normal custom-tool limits
- cap returned structured matches with `maxMatches` defaulting to a small value, e.g. 50
- when truncated, say so explicitly
- if full output is preserved, write it to a temp file and report the path

## Prompt budget

Budget target:
- ideal: <= 150 tokens
- acceptable: <= 200 tokens
- avoid: > 250 tokens

Ways to stay within budget:
- one-sentence description
- short parameter descriptions
- no embedded examples in tool description
- no duplicated search-routing rules beyond one brief sentence

## Why this is justified

This tool should be used frequently enough for:
- exact literal search
- regex search
- log/error/message lookup
- config-key discovery
- post-discovery verification

That usage is common enough to justify a small first-class tool, but not a verbose extension.

## Success criteria

1. Tool prompt footprint stays within the budget.
2. Agent can use `rg` instead of raw `bash` for common exact-search tasks.
3. Results are safer and easier to parse than shell output.
4. The extension does not encourage misuse for semantic or structural search.
5. Implementation remains small and maintainable.

## Open questions

1. Should `fixedStrings` be included in v1 or omitted to save prompt/schema budget?
2. Should `hidden` be included in v1 or left to future expansion?
3. Should the tool expose only summary + first N matches, or always store full JSON in a temp file on truncation?
4. Should the extension also add a tiny prompt append, or rely entirely on the tool description?

## Recommended v1

Build the richer-but-still-diet version:
- `rg` tool only
- compact schema with `hidden` and `fixedStrings`
- routing-aware description that defers to LSP/AST/Semble
- `rg --json`
- structured matches
- small default result cap
- explicit truncation handling
- no extra prompt append unless measurement shows it is necessary
