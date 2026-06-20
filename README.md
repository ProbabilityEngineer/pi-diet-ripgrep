# pi-diet-ripgrep

A minimal Pi extension that exposes ripgrep as a first-class exact-search tool.

## Files

- `index.ts` — extension entrypoint
- `spec.md` — design spec
- `scripts/estimate_prompt_footprint.py` — rough prompt-cost estimator

## Usage

Load directly:

```bash
pi -e /path/to/pi-diet-ripgrep/index.ts
```

Or symlink/copy into an auto-discovered extension location:

```bash
mkdir -p ~/.pi/agent/extensions/pi-diet-ripgrep
ln -sf /path/to/pi-diet-ripgrep/index.ts ~/.pi/agent/extensions/pi-diet-ripgrep/index.ts
```

## Tool

`rg` is intended for exact text and regex search only.
