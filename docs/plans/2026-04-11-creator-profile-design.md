# Public Creator Profile Page — Design

**Date:** 2026-04-11
**Status:** Approved, pending implementation plan
**Scope:** Phase 1 of creator feature set — adaptive public profile page gated by an admin-controlled `is_creator` boolean

---

## Problem

Beeper currently has a basic public profile page at `/:username` showing avatar initials, name, follower/following counts, a follow button, and a grid of public favorites. This is generic and doesn't differentiate users who will sell on Beeper ("creators") from regular buyers. We need the profile page to:

1. Adapt its layout and capabilities based on whether a user is a creator
2. Let creators present a bio, avatar, banner, website, and social handles
3. Surface recent streams for creators (using existing `live_streams` data)
4. Be admin-gated — creator status is granted manually via the Beeper-Admin dashboard, not user-requested
5. Lay the groundwork for a future multi-vendor marketplace (Phase 2+) without requiring it now

## Explicit Non-Goals (deferred to later phases)

- Multi-vendor Spree marketplace (`Spree::Vendor` model, vendor-scoped admin)
- Stripe Connect, payouts, platform fees
- Creator shop with actual product listings (v1 shows a "coming soon" stub)
- Creator application/approval queue (v1 is admin-toggle-only; no inbox)
- Image upload infrastructure (v1 uses URL fields only, no ActiveStorage)
- Creator reviews/ratings
- Creator analytics
- Messaging/DMs

## Rollout plan

1. Ship Beeper-Admin changes (migration + admin form override + API serializer). Toggle self as creator.
2. Ship Beeper-Frontend changes. Verify profile renders for both creator and non-creator users.
3. Manually toggle 2-3 other users to creator, verify in production.
4. Announce internally or ship quietly.

---

## Data Model (Beeper-Admin Rails)

New migration: `add_creator_fields_to_spree_users`

```ruby
class AddCreatorFieldsToSpreeUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :spree_users, :is_creator,    :boolean, default: false, null: false
    add_column :spree_users, :display_name,  :string
    add_column :spree_users, :bio,           :text
    add_column :spree_users, :avatar_url,    :string
    add_column :spree_users, :banner_url,    :string
    add_column :spree_users, :website,       :string
    add_column :spree_users, :instagram,     :string
    add_column :spree_users, :tiktok,        :string
    add_column :spree_users, :youtube,       :string
    add_column :spree_users, :soundcloud,    :string
    add_column :spree_users, :bandcamp,      :string

    add_index :spree_users, :is_creator, where: "is_creator = true"
    add_index :spree_users, :display_name, unique: true, where: "display_name IS NOT NULL"
  end
end
```

**Field rationale:**
- `is_creator`: the admin-approved flag; default false, not null so queries never see `nil`
- `display_name`: public handle, distinct from email and `bill_address#firstname`/`lastname`; used for vanity URL lookups
- `bio`: text, ~280-char soft limit enforced in form validation, not DB
- `avatar_url` / `banner_url`: plain URL strings; ActiveStorage/S3 attachments deferred to a later phase
- Social handles: stored as bare strings (`"beeper_buzz"`), full URLs constructed at render time. If a user pastes a full URL we strip the domain before save.
- **Partial index** on `is_creator` because most users will not be creators; keeps the index small
- **Partial unique index** on `display_name` allows many nulls but guarantees handle uniqueness where set

The migration is purely additive; down-migration drops all columns and indexes.

---

## Beeper-Admin Dashboard

### User edit form override

A Deface override (matching the existing `Beeper-Admin/app/overrides/` pattern) inserts a "Creator Profile" fieldset at the bottom of the user form:

```
app/overrides/admin_user_creator_fields.html.erb.deface

<!-- insert_bottom "[data-hook='admin_user_form_fields']" -->
<fieldset class="no-border-bottom">
  <legend align="center">Creator Profile</legend>
  - is_creator (checkbox)
  - display_name (text, unique)
  - website, bio
  - avatar_url, banner_url
  - instagram, tiktok, youtube, soundcloud, bandcamp (handles)
</fieldset>
```

Spree core views are not edited directly — only the Deface override file is added.

### Strong params decorator

`app/controllers/spree/admin/users_controller_decorator.rb` extends `permitted_user_attributes` to include the new fields so they can be saved via the admin form:

```ruby
Spree::Admin::UsersController.class_eval do
  private
  def permitted_user_attributes
    super + [
      :is_creator, :display_name, :bio, :avatar_url, :banner_url,
      :website, :instagram, :tiktok, :youtube, :soundcloud, :bandcamp
    ]
  end
end
```

### User index column

A second Deface override adds a "Creator" column to the admin user index (`spree/admin/users/_user_row.html.erb`) showing a ✓ or ✗ so admins can scan for creators at a glance. Filter toggle on the index lets admins see creators only.

### Self-service vs admin-only fields

- `is_creator` — **admin only**, not writable via storefront API
- Everything else (`display_name`, `bio`, `avatar_url`, `banner_url`, socials) — **writable by the user** via storefront account update

---

## API Changes (Beeper-Admin)

### Extended profile response

`GET /api/v1/users/:id/profile` returns the new fields:

```ruby
profile_data = {
  id: user.id,
  email: user.email,
  first_name: user.bill_address&.firstname || "",
  last_name: user.bill_address&.lastname || "",
  display_name: user.display_name,
  is_creator: user.is_creator,
  bio: user.bio,
  avatar_url: user.avatar_url,
  banner_url: user.banner_url,
  website: user.website,
  socials: {
    instagram: user.instagram,
    tiktok: user.tiktok,
    youtube: user.youtube,
    soundcloud: user.soundcloud,
    bandcamp: user.bandcamp
  }.compact_blank,
  followers_count: user.followers.count,
  following_count: user.followings.count,
  is_following: is_following,
  public_favorites: public_favorites,
  recent_streams: user.live_streams
    .where(status: "ended")
    .order(created_at: :desc)
    .limit(6)
    .map { |s| { id: s.id, title: s.title, thumbnail_url: s.thumbnail_url, ended_at: s.ended_at } }
}
```

`recent_streams` is included regardless of creator status but will typically be empty for non-creators. The frontend only renders the Streams tab when the array has entries.

### Dual lookup: ID or display_name

The profile endpoint must accept either a numeric user ID or a `display_name` handle so vanity URLs (`/:handle`) and legacy numeric URLs both work:

```ruby
def profile
  user = if params[:id].to_i.to_s == params[:id]
           Spree::User.find_by(id: params[:id])
         else
           Spree::User.find_by(display_name: params[:id])
         end
  return error_model(404, "User not found") unless user
  # ...
end
```

### Storefront account update

A decorator on `Spree::Api::V2::Storefront::AccountController` extends permitted params to include all user-editable creator fields. **`is_creator` is explicitly excluded** from the permit list — a user cannot promote themselves to creator via the storefront API.

---

## Frontend: Account Settings (self-service editing)

`AccountProfile.tsx` — the existing profile edit form — gains a conditional "Creator Profile" section.

### Layout

```
┌─────────────────────────────────────┐
│ BASIC INFO (everyone)               │
│  first_name, last_name              │
│  email                              │
│  display_name (public)              │
│  bio (public, 280 chars)            │
├─────────────────────────────────────┤
│ SHIPPING ADDRESS (everyone, opt.)   │
│  address, unit                      │
├─────────────────────────────────────┤
│ CREATOR PROFILE   [if is_creator]   │
│  avatar_url, banner_url             │
│  website                            │
│  instagram, tiktok, youtube,        │
│  soundcloud, bandcamp               │
├─────────────────────────────────────┤
│ CREATOR STATUS    [if !is_creator]  │
│  "Apply to become a creator"        │
│  instructional text + contact link  │
└─────────────────────────────────────┘
```

The "Creator Profile" fieldset only renders when `account.data.attributes.is_creator === true`. Non-creators see a static card explaining that creator status is granted manually — v1 just shows contact info or a mailto link.

### Form submission

`useUpdateAccount` / `updateAccountInfo` are extended to accept the new fields:

```ts
await updateAccount.mutateAsync({
  first_name, last_name, email,
  display_name, bio,
  avatar_url, banner_url, website,
  instagram, tiktok, youtube, soundcloud, bandcamp
});
```

TypeScript interfaces in `hooks/useAccounts/index.ts` are extended, not replaced.

### Extracted sub-component

To keep `AccountProfile.tsx` under ~200 lines, the creator fields block is extracted into `components/AccountProfile/CreatorFieldsSection.tsx`. Single responsibility: render the creator-only form fields. Dependencies: Formik, FormikInput. No state of its own.

---

## Frontend: Public Profile Page

### Layout

```
┌──────────────────────────────────────────────────┐
│  [BANNER IMAGE — creators only]                  │  h-40 md:h-64, gradient fallback
│                                                  │
│     ┌────┐                                      │
│     │ AV │  DISPLAY NAME     [CREATOR BADGE]    │
│     │    │  @handle                              │
│     └────┘  1.2k followers · 345 following       │
│             [Follow] [Share]                     │
│                                                  │
│  Bio text goes here.                             │
│                                                  │
│  [IG] [TT] [YT] [SC] [BC] [website]              │  creator socials
├──────────────────────────────────────────────────┤
│  TABS: Favorites · Streams · Shop [creator]     │  sticky tab bar
├──────────────────────────────────────────────────┤
│  [Active tab content]                            │
└──────────────────────────────────────────────────┘
```

### Adaptive behavior

| Element | Non-creator | Creator |
|---|---|---|
| Banner | Hidden (or dark gradient only) | Shows `banner_url` or neon gradient fallback |
| Creator badge | Hidden | Neon checkmark/label next to display name |
| Socials row | Hidden | One chip per filled social, each links to full URL |
| Favorites tab | Shown | Shown |
| Streams tab | Hidden (even if recent_streams exists) | Shown when `recent_streams.length > 0` |
| Shop tab | Hidden | Shown as "coming soon" stub |

Non-creators see the current profile cleaned up — no banner, no socials row, no extra tabs. The layout is prepped to gracefully accept creator fields the moment an admin toggles their flag.

### Sub-components (decomposition)

| File | Purpose | Depends on |
|---|---|---|
| `UserProfile.tsx` | Fetches data via `useUserProfile`, delegates rendering | All sub-components below |
| `ProfileBanner.tsx` | Banner image/gradient + avatar + name + handle + follow/share | `SocialChip`, `CreatorBadge` |
| `ProfileTabs.tsx` | Tab bar (Favorites / Streams / Shop), sticky on scroll | none |
| `ProfileFavorites.tsx` | Favorites grid (extracted from current UserProfile) | none |
| `ProfileStreams.tsx` | Recent streams grid, links to `/tv/[id]` | none |
| `ProfileShopPlaceholder.tsx` | "Coming soon" empty state | none |
| `SocialChip.tsx` | Icon + handle chip for one social platform | lucide-react + custom SVGs |
| `CreatorBadge.tsx` | Neon checkmark/label | none |

Rationale: the current `UserProfile.tsx` mixes fetching, rendering, and follow logic. Adding banner + socials + three tabs pushes it past ~300 lines. Each sub-component has a single purpose and can be tested independently. The main `UserProfile.tsx` becomes a thin composition layer.

### Social chip conventions

Handles stored bare (no protocol, no domain, no `@`). The chip builds the URL:

- `instagram` → `https://instagram.com/{handle}`
- `tiktok` → `https://tiktok.com/@{handle}`
- `youtube` → `https://youtube.com/@{handle}`
- `soundcloud` → `https://soundcloud.com/{handle}`
- `bandcamp` → `https://{handle}.bandcamp.com`
- `website` → as-is (only field that stores a full URL)

If a user pastes a full URL into a handle field, the save path strips the domain. Icons from `lucide-react` where available (Instagram, Youtube); custom SVG for TikTok, SoundCloud, Bandcamp.

### Avatar and banner fallbacks

- **Avatar:** if `avatar_url` is set, `<Image src={avatar_url} />`. Otherwise, existing initials circle.
- **Banner:** if `banner_url` is set, rendered as `background-image`. Otherwise, CSS gradient `linear-gradient(135deg, #7c3aed 0%, #ff008a 50%, #00ffff 100%)`.

### Share button

Uses the Web Share API (`navigator.share`) with a fallback to clipboard copy + "Link copied" toast. Always shares the canonical `/{display_name || id}` URL.

### Loading and error states

Same pattern as the current component — `<Loading />` while fetching, a glass-panel error card on 404/failure.

---

## File Structure

```
Beeper-Admin/
  db/migrate/YYYYMMDDHHMMSS_add_creator_fields_to_spree_users.rb
  app/overrides/admin_user_creator_fields.html.erb.deface
  app/overrides/admin_user_creator_index_column.html.erb.deface
  app/controllers/spree/admin/users_controller_decorator.rb
  app/controllers/spree/api/v1/users_controller.rb                   (extend profile action)
  app/controllers/spree/api/v2/storefront/account_controller_decorator.rb
  app/models/spree/user_decorator.rb                                 (if not already exists)

Beeper-Frontend/
  components/UserProfile/
    UserProfile.tsx                    (rewrite: adaptive layout, composition)
    ProfileBanner.tsx                  (new)
    ProfileTabs.tsx                    (new)
    ProfileFavorites.tsx               (new)
    ProfileStreams.tsx                 (new)
    ProfileShopPlaceholder.tsx         (new)
    SocialChip.tsx                     (new)
    CreatorBadge.tsx                   (new)
    types/index.ts                     (update: extend UserProfileData)
  components/AccountProfile/
    AccountProfile.tsx                 (extend: conditional creator section)
    CreatorFieldsSection.tsx           (new: extracted form block)
  hooks/useUserProfile/index.ts        (update: extend UserProfileData)
  hooks/useAccounts/index.ts           (update: extend updateAccountInfo params)
```

No breaking changes: the API endpoint signature stays the same (only adds fields), existing consumers continue to work, TypeScript interfaces are extended not replaced, migration is purely additive.

---

## Testing

### Backend (Beeper-Admin)

- **Migration:** `up` and `down` both succeed on dev DB; all new columns nullable except `is_creator`
- **API:** unit test for `users#profile` returns correct shape for a creator and a non-creator
- **API:** unit test that `is_creator` is NOT writable via storefront account update
- **Admin:** integration test that checking `is_creator` in the admin form persists the change
- **Dual lookup:** test that `/api/v1/users/:id/profile` works with both a numeric ID and a display_name string

### Frontend (Beeper-Frontend)

- Visual verification on a creator profile (`/aaron` or equivalent) and a non-creator profile
- Mobile responsive check: banner, tabs, social chips wrap correctly
- Empty/null social handles render nothing (no empty chip)
- Avatar fallback to initials when `avatar_url` is null
- Banner fallback to gradient when `banner_url` is null
- Loading and error states still work
- Share button: Web Share API path and clipboard fallback both tested

---

## Edge Cases

- **User with no display_name browses their own profile:** A banner on the profile page prompts "Add a display name to make your profile more discoverable" linking to `/account/profile`.
- **`is_creator` flipped from true → false:** Creator-only fields (bio, banner, socials) remain in the DB but are hidden from the public page. Account settings still show them to the user but grayed out. On re-enable, everything comes back.
- **Display name collision:** DB unique index prevents duplicates; admin form and self-service both catch the Rails `RecordNotUnique` and surface "This display name is taken."
- **Invalid social handles (full URLs):** Store as-is, strip the domain at render time. Blank handles don't render a chip.
- **Deleted user:** Existing 404 flow continues to work.
- **Deleted favorite product:** Already handled by null-safe navigation in the current code.
- **User has `recent_streams` but isn't a creator:** Streams tab hidden; data is still in the API response but the frontend filters it out.

---

## Phase 2+ (NOT in this spec)

For reference only — these are the pieces that come later when we build out the full creator marketplace:

1. `Spree::Vendor` model + admin (consider `spree_multi_vendor` gem)
2. Vendor ↔ User ↔ Product associations
3. Vendor-scoped admin dashboard (creators log in, manage own shop)
4. Creator onboarding flow (distinct from buyer signup)
5. Stripe Connect for payouts and platform fees
6. Per-vendor tax and shipping
7. Multi-package orders (one order, multiple vendors = multiple fulfillments)
8. Reviews/ratings per creator
9. Creator application queue (user requests, admin approves from an inbox)
10. Avatar/banner image uploads via ActiveStorage + S3
11. Sample pack / preset taxonomy + delivery (digital goods fulfillment)
12. Creator analytics dashboard

Each of these is its own spec.
