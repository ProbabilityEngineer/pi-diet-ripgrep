# pi-diet-ripgrep

> One of my diet context engineering and workflow extensions. Explore the complete collection: <https://www.npmjs.com/~probabilityengineer>

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

## Development and validation

Install a current Node.js release and `rg` (ripgrep), then run:

```bash
npm ci
npm run lint
npm run build
npm test
npm pack --dry-run
```

`lint` performs strict TypeScript checking of the extension and tests. `build`
optionally compiles the extension to ignored `dist/` output; Pi and the published
package continue to load `index.ts` directly.

Tests require a POSIX environment (macOS or Linux). They exercise the registered
tool with controlled subprocess fixtures plus a real `rg` integration test.
Coverage includes arguments and leading-dash patterns, formatting and context,
no matches, invalid regexes, missing executables, match/byte/line limits, complete
saved output, and self-contained tool guidance.

## Publishing

First publish manually once:

```bash
npm publish --access public
```

Then configure npm Trusted Publishing from the CLI:

```bash
npm trust github pi-diet-ripgrep \
  --repo ProbabilityEngineer/pi-diet-ripgrep \
  --file npm-publish.yml \
  --allow-publish
```

npm will open/print a browser authentication flow for 2FA approval. The workflow file name is `npm-publish.yml` because npm expects the file name inside `.github/workflows/`, not the full path.

After trusted publishing is configured, publish future versions by bumping `package.json` and pushing a matching version tag:

```bash
npm version patch --no-git-tag-version
git commit -am "Release v0.1.1"
git tag v0.1.1
git push && git push origin v0.1.1
```

## Tool

`rg` is intended for exact text and regex search: literal verification, logs, config keys, TODOs, and message lookup. Text matches alone do not establish symbol identity, code structure, or behavior. Its guidance does not assume other extensions are installed.
