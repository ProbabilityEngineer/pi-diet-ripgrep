#!/usr/bin/env python3
import json
import math

variants = {
    "v1_current": {
        "name": "rg",
        "description": "Exact text/regex search with ripgrep. Use for literal search, not semantic or structural discovery.",
        "parameters": {
            "query": "string",
            "paths": ["string"],
            "glob": ["string"],
            "caseSensitive": "boolean",
            "word": "boolean",
            "context": "integer",
            "maxMatches": "integer",
        },
    },
    "v1_tighter": {
        "name": "rg",
        "description": "Exact text/regex search with ripgrep.",
        "parameters": {
            "query": "string",
            "paths": ["string"],
            "glob": ["string"],
            "word": "boolean",
            "maxMatches": "integer",
        },
    },
    "richer": {
        "name": "rg",
        "description": "Exact text/regex search with ripgrep. Use for literal verification, logs, config keys, TODOs, and message lookup. Prefer LSP/AST/Semble for symbol, structural, or semantic discovery.",
        "parameters": {
            "query": "string",
            "paths": ["string"],
            "glob": ["string"],
            "caseSensitive": "boolean",
            "word": "boolean",
            "context": "integer",
            "maxMatches": "integer",
            "hidden": "boolean",
            "fixedStrings": "boolean",
        },
    },
}

for name, payload in variants.items():
    compact = json.dumps(payload, separators=(",", ":"))
    chars = len(compact)
    approx_tokens = math.ceil(chars / 4)
    print(f"{name}: chars={chars} approx_tokens={approx_tokens}")
    print(compact)
    print()
