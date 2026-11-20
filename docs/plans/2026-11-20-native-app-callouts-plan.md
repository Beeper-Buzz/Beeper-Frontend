# Native App Callouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a "get the Beeper app" callout on the homepage, PDPs, a site-wide bar and the ComingSoon splash, with store links that flip from TestFlight to real listings by editing the admin — no deploy, no image rebuild.

**Architecture:** All decidable logic lives in two pure modules under `lib/` (link resolution, banner selection) because this repo has no component test framework. A single react-query fetch in `_app.tsx` reads both the banner and the store-link overrides from the admin through the existing server-side proxy, publishes them via context, and all four placements consume that context. Env constants seed the query so no surface ever renders empty. The admin side adds two section types to the existing `HomepageSection` model — no migration.

**Tech Stack:** Next 13.1.1, React 18, TypeScript, Tailwind 3.4, react-query v3, framer-motion, `node:test` (frontend); Rails 6.1 + Spree 4.2, minitest (admin).

**Spec:** `docs/plans/2026-11-19-native-app-callouts-design.md`

## Global Constraints

- **No component test framework exists.** `yarn test` is `node --test -r ts-node/register` over an explicit file list in `package.json`. Every new test file must be appended to that list. Do not add jest, vitest or React Testing Library.
- **Frontend repo:** `/Users/smokey/Internal/Beeper/code/beeper-frontend`. Branch `feat/app-callouts`, cut from `origin/main`. Do not build on the current local branch `feat/sentry-monitoring`.
- **Admin repo:** `/Users/smokey/Internal/Beeper/code/beeper-admin`. Branch `feat/app-callouts`, cut from `dna/@aaron.smulktis/develop` (1instinct/dna-admin, head `197e206c`). Local `HEAD` is 117 behind / 31 ahead — do not branch from it.
- **iOS fallback URL, verbatim:** `https://testflight.apple.com/join/Ys1jkVfk`
- **Android fallback URL:** empty string. There is no Play listing or Play beta.
- **A platform with no URL renders nothing.** Never emit a badge, link or placeholder for a platform whose resolved href is empty.
- Path aliases: `@components/*`, `@hooks/*`, `@lib/*`, `@utilities/*`.
- House CTA class is `.neon-btn` (`styles/synthwave.css`); panels use `.glass-panel`; sections use `.section-container`.
- Run `yarn pre-commit` (format + prettier + `tsc --noEmit` + eslint) before every frontend commit.
- Admin tests: `bin/rails test test/models/...`, minitest, fixtures in `test/fixtures`.

## Review Focus

Inputs the spec implies that no task's happy path exercises. Each has a test in the task that owns the code.

1. **The admin is unreachable or returns no `app_links` row** — the common case today. Links must resolve to the env fallback, not to nothing. (Task 1)
2. **`settings` arrives as a Ruby-hash string or malformed JSON** — `useHomepage` already carries a repair parser because this happens. Selection must return `null`, never throw. (Task 2)
3. **Both URLs empty for a platform** — today's Android state. Must yield an empty link list, not a badge pointing at `""`. (Task 1)
4. **A date window with one bound set, or an unparseable date string** — admins will leave `ends_at` blank. One-sided windows must work; garbage dates must not hide a visible banner. (Task 2)
5. **More than one visible `announcement_bar` or `app_links` row** — nothing stops an admin creating two. The pick must be deterministic by `position`, not array order. (Task 2)

---

### Task 1: Link resolution (`lib/appLinks.ts`)

**Files:**
- Modify: `utilities/branding.ts` (append)
- Create: `lib/appLinks.ts`
- Test: `lib/__tests__/appLinks.test.ts`
- Modify: `package.json` (the `test` script's file list)
- Modify: `.env.example`, `secret.example.yml`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type AppPlatform = "ios" | "android";
  export type AppLinkKind = "beta" | "store";
  export interface AppLink {
    platform: AppPlatform;
    href: string;
    label: string;
    kind: AppLinkKind;
  }
  export interface AppLinkOverride { ios_url?: string; android_url?: string }
  export const resolveAppLinks: (override?: AppLinkOverride | null) => AppLink[];
  ```

- [ ] **Step 1: Branch from `origin/main`**

```bash
cd /Users/smokey/Internal/Beeper/code/beeper-frontend
git fetch origin && git checkout -b feat/app-callouts origin/main
```

The current local branch is `feat/sentry-monitoring` — do not build on it.

- [ ] **Step 2: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveAppLinks } from "../appLinks";

describe("resolveAppLinks", () => {
  test("falls back to the env iOS url when there is no override", () => {
    const links = resolveAppLinks(null);
    assert.equal(links.length, 1);
    assert.equal(links[0].platform, "ios");
    assert.equal(links[0].href, "https://testflight.apple.com/join/Ys1jkVfk");
    assert.equal(links[0].kind, "beta");
    assert.equal(links[0].label, "Join the iOS beta");
  });

  test("an admin override wins over env", () => {
    const links = resolveAppLinks({ ios_url: "https://apps.apple.com/app/id1661874489" });
    assert.equal(links[0].kind, "store");
    assert.equal(links[0].label, "Download on the App Store");
    assert.equal(links[0].href, "https://apps.apple.com/app/id1661874489");
  });

  test("an empty or whitespace override falls back to env", () => {
    assert.equal(resolveAppLinks({ ios_url: "   " })[0].kind, "beta");
  });

  test("android is omitted entirely when override and env are both empty", () => {
    const links = resolveAppLinks({ android_url: "" });
    assert.deepEqual(links.map((l) => l.platform), ["ios"]);
  });

  test("an android override is labelled for Play", () => {
    const links = resolveAppLinks({
      android_url: "https://play.google.com/store/apps/details?id=com.beeper.Buzz"
    });
    const android = links.find((l) => l.platform === "android");
    assert.equal(android?.kind, "store");
    assert.equal(android?.label, "Get it on Google Play");
  });

  test("ios comes before android", () => {
    const links = resolveAppLinks({
      ios_url: "https://apps.apple.com/app/id1661874489",
      android_url: "https://play.google.com/store/apps/details?id=com.beeper.Buzz"
    });
    assert.deepEqual(links.map((l) => l.platform), ["ios", "android"]);
  });

  test("a malformed href is dropped rather than rendered", () => {
    assert.deepEqual(resolveAppLinks({ ios_url: "not a url" }).map((l) => l.kind), ["beta"]);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `cd /Users/smokey/Internal/Beeper/code/beeper-frontend && yarn test`
Expected: FAIL — cannot find module `../appLinks`.

- [ ] **Step 4: Add the env constants to `utilities/branding.ts`**

Append, following the commented style already in that file:

```ts
export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL || "https://testflight.apple.com/join/Ys1jkVfk";
export const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
```

Add both `NEXT_PUBLIC_*` names to `.env.example` and `secret.example.yml` with a comment saying the admin overrides them.

- [ ] **Step 5: Implement `resolveAppLinks` in `lib/appLinks.ts`**

Per platform: take the override value, trim it, fall back to the branding constant, trim again; drop the platform if the result is empty or does not parse as an absolute `http(s)` URL via `new URL()`. `kind` is `"beta"` when the parsed hostname is `testflight.apple.com`, otherwise `"store"`. Labels are fixed by platform and kind: iOS beta → `Join the iOS beta`, iOS store → `Download on the App Store`, Android store → `Get it on Google Play`, Android beta → `Join the Android beta`. Return iOS first.

Module header comment should state that this is pure, runs in both `getStaticProps` and the browser, and that an empty result is a valid outcome meaning "render no links".

- [ ] **Step 6: Register the test file**

In `package.json`, append `lib/__tests__/appLinks.test.ts` to the `test` script's file list.

- [ ] **Step 7: Run the test and verify it passes**

Run: `yarn test`
Expected: PASS, all seven assertions in the `resolveAppLinks` describe block.

- [ ] **Step 8: Commit**

```bash
git add lib/appLinks.ts lib/__tests__/appLinks.test.ts utilities/branding.ts package.json .env.example secret.example.yml
git commit -m "[Feature]: Resolve Beeper app store links, changes:
1. Add IOS_APP_URL and ANDROID_APP_URL to branding, defaulting iOS to the TestFlight invite and Android to empty
1. Add lib/appLinks.ts resolving admin overrides over env, dropping any platform without a valid absolute URL
1. Label links as beta or store by hostname so the TestFlight to App Store switch needs no code change"
```

---

### Task 2: Banner and override selection (`lib/announcement.ts`)

**Files:**
- Create: `lib/announcement.ts`
- Test: `lib/__tests__/announcement.test.ts`
- Modify: `package.json` (the `test` script's file list)

**Interfaces:**
- Consumes: `AppLinkOverride` from `lib/appLinks.ts` (Task 1).
- Produces:
  ```ts
  export interface Announcement {
    id: number;
    message: string;
    ctaLabel: string | null;
    ctaHref: string | null;
    dismissible: boolean;
    updatedAt: string;
  }
  export const selectAnnouncement: (sections: unknown, now?: Date) => Announcement | null;
  export const selectAppLinkOverride: (sections: unknown) => AppLinkOverride | null;
  ```

Both accept `unknown` deliberately: the payload crosses a network boundary from a JSON column with no schema.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { selectAnnouncement, selectAppLinkOverride } from "../announcement";

const bar = (over = {}) => ({
  id: 1, section_type: "announcement_bar", position: 0, is_visible: true,
  content: "", created_at: "", updated_at: "2026-11-20T00:00:00Z",
  settings: { message: "Beta is open", dismissible: true }, ...over
});

describe("selectAnnouncement", () => {
  test("returns the message of a visible bar", () => {
    assert.equal(selectAnnouncement([bar()])?.message, "Beta is open");
  });

  test("picks the lowest position, not the array order", () => {
    const sections = [
      bar({ id: 2, position: 5, settings: { message: "second" } }),
      bar({ id: 3, position: 1, settings: { message: "first" } })
    ];
    assert.equal(selectAnnouncement(sections)?.message, "first");
  });

  test("ignores other section types and invisible rows", () => {
    assert.equal(selectAnnouncement([bar({ section_type: "hero" })]), null);
    assert.equal(selectAnnouncement([bar({ is_visible: false })]), null);
  });

  test("returns null for an empty, non-array or missing payload", () => {
    assert.equal(selectAnnouncement([]), null);
    assert.equal(selectAnnouncement(null), null);
    assert.equal(selectAnnouncement({ nope: true }), null);
  });

  test("returns null when settings is an unparsed Ruby hash string", () => {
    assert.equal(selectAnnouncement([bar({ settings: '{"message"=>"x"}' })]), null);
  });

  test("returns null when the message is missing or blank", () => {
    assert.equal(selectAnnouncement([bar({ settings: { message: "  " } })]), null);
  });

  test("honours a one-sided start bound", () => {
    const s = [bar({ settings: { message: "m", starts_at: "2026-12-01T00:00:00Z" } })];
    assert.equal(selectAnnouncement(s, new Date("2026-11-20T00:00:00Z")), null);
    assert.equal(selectAnnouncement(s, new Date("2026-12-02T00:00:00Z"))?.message, "m");
  });

  test("honours a one-sided end bound", () => {
    const s = [bar({ settings: { message: "m", ends_at: "2026-11-01T00:00:00Z" } })];
    assert.equal(selectAnnouncement(s, new Date("2026-11-20T00:00:00Z")), null);
  });

  test("an unparseable date does not hide a visible banner", () => {
    const s = [bar({ settings: { message: "m", starts_at: "whenever" } })];
    assert.equal(selectAnnouncement(s, new Date("2026-11-20T00:00:00Z"))?.message, "m");
  });

  test("a skipped out-of-window bar does not shadow a later valid one", () => {
    const sections = [
      bar({ id: 2, position: 0, settings: { message: "expired", ends_at: "2026-01-01T00:00:00Z" } }),
      bar({ id: 3, position: 1, settings: { message: "live" } })
    ];
    assert.equal(selectAnnouncement(sections, new Date("2026-11-20T00:00:00Z"))?.message, "live");
  });
});

describe("selectAppLinkOverride", () => {
  test("reads urls from the lowest-position visible app_links row", () => {
    const sections = [
      bar({ id: 4, section_type: "app_links", position: 2, settings: { ios_url: "b" } }),
      bar({ id: 5, section_type: "app_links", position: 0, settings: { ios_url: "a" } })
    ];
    assert.deepEqual(selectAppLinkOverride(sections), { ios_url: "a", android_url: "" });
  });

  test("returns null when there is no app_links row or settings are unusable", () => {
    assert.equal(selectAppLinkOverride([bar()]), null);
    assert.equal(selectAppLinkOverride([bar({ section_type: "app_links", settings: "{}=>x" })]), null);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `yarn test`
Expected: FAIL — cannot find module `../announcement`.

- [ ] **Step 3: Implement both selectors in `lib/announcement.ts`**

Shared private helper: narrow `unknown` to an array, keep entries whose `section_type` matches and whose `is_visible` is not `false`, require `settings` to be a non-null plain object (a string means the upstream parser failed — treat as unusable), sort ascending by numeric `position`.

`selectAnnouncement` then takes the first candidate that also has a non-blank `message` and is inside its window; `starts_at`/`ends_at` are optional and a date that fails `Number.isNaN(Date.parse(...))` is ignored rather than treated as excluding. `now` defaults to `new Date()`. `dismissible` defaults to `true` when absent.

`selectAppLinkOverride` returns `{ ios_url, android_url }` with missing values as `""`, or `null` if no usable row exists.

- [ ] **Step 4: Register the test file and run**

Append `lib/__tests__/announcement.test.ts` to the `test` script, then run `yarn test`.
Expected: PASS, both describe blocks.

- [ ] **Step 5: Commit**

```bash
git add lib/announcement.ts lib/__tests__/announcement.test.ts package.json
git commit -m "[Feature]: Select the announcement bar and app link overrides, changes:
1. Add lib/announcement.ts choosing the lowest-position visible row rather than array order
1. Treat a string settings payload as unusable, since the admin JSON column does not always round-trip
1. Honour one-sided date windows and ignore unparseable dates instead of hiding a live banner"
```

---

### Task 3: Admin section types and seed (`beeper-admin`)

**Files:**
- Modify: `app/models/homepage_section.rb` (the `SECTION_TYPES` array)
- Create: `db/seeds/010_app_links.rb` (bump the number if `010_` is taken on the branch)
- Test: `test/models/homepage_section_test.rb`

**Interfaces:**
- Produces: `section_type` values `"announcement_bar"` and `"app_links"`, readable at `GET /api/v1/homepage_sections?visible_only=true`.

- [ ] **Step 1: Branch from the deployed remote**

```bash
cd /Users/smokey/Internal/Beeper/code/beeper-admin
git fetch dna && git checkout -b feat/app-callouts dna/@aaron.smulktis/develop
```

- [ ] **Step 2: Write the failing test**

```ruby
require 'test_helper'

class HomepageSectionTest < ActiveSupport::TestCase
  test 'accepts the announcement_bar section type' do
    section = HomepageSection.new(title: 'Bar', section_type: 'announcement_bar', position: 0)
    assert section.valid?, section.errors.full_messages.join(', ')
  end

  test 'accepts the app_links section type' do
    section = HomepageSection.new(title: 'App links', section_type: 'app_links', position: 0)
    assert section.valid?, section.errors.full_messages.join(', ')
  end

  test 'still rejects an unknown section type' do
    assert_not HomepageSection.new(title: 'X', section_type: 'nope', position: 0).valid?
  end
end
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `bin/rails test test/models/homepage_section_test.rb`
Expected: FAIL on the two new types, inclusion validation.

- [ ] **Step 4: Add both types to `SECTION_TYPES`**

Append `announcement_bar` and `app_links` to the frozen array in `app/models/homepage_section.rb`, keeping the existing one-per-line formatting.

- [ ] **Step 5: Run the test and verify it passes**

Run: `bin/rails test test/models/homepage_section_test.rb`
Expected: PASS, 3 runs 0 failures.

- [ ] **Step 6: Add the seed**

`db/seeds/010_app_links.rb` creates, idempotently via `find_or_create_by(section_type: 'app_links')`, one row: title `App Store Links`, `position: 0`, `is_visible: true`, `settings: { 'ios_url' => '', 'android_url' => '' }`. Empty on purpose — it exists so the record is editable before launch rather than created under time pressure.

- [ ] **Step 7: Commit**

```bash
git add app/models/homepage_section.rb db/seeds/010_app_links.rb test/models/homepage_section_test.rb
git commit -m "[Feature]: Add announcement bar and app links section types, changes:
1. Allow announcement_bar and app_links in HomepageSection::SECTION_TYPES, no migration since settings is already a JSON column
1. Seed one empty app_links row so the store URLs can be filled in from the admin at launch without creating a record
1. Add the first model test for HomepageSection, covering both new types and the unknown-type rejection"
```

---

### Task 4: Admin form fields for the new types (`beeper-admin`)

The raw `settings` textarea renders a stored Hash through `to_s` and does not round-trip. These two types get discrete fields instead; every other type keeps the textarea untouched.

**Files:**
- Modify: `app/controllers/spree/admin/homepage_sections_controller.rb` (`homepage_section_params`, plus a new private `composed_settings`)
- Modify: `app/views/spree/admin/homepage_sections/new.html.erb`, `edit.html.erb`
- Modify: `config/locales/en.yml`
- Test: `test/controllers/spree/admin/homepage_sections_controller_test.rb`

**Interfaces:**
- Consumes: the section types from Task 3.
- Produces: `settings` persisted as a real Hash with keys `message`, `cta_label`, `cta_href`, `dismissible`, `starts_at`, `ends_at` (announcement_bar) or `ios_url`, `android_url` (app_links).

- [ ] **Step 1: Write the failing test**

```ruby
require 'test_helper'

class Spree::Admin::HomepageSectionsControllerTest < ActionDispatch::IntegrationTest
  # sign-in helper per test_helper.rb's existing admin convention

  test 'composes announcement_bar settings from discrete fields' do
    post spree.admin_homepage_sections_path, params: { homepage_section: {
      title: 'Bar', section_type: 'announcement_bar', position: 0, is_visible: '1',
      settings_fields: { message: 'Beta is open', cta_label: 'Join', dismissible: '1' }
    } }
    settings = HomepageSection.last.settings
    assert_equal 'Beta is open', settings['message']
    assert_equal true, settings['dismissible']
  end

  test 'composes app_links settings and round-trips on update' do
    section = HomepageSection.create!(title: 'Links', section_type: 'app_links', position: 0,
                                      settings: { 'ios_url' => '', 'android_url' => '' })
    patch spree.admin_homepage_section_path(section), params: { homepage_section: {
      settings_fields: { ios_url: 'https://apps.apple.com/app/id1661874489' }
    } }
    assert_equal 'https://apps.apple.com/app/id1661874489', section.reload.settings['ios_url']
    assert_kind_of Hash, section.settings
  end

  test 'leaves the raw settings textarea behaviour intact for other types' do
    post spree.admin_homepage_sections_path, params: { homepage_section: {
      title: 'Hero', section_type: 'hero', position: 0, settings: '{"a":1}'
    } }
    assert_equal 'hero', HomepageSection.last.section_type
  end
end
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bin/rails test test/controllers/spree/admin/homepage_sections_controller_test.rb`
Expected: FAIL — `settings_fields` is not permitted, so settings stay empty.

- [ ] **Step 3: Permit and compose the fields in the controller**

Permit `settings_fields` with the six banner keys and the two link keys. Add a private `composed_settings(attrs)` that, when `section_type` is `announcement_bar` or `app_links`, builds the Hash from `settings_fields` (casting `dismissible` with `ActiveModel::Type::Boolean`, storing blank dates as `nil`) and replaces `:settings`; for every other type it returns the attributes unchanged so the existing textarea path is untouched. Call it from both `create` and `update`.

- [ ] **Step 4: Add the fields to both views**

In `new.html.erb` and `edit.html.erb`, after the existing `settings` container, add two `f.field_container` fieldsets using `f.fields_for :settings_fields` — "Announcement bar" (`message`, `cta_label`, `cta_href`, `dismissible` checkbox, `starts_at`, `ends_at`) and "App store links" (`ios_url`, `android_url`). Both render unconditionally with a label saying which section type they apply to; no JavaScript toggle. Label the existing textarea "Settings (JSON) — other section types only".

- [ ] **Step 5: Add the missing locale keys**

Add `homepage_section.added_success`, `update_success`, `deleted_success`, `delete_failed`, and `homepage_sections` under the Spree `en` scope in `config/locales/en.yml`. These are already called by the controller and currently render translation-missing strings.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `bin/rails test test/controllers/spree/admin/homepage_sections_controller_test.rb test/models/homepage_section_test.rb`
Expected: PASS.

- [ ] **Step 7: Commit, then open the admin PR against `dna/@aaron.smulktis/develop`**

```bash
git add app/controllers/spree/admin/homepage_sections_controller.rb app/views/spree/admin/homepage_sections config/locales/en.yml test/
git commit -m "[Feature]: Edit banner and app link settings as real fields, changes:
1. Compose the settings JSON from discrete form fields for announcement_bar and app_links, since the raw textarea renders a Ruby hash and does not round-trip
1. Leave the existing textarea path untouched for every other section type
1. Add the homepage_section locale keys the controller already calls, which rendered as translation-missing strings"
```

---

### Task 5: Proxy route, fetch hook and context (`beeper-frontend`)

**Files:**
- Modify: `pages/api/public/[...path].ts` (`resolveRoute`, and the comment block listing routes)
- Create: `hooks/useAppPresence/useAppPresence.ts`, `hooks/useAppPresence/index.ts`
- Modify: `hooks/queryKeys.ts`, `hooks/index.ts`
- Create: `components/AppCallout/AppPresenceProvider.tsx`

**Interfaces:**
- Consumes: `selectAnnouncement`, `selectAppLinkOverride` (Task 2); `resolveAppLinks`, `AppLink`, `Announcement` (Tasks 1–2).
- Produces:
  ```ts
  export interface AppPresence { banner: Announcement | null; links: AppLink[] }
  export const useAppPresence: () => AppPresence;          // context reader
  export const AppPresenceProvider: React.FC<{ children: React.ReactNode }>;
  ```
  Every placement calls `useAppPresence()`. It never returns `undefined` and never throws.

- [ ] **Step 1: Add `homepage_sections` to the proxy allowlist**

In `resolveRoute`, add a `case "homepage_sections":` that rejects an `id` segment, accepts only `visible_only=true`, and returns `{ path: "/api/v1/homepage_sections?visible_only=true", cache: CACHE_SHORT }`. Add the matching line to the route list in the file's header comment. This is a public read-only endpoint, consistent with the file's "no user-specific endpoints" rule.

- [ ] **Step 2: Verify the route against the real backend**

Run `yarn dev`, then:
`curl -s "http://localhost:3000/api/public/homepage_sections?visible_only=true" | head -c 200`
Expected: a `{"response_code":200,...}` envelope. An empty `homepage_sections` array is the correct current state — prod has no sections yet. A 404 means the allowlist case did not match; fix before continuing.

- [ ] **Step 3: Implement the hook and provider**

`QueryKeys.APP_PRESENCE = "APP_PRESENCE"`.

`useAppPresenceQuery` (internal) fetches `/api/public/homepage_sections?visible_only=true` with react-query, `staleTime` 5 minutes, and `initialData` set to `{ banner: null, links: resolveAppLinks(null) }` so the env fallback renders on first paint. It maps the response's `response_data.homepage_sections` through `selectAnnouncement` and `selectAppLinkOverride`, then `resolveAppLinks(override)`.

Reuse the `parseSettings` behaviour already in `hooks/useHomepage/useHomepage.ts:57-79` rather than duplicating it — export it from there and import it.

`onError` logs and nothing else: a failed fetch leaves `initialData` in place, which is the fallback behaviour Review Focus item 1 requires.

`AppPresenceProvider` creates a React context with that same env-derived default and supplies the query result. `useAppPresence()` reads the context.

Barrel the hook from `hooks/index.ts`.

- [ ] **Step 4: Verify types and lint**

Run: `yarn lint-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add pages/api/public hooks/useAppPresence hooks/queryKeys.ts hooks/index.ts hooks/useHomepage components/AppCallout/AppPresenceProvider.tsx
git commit -m "[Feature]: Fetch app links and the announcement bar once per page, changes:
1. Allow homepage_sections through the public proxy, since admin.beeper.buzz sends no CORS headers and a direct browser fetch is blocked
1. Add useAppPresence, seeded with the env links so no surface renders empty and a failed fetch degrades to the TestFlight link
1. Export the existing settings parser from useHomepage instead of duplicating it"
```

---

### Task 6: The callout component (`beeper-frontend`)

**Files:**
- Create: `components/AppCallout/AppCallout.tsx`, `components/AppCallout/AppStoreButtons.tsx`, `components/AppCallout/index.ts`
- Modify: `components/index.ts`, `components/components.ts`
- Add: official badge artwork under `public/images/AppIcons/`

**Interfaces:**
- Consumes: `useAppPresence()` (Task 5).
- Produces: `<AppCallout variant="section" | "inline" | "bar" />`, `<AppStoreButtons links={AppLink[]} />`.

- [ ] **Step 1: Replace the badge assets**

The existing `appstore.png` (1024×1024) and `playstore.png` (512×512) are square app icons, not badge artwork. Download the official "Download on the App Store" and "Get it on Google Play" badges and commit them under `public/images/AppIcons/` with new names. Do not reuse the icon filenames.

- [ ] **Step 2: Implement `AppStoreButtons`**

Takes `links: AppLink[]`. Renders nothing when the array is empty. For `kind: "store"`, renders the badge image wrapped in a `<Link>`, `alt` set to `link.label`. For `kind: "beta"`, renders a `.neon-btn` with `link.label` as its text — there is no official badge for TestFlight. All links get `target="_blank"` and `rel="noopener noreferrer"`.

- [ ] **Step 3: Implement `AppCallout`**

Reads `useAppPresence()`. Returns `null` when `links` is empty, for every variant.

- `section` — `<section className="section-container ...">` with a `.glass-panel`, a heading, one line of body copy, and `AppStoreButtons`. Uses the `initial`/`whileInView`/`viewport={{ once: true }}` framer-motion reveal that `components/Home/ShopMarketplaceSplit` already uses.
- `inline` — one quiet row: a short line of copy plus `AppStoreButtons`. No panel, no motion.
- `bar` — single line. Renders only when `banner` is non-null; uses `banner.message`, and `banner.ctaHref` if set, otherwise the first resolved link. When `banner.dismissible`, shows a dismiss control that writes `localStorage` key `beeper:announcement:<banner.updatedAt>` and hides the bar; on mount, a matching key means render nothing. Keying on `updatedAt` means editing the banner in the admin re-shows it to everyone who dismissed the previous one.

Copy for `section` and `inline` should match the tone of `beeper-emails/campaigns/2026-11-app-announce`.

- [ ] **Step 4: Verify types and lint**

Run: `yarn lint-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/AppCallout components/index.ts components/components.ts public/images/AppIcons
git commit -m "[Feature]: Add the Beeper app callout component, changes:
1. Add AppCallout with section, inline and bar variants, all rendering nothing when no platform has a link
1. Add AppStoreButtons using official badge artwork for store links and a neon-btn for the TestFlight beta, which has no badge
1. Replace the square app icons that were standing in for badge artwork
1. Scope banner dismissal to the banner's updated_at so an edit re-shows it"
```

---

### Task 7: Mount the callouts (`beeper-frontend`)

**Files:**
- Modify: `pages/_app.tsx:88-89` (provider + bar)
- Modify: `components/Home/DynamicHome.tsx` (between `<SpecsGrid />` and `<Newsletter />`)
- Modify: `components/ProductDetails/RetailProductDetails.tsx` (after the Add to Cart button, ~line 618)
- Modify: `components/ComingSoon/ComingSoon.tsx` (after the copy block, before `<SocialLinks />`)

**Interfaces:**
- Consumes: `AppCallout`, `AppPresenceProvider`.

- [ ] **Step 1: Wrap the shell and add the bar**

In `pages/_app.tsx`, put `AppPresenceProvider` inside `Hydrate` so both the maintenance branch (line 58) and the normal branch are covered, then render `<AppCallout variant="bar" />` as the first child of the shell div at line 88, above `<Header />`. The bar sits in normal flow so it scrolls away rather than fighting the header's `sticky top-0 z-50`; do not change the header's offset.

- [ ] **Step 2: Add the homepage and PDP placements**

`<AppCallout variant="section" />` between `<SpecsGrid />` and `<Newsletter />` in `DynamicHome.tsx`. `<AppCallout variant="inline" />` directly after the Add to Cart button inside the info panel in `RetailProductDetails.tsx`. `WholesaleProductDetails.tsx` is out of scope — `pages/[slug].tsx` never reaches it.

- [ ] **Step 3: Add the splash placement**

`<AppCallout variant="section" />` in `ComingSoon.tsx` after the copy block, before `<SocialLinks />`. Maintenance mode is off in prod, so this is a secondary surface — but it must still render correctly.

- [ ] **Step 4: Verify in a browser against real data**

Run `yarn dev` with `NEXT_PUBLIC_IS_MAINT_MODE=false` and `SPREE_API_URL=https://admin.beeper.buzz`. Confirm, on `/` and on a product page: the TestFlight button renders, no Android badge appears, and no bar appears (no `announcement_bar` row exists yet). Then create a visible `announcement_bar` row in the admin and confirm the bar appears and dismisses.

- [ ] **Step 5: Verify types and lint**

Run: `yarn lint-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add pages/_app.tsx components/Home/DynamicHome.tsx components/ProductDetails/RetailProductDetails.tsx components/ComingSoon/ComingSoon.tsx
git commit -m "[Feature]: Show the app callout on the homepage, PDPs, splash and a global bar, changes:
1. Wrap the shell in AppPresenceProvider inside Hydrate so both the maintenance and normal branches get links
1. Render the bar above the sticky header in normal flow, leaving the header offset alone
1. Add the section variant to the homepage and the splash, and the quiet inline variant under Add to Cart"
```

---

### Task 8: Cleanup and launch documentation (`beeper-frontend`)

**Files:**
- Delete: `public/ipa/BeeperBuzz.ipa`
- Modify: `README.md`

- [ ] **Step 1: Delete the orphaned build artifact**

`public/ipa/BeeperBuzz.ipa` is a 2.9 MB iOS build served publicly and referenced by no code. Sideloading an `.ipa` is not a path any visitor can use. Confirm it is still unreferenced before deleting:

Run: `grep -rn "BeeperBuzz.ipa\|/ipa/" --exclude-dir=node_modules --exclude-dir=.git .`
Expected: no hits outside `docs/`.

- [ ] **Step 2: Document the launch flip in `README.md`**

A short section: the store URLs are managed in the admin under Homepage Sections → the `app_links` record; at launch, paste the App Store and Play URLs there and save; no deploy or image rebuild is needed. Note that `NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_ANDROID_APP_URL` exist only as a fallback for when the admin is unreachable, and that changing *those* does require `make build-frontend` because `NEXT_PUBLIC_*` is inlined at build time.

- [ ] **Step 3: Run the full check**

Run: `yarn test && yarn lint-check`
Expected: all tests pass, no type or lint errors.

- [ ] **Step 4: Commit and open the frontend PR against `main`**

```bash
git add README.md
git rm public/ipa/BeeperBuzz.ipa
git commit -m "[Fix]: Remove the orphaned ipa and document the launch flip, changes:
1. Delete public/ipa/BeeperBuzz.ipa, a publicly served build artifact referenced by no code and unusable by visitors
1. Document that store URLs are edited in the admin at launch, with no deploy or image rebuild
1. Note that the NEXT_PUBLIC fallbacks are inlined at build time and need make build-frontend to change"
```
