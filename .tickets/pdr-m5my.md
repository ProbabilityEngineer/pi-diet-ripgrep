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
# Draft spec for minimal pi-diet-rg extension

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
