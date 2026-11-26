# Beeper-Frontend

The website for **Beeper** (beeper.buzz) and the Beeper Δ8: the store, the creator marketplace
and creator portal, the library, the glTF visualizers and the "get the app" callouts. It is a
fork of the DNA boilerplate [`1instinct/dna-frontend`](https://github.com/1instinct/dna-frontend)
(Next.js 13.1 Pages Router, React 18.2, Tailwind CSS and shadcn/ui) and reads
`Beeper-Buzz/Beeper-Admin` through the Spree Storefront API. Inherited conventions are in
[.github/copilot-instructions.md](.github/copilot-instructions.md) and
[LLM-CONTEXT.md](LLM-CONTEXT.md), which still say "DNA Frontend" because they come from
upstream; this file says what is different about the fork.

## Where this repo sits

| Layer | Repos |
|---|---|
| Upstream boilerplate (product agnostic) | `1instinct/dna-frontend` (this repo's upstream), `1instinct/dna-admin`, `1instinct/expo-juce` |
| Beeper | **Beeper-Frontend** (this repo), `Beeper-Buzz/Beeper-Admin` (fork of dna-admin, the backend), `Beeper-Buzz/BeeperNative` (the iOS app, uses expo-juce), `Beeper-Buzz/device-rtos` (Δ8 firmware) |

## What goes here, and what goes upstream

1. Only Beeper-specific work lands here: Beeper branding, copy, theme and URLs, the Δ8 and its
   hardware ideas, the marketplace's digital kinds and visualizers, the app callouts and
   anything that only makes sense for Beeper.
1. A feature any product on DNA could use is built in `dna-frontend` first and reaches this
   repo through an upstream merge. If it has a Beeper layer, the generic component or hook goes
   upstream and the Beeper parts are added here on top of it.
1. A bug in inherited code is fixed upstream and merged down, not patched only here.

## Keeping Beeper code separate from inherited code

Upstream merges stay easy when Beeper code lives in files upstream never has.

1. Prefer a new component, hook or `lib/` module to editing an inherited one; when an inherited
   file has to change, keep the change small and say why in the commit.
1. Beeper's look comes from the theme (`tailwind.config.ts`, `styles/globals.css`) and from env
   vars, not from rewriting inherited markup.
1. `lib/gltfVisualizer/core`, its `fixtures/` and `*.json` are byte-for-byte copies of the
   workspace's `specs/gltf-visualizer`; see LLM-CONTEXT.md before touching them.

## Merging upstream

```
git remote add upstream https://github.com/1instinct/dna-frontend.git   # once
git fetch upstream main
git merge upstream/main
```

Upstream is product agnostic, so a merge can replace Beeper values in shared files with
neutral ones. Keep the Beeper side in those conflicts, and check that nothing Beeper relies on
was deleted.

## Working here

1. `main` is the trunk; branch from it and open PRs against it.
1. Do not upgrade the frozen dependencies: `next@13.1.1`, `react@18.2.0` and the local
   `@spree/storefront-api-v2-sdk` tarball.
1. The Spree storefront key is server-only (`SPREE_ACCESS_TOKEN`, used by
   `pages/api/public/[...path].ts`); never expose it as `NEXT_PUBLIC_`.
1. Checks: `yarn test` (node:test suites listed explicitly in package.json; add new suites
   there), `yarn lint-check` (tsc and eslint) and `yarn build`.
1. App download links and the announcement banner are managed in the admin; the README's launch
   flip runbook covers them.

## Commits and PRs

No attribution lines (no `Co-Authored-By`, no generated-by footers). Lists use repeated `1.` so
items can be reordered without renumbering.

```
[Feature|Fix|Chore]: Sentence-case summary of the outcome, changes:
1. What changed, naming the file or symbol, and why
1. Next change
```

PR titles match the commit subject. PR bodies use `## What`, `## Why`, `## Changes` and
`## Verify` sections with `1.` lists. Say when a change has to go upstream first.
