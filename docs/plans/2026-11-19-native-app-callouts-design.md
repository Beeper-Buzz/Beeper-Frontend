# Native app callouts and store links

**Date:** 2026-11-19
**Repos:** `beeper-frontend` (Beeper-Buzz/Beeper-frontend), `beeper-admin` (1instinct/dna-admin)
**Status:** design, awaiting approval

## Intent

Beeper now has a native app. Nothing on the storefront says so. As the beta gets
shared around, every visit to beeper.buzz is a missed install, and at launch the
same surfaces need to point at real store listings without a code change.

The work adds a reusable "get the Beeper app" callout to the storefront, puts it
on the surfaces people actually land on, and makes the global banner editable
from the admin so its copy can change without a deploy.

The design is **store-agnostic**: the links are configuration, not markup. Today
they resolve to the TestFlight beta. At launch they resolve to the App Store and
Play Store by changing environment values only.

## Goals

- A single callout component, used on the homepage, PDPs, the ComingSoon splash,
  and as a site-wide bar.
- Link targets flip from beta to store listings from the admin, with no deploy
  and no image rebuild. Env constants remain as a working fallback.
- Platforms appear only when they have a link. Android stays hidden until a Play
  beta or listing exists, then appears by setting one env value.
- The site-wide banner's copy, link, and on/off state are editable from
  dna-admin by a non-developer.

## Non-goals

- `apple-itunes-app` smart app banner. It needs a published App Store listing;
  there isn't one.
- Universal links, app links, or `beeper://` deep linking.
- Changing the "Beeper iOS App" catalog product (`components/Browse/Browse.tsx`)
  into a download link. It is a merchandised product and stays one.
- A new Rails model or migration in dna-admin.
- Any change to how the homepage orders its hardcoded sections.

## Anti-goals

These would make the work a failure even if it shipped:

- A "Download on the App Store" badge that leads nowhere. No dead store links,
  ever — a platform with no URL renders nothing.
- A banner that needs a deploy to turn off.
- Copy that implies Android availability before a Play build exists.
- A callout that pushes the app so hard it competes with the Δ8 pre-order, which
  is the storefront's actual revenue path.

## Constraints

Verified in the repos on 2026-11-19:

- **No public store listings exist.** `ascAppId 1661874489` (`BeeperNative/eas.json`)
  returns `resultCount: 0` from the iTunes lookup API, and
  `play.google.com/store/apps/details?id=com.beeper.Buzz` returns 404. The only
  live public link is the TestFlight invite used in
  `beeper-emails/campaigns/2026-11-app-announce`: `https://testflight.apple.com/join/Ys1jkVfk`.
  That campaign's own TODO notes TestFlight is iOS-only.
- **Env files are gitignored; prod env lives elsewhere.** `.env.development` and
  `.env.production` are both in `.gitignore` — only `.env.example` is tracked.
  `Dockerfile:35` runs `cp .env.development .env.production` before `yarn build`,
  so the local `.env.production` never reaches an image. Per `README.md:100-195`,
  the real values come from a base64 `secrets.yml` in the `dna-infra` repo, synced
  by `maintenance/sync-frontend-secrets.sh`, and **`NEXT_PUBLIC_*` values are
  inlined at build time** — changing one requires `make build-frontend`, not just
  `make deploy-frontend`.
- **Maintenance mode is OFF in prod** (confirmed by the owner, 2026-11-20). The
  full storefront is live, so the homepage, PDP, and global bar are all reachable
  by visitors today and are the surfaces to verify first. The local
  `.env.production` saying `true` is stale and misleading — `Dockerfile:35` copies
  `.env.development` over it, and that says `false`. ComingSoon stays in scope as
  a cheap fourth placement, but it is no longer what visitors see.
- **`NEXT_PUBLIC_SPREE_API_URL` is set correctly in the running build.**
  `admin.beeper.buzz` appears inlined in the live client chunks, so the
  `next.config.js` rewrite resolves to the real host in prod, not `localhost:8080`.
- **The admin is cross-origin and sends no CORS headers.** A request to
  `https://admin.beeper.buzz/api/v1/homepage_sections` with
  `Origin: https://beeper.buzz` returns 200 with no `access-control-*` headers, so
  a direct browser fetch is blocked. Server-side paths only.
- **The endpoint is live and empty.** That same request returns
  `{"response_code":200, ... "total_records":0, "homepage_sections":[]}` — it
  works, and there are currently no sections in prod.
- **Local `beeper-admin` is 117 behind / 31 ahead of `dna/@aaron.smulktis/develop`.**
  That branch name also exists on `origin`, `staging`, and `upstream` with
  different heads. `dna` (1instinct/dna-admin, head `197e206c`, 2026-11-16) is the
  most recently active and is the target; see "Calls I made". The admin branch must
  be cut from the remote, not local `HEAD`.
- **The existing badge PNGs are unusable.** `public/images/AppIcons/appstore.png`
  is 1024×1024 and `playstore.png` is 512×512 — square app icons, not the wide
  "Download on the App Store" / "Get it on Google Play" badge artwork. Official
  assets must be fetched.
- `components/Header/Header.tsx` is `sticky top-0 z-50`.
- Frontend is Next 13.1.1, Tailwind 3.4, shadcn/ui, react-query v3, framer-motion.
  House CTA is the `.neon-btn` class from `styles/synthwave.css`.

## Approaches

**A — Config constants, all placements hardcoded.** Constants in
`utilities/branding.ts`, one component, mounted by hand in four places. No admin
work. Rejected on its own because every copy change to the banner is a deploy,
and the banner is the part whose copy actually churns.

**C — Fully admin-driven.** A new Rails model (or `app_store_url` /
`play_store_url` columns on `Spree::Store`), admin screen, served through the
store endpoint; every surface reads from the API. Rejected: a migration, a
controller, three ERB views, a sidebar tab, and locale keys, to make values
editable that change roughly twice a year. It also adds to existing debt — the
`HomepageSection` admin already calls `Spree.t` keys that do not exist in
`config/locales/en.yml`.

**B — A, plus the banner comes from the admin. Chosen.** Store links stay in
config, where near-static values belong. The site-wide banner becomes a new
`announcement_bar` section type on the existing `HomepageSection` model — one
line, no migration, and it inherits the admin CRUD and the public
`/api/v1/homepage_sections` endpoint the frontend already consumes via
`hooks/useHomepage`. Editability lands where it is worth paying for. The review
raised the cost from "about an hour of Rails" to about half a day, because the
existing `settings` textarea is not usable by a non-developer (§4) — still well
short of C, and without C's migration or its new admin surface to maintain.

## Design

### 1. Link resolution (`beeper-frontend/utilities/branding.ts`)

The file is already the declared "single source of truth for storefront branding
strings … everything here is env-overridable." Two values are added, named by
*platform* rather than by store, so the beta-to-launch flip is a value change:

```ts
export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL || "https://testflight.apple.com/join/Ys1jkVfk";
export const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
```

A derived helper exports the list of links that actually exist. An empty string
means the platform is omitted entirely — this is the mechanism that keeps dead
badges off the page and lets Android appear without a code change.

The helper also decides presentation per link from the URL itself:

- host is `testflight.apple.com` → beta treatment: text pill, "Join the iOS beta"
- otherwise → store treatment: `appstore.png` badge, "Download on the App Store"
- Android mirrors this with `playstore.png`.

Consumers never branch on beta-vs-launch. They render whatever the helper
returns.

New vars are added to `.env.example` with comments (the only tracked env file) and
to the local `.env.development`. They must also be added to `secrets.yml` in
`dna-infra` and to `secret.example.yml` here, which `README.md:188` names as the
list of required `NEXT_PUBLIC_*` variables.

**These env values are the fallback, not the source of truth.** The authoritative
URLs come from the admin (§4a). Resolution order, per platform:

1. The admin's `app_links` record, if present and non-empty for that platform.
2. The env constant above.
3. Nothing — the platform is omitted.

The fallback exists so the storefront degrades to a working TestFlight link if the
admin is unreachable or returns nothing, which is also the state on day one.

**Launch-day procedure:** open the admin, edit the `app_links` record, paste the
App Store and Play URLs, save. No deploy, no rebuild, no PR. The badge treatment
switches by itself because the host is no longer `testflight.apple.com`.

### 2. The component (`beeper-frontend/components/AppCallout/`)

Follows the house convention: `AppCallout.tsx` + `index.ts` barrel, re-exported
from `components/index.ts`. One `variant` prop:

- `section` — full-width homepage band. Glass panel, framer-motion
  `initial/whileInView/viewport={{ once: true }}` reveal, matching
  `components/Home/ShopMarketplaceSplit`. Headline, one line of body, the link
  buttons.
- `inline` — compact single row for the PDP. Deliberately quiet: a short line of
  text plus the link buttons, no panel, no motion.
- `bar` — the site-wide bar. Single line, optional dismiss control.

A shared internal `AppStoreButtons` renders the links from the helper in §1, so
badge markup exists once.

### 3. Placements

| Surface | File | Position | Variant |
|---|---|---|---|
| Homepage | `components/Home/DynamicHome.tsx` | between `<SpecsGrid />` and `<Newsletter />` | `section` |
| PDP | `components/ProductDetails/RetailProductDetails.tsx` | directly after the Add to Cart button, inside the info panel | `inline` |
| Global bar | `pages/_app.tsx` | above `<Header />`, inside the shell flex column | `bar` |
| Splash | `components/ComingSoon/ComingSoon.tsx` | under the tagline, above `<SocialLinks />` | `section` or bare buttons, builder's call |

The bar renders in normal flow above the sticky header, so it scrolls away rather
than stacking. The header's own `top-0` is left alone.

`WholesaleProductDetails.tsx` is out of scope — `pages/[slug].tsx` never reaches
it.

### 4. The admin banner (`beeper-admin`, branched from `dna/@aaron.smulktis/develop`)

Add `announcement_bar` to `HomepageSection::SECTION_TYPES` in
`app/models/homepage_section.rb`. No migration — `settings` is a free-form JSON
column.

**The raw `settings` textarea is not usable and must be replaced for this type.**
`new.html.erb` and `edit.html.erb` render `f.text_area :settings`, and
`homepage_section_params` permits `:settings` as a scalar string into a `t.json`
column. On edit, Rails renders the stored Hash through `to_s` — `{"message"=>"x"}`
— which does not round-trip as JSON when submitted back. (This is why
`hooks/useHomepage/useHomepage.ts:59-79` carries a Ruby-hash-rocket repair parser.)
A single typo silently nulls the whole blob, and Goal 4 — a non-developer edits the
banner — cannot be met through it.

So the admin gets real fields for this section type: when `section_type` is
`announcement_bar`, the form renders `message`, `cta_label`, `cta_href`,
`dismissible`, `starts_at`, `ends_at` as discrete inputs, and the controller
composes them into `settings` as a proper Hash. Other section types keep the
existing textarea untouched — no behaviour change for anything that exists today.

Agreed `settings` shape:

```json
{
  "message": "The Beeper app beta is open on iPhone.",
  "cta_label": "Join the beta",
  "cta_href": "",
  "dismissible": true,
  "starts_at": null,
  "ends_at": null
}
```

An empty `cta_href` means the bar falls back to the iOS link from §1, so the
common case needs no URL in the admin at all.

Visibility is the model's existing `is_visible` flag, toggled from the admin list
screen. `starts_at` / `ends_at` are optional ISO strings honoured on the client.

**My call, included:** add the missing `homepage_section.*` keys to
`config/locales/en.yml`. The existing admin screen renders translation-missing
strings for its flash messages today; the new section type makes that screen more
visible, and the fix is a few lines.

### 4a. The admin-managed store links (`beeper-admin`)

A second section type, `app_links`, added to `SECTION_TYPES` alongside
`announcement_bar`. Same model, same admin CRUD, same endpoint, still no
migration. It is deliberately separate from the banner: the store URLs must not
depend on a promotional banner existing, being visible, or being in its date
window.

`settings` shape:

```json
{ "ios_url": "", "android_url": "" }
```

Like the banner, it gets real form fields rather than the JSON textarea. Empty
string means "fall back to env" (§1), which in turn means "omit the platform" if
env is empty too. Only the first visible `app_links` record by `position` is
read; the rest are ignored.

A seed creates one visible `app_links` row with both fields empty, so the record
exists and is editable before launch rather than having to be created under time
pressure on the day.

### 5. Reading the banner and the links (`beeper-frontend`)

One fetch serves both. `pages/_app.tsx` calls a new `hooks/useAppPresence/` once
(house hook layout: `useAppPresence.ts` + `index.ts`, key added to
`hooks/queryKeys.ts`, barrelled from `hooks/index.ts`) and publishes the result
through a React context provider wrapping the shell. All four placements read
from that context, so the homepage and PDP get admin-managed links without
fetching anything themselves.

The hook returns `{ banner, links }`: the first visible `announcement_bar` by
position, dropped if outside its date window, and the resolved per-platform links
from §1's resolution order.

**No empty first paint.** The query is seeded with `initialData` built from the
env constants, so every surface renders a working link immediately and the admin
response only replaces it if it differs. At launch this means a brief TestFlight
link before the App Store link takes over on the same page load — acceptable, and
the alternative (blocking on the fetch) causes layout shift on every visit
instead of on one day.

**Transport: the server-side proxy, not a direct fetch.** `homepage_sections` is
added to the allowlist in `pages/api/public/[...path].ts`, and the hook calls
`/api/public/homepage_sections?visible_only=true`. The admin sends no
`access-control-*` headers, so a browser request straight to `admin.beeper.buzz`
would fail; the proxy runs server-side with `SPREE_API_URL`, already sets cache
headers, and is explicitly scoped to read-only public endpoints — which this is.

Note that `useHomepage` is not a precedent to copy here: it has only ever run
server-side, seeded by `getStaticProps` in `pages/home.tsx`, so its client path is
effectively unexercised. The bar lives in `pages/_app.tsx` with no ISR seed and
would be the first real consumer of a client fetch.

Because both existing consumers swallow failure silently
(`fetchHomepage().catch(() => null)`; `console.warn` + `return null`), the builder
must confirm the proxy route returns data **before** relying on it, rather than
discovering a permanently empty bar later.

Failure is silent: no data, no network, or a malformed `settings` blob renders
nothing. The bar is never allowed to break the shell.

Dismissal, when `dismissible` is true, writes a `localStorage` key scoped to the
section's `updated_at`, so editing the banner in the admin re-shows it to people
who dismissed the previous one.

### 6. Branches

- `beeper-frontend`: `feat/app-callouts`, cut from `origin/main`. The current
  local branch is `feat/sentry-monitoring` — do not build on it.
- `beeper-admin`: `feat/app-callouts`, cut from `dna/@aaron.smulktis/develop`.

### 7. Cleanup, in scope

Delete `beeper-frontend/public/ipa/BeeperBuzz.ipa`. It is a 2.9 MB build artifact
served publicly, referenced by no code, and sideloading an `.ipa` is not a path
any visitor can use. Shipping app callouts next to a stray downloadable binary is
the wrong signal.

## Left to the builder

- Final copy for every surface. The design fixes structure, not words. The
  `beeper-emails/campaigns/2026-11-app-announce` copy is the tone to match.
- Exact spacing, type scale, and motion timings, within the existing homepage
  section conventions.
- Whether the PDP `inline` callout renders on every retail product or only on
  app-adjacent ones. Default to every retail product; narrow it if it reads as
  noise next to the Δ8.
- Test coverage following whatever the repo already does for components of this
  kind.

## Calls I made

Raised by the design review, settled without the owner. Each is reversible.

1. ~~Store URLs stay in config, not the admin.~~ **Overridden by the owner,
   2026-11-20: the launch flip must be admin-managed, with no image rebuild.**
   See §1 and §4a. Env constants survive as the fallback, so the storefront still
   works if the admin is unreachable, but the authoritative values live in the
   admin and take effect the moment they are saved.
2. **`dna` is the admin remote** (1instinct/dna-admin, head `197e206c`,
   2026-11-16), over `origin` (Beeper-Buzz/Beeper-Admin, `f95eadb2`, 2026-11-08).
   Chosen on recency of activity alone. Worth confirming before opening the PR,
   since it decides which fork the banner exists in.
3. **Real admin form fields rather than the JSON textarea** (§4). This is what
   moves the Rails side from roughly an hour to roughly half a day. Without it
   Goal 4 is not met.
4. **The banner fetches through the public proxy** (§5), forced by the missing
   CORS headers.
5. ~~Maintenance mode is treated as unknown.~~ **Resolved: off in prod.** All four
   placements ship and the first three are live to visitors. Verify the homepage,
   PDP, and bar in a real browser against prod data.

Status confirmed by the owner on 2026-11-20: there are still no App Store or Play
listings, and the TestFlight link remains the only live target. The store-agnostic
link layer in §1 is therefore load-bearing, not speculative.

## Still worth confirming

Does not block starting:

- Is `dna` the right fork? See call 2.
