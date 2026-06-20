---
id: pdr-m5my
status: in_progress
deps: []
links: []
created: 2026-06-20T14:34:58Z
type: task
priority: 2
assignee: Samuel Collins
tags: [spec, extension, rg, pi-diet]
---
# Draft spec for minimal pi-diet-ripgrep extension

Define a compact first-class ripgrep tool extension for Pi with minimal prompt footprint and structured exact-text search output.


## Notes

**2026-06-20T14:36:32Z**

Initialized local git/jj repo, turnlog, and tickets. Drafted initial spec in spec.md. GitHub public origin still needs repository creation and the target GitHub username/credentials.

**2026-06-20T14:47:16Z**

Created public GitHub repository ProbabilityEngineer/pi-diet-rg and configured origin. Updated .gitignore to ignore .DS_Store and finalized initial spec draft in spec.md.

**2026-06-20T15:03:22Z**

Implemented initial extension in index.ts and added a prompt-footprint estimator script. Rough compact JSON estimates: current variant ~71 tokens, tighter variant ~44, richer variant ~103 (chars/4 approximation).

**2026-06-20T15:43:17Z**

Adopted richer ~103-token variant as v1: routing-aware description plus hidden and fixedStrings parameters. Updated index.ts and spec.md; estimator confirms richer variant approx 103 tokens.

**2026-06-20T16:05:26Z**

Renamed public-facing project from pi-diet-rg to pi-diet-ripgrep for clarity to external users. Updated README/spec/temp prefix and will rename GitHub origin.

**2026-06-20T16:07:44Z**

Added package.json with pi-package metadata and pi.extensions manifest, added npm trusted-publishing workflow, README install/publish docs, and enabled GitHub Issues. npm pack --dry-run succeeded.

**2026-06-20T16:14:54Z**

Published package exists as pi-diet-ripgrep@0.1.0. Verified CLI setup command: npm trust github pi-diet-ripgrep --repo ProbabilityEngineer/pi-diet-ripgrep --file npm-publish.yml --allow-publish. Updated README; npm requires browser 2FA approval when run.

**2026-06-20T17:22:06Z**

Preparing provenance-backed v0.1.1 release: workflow has id-token: write and npm publish --provenance; bumped package.json to 0.1.1 before tag publish.

**2026-06-20T17:23:51Z**

v0.1.1 tag workflow failed with npm 404 after provenance statement generation. Adjusted repository.url to exact GitHub HTTPS URL and aligned workflow to npm trusted publishing docs; preparing v0.1.2 release.

**2026-06-20T17:24:52Z**

Provenance-backed publish succeeded for v0.1.2. GitHub Actions logged signed provenance statement and transparency log index 1885929426. npm latest is now 0.1.2. Normalized repository.url to git+https to avoid future warnings.
