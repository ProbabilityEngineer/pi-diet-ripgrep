# pi-diet-ripgrep

A minimal Pi extension that exposes ripgrep as a first-class exact-search tool.

## Files

- `index.ts` — extension entrypoint
- `spec.md` — design spec
- `scripts/estimate_prompt_footprint.py` — rough prompt-cost estimator

## Installation

After the package is published to npm:

```bash
pi install npm:pi-diet-ripgrep
```

For a pinned GitHub install:

```bash
pi install git:github.com/ProbabilityEngineer/pi-diet-ripgrep@v0.1.0
```

For local development:

```bash
pi -e /path/to/pi-diet-ripgrep/index.ts
```

Or symlink/copy into an auto-discovered extension location:

```bash
mkdir -p ~/.pi/agent/extensions/pi-diet-ripgrep
ln -sf /path/to/pi-diet-ripgrep/index.ts ~/.pi/agent/extensions/pi-diet-ripgrep/index.ts
```

## Publishing

First publish manually once:

```bash
npm publish --access public
```

Then configure npm Trusted Publishing for GitHub Actions on npmjs.com using this repository and `.github/workflows/npm-publish.yml`.

After trusted publishing is configured, publish future versions by bumping `package.json` and pushing a matching version tag:

```bash
npm version patch --no-git-tag-version
git commit -am "Release v0.1.1"
git tag v0.1.1
git push && git push origin v0.1.1
```

## Tool

`rg` is intended for exact text and regex search only.
