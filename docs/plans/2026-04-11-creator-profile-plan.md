# Creator Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the creator feature set — an adaptive public profile page gated by an admin-controlled `is_creator` boolean on `spree_users`, with creator-specific fields (bio, banner, socials, recent streams) that appear on the public page and in the self-service profile editor.

**Architecture:** Additive migration on `spree_users` in Beeper-Admin (Rails/Spree); decorators + Deface overrides for admin + API; new dedicated handle-lookup API endpoint; frontend profile page decomposed into sub-components behind a feature flag for safe rollback. Multi-vendor marketplace explicitly deferred.

**Tech Stack:** Rails 7 / Spree Commerce / Deface / PostgreSQL / RSpec (backend); Next.js 12 / React / TypeScript / Formik / lucide-react / react-query (frontend).

**Spec:** `docs/plans/2026-04-11-creator-profile-design.md`

---

## Repos & directories

- **Beeper-Admin:** `/Users/smokey/Internal/Beeper/code/Beeper-Admin` — Spree backend
- **Beeper-Frontend:** `/Users/smokey/Internal/Beeper/code/Beeper-Frontend` — Next.js storefront

Each task is marked `[BA]` for Beeper-Admin, `[BF]` for Beeper-Frontend.

---

## Sequence

**Phase A — Backend (Beeper-Admin):** Tasks 1–9. Must deploy first.
**Phase B — Frontend (Beeper-Frontend):** Tasks 10–24. Ships behind feature flag.
**Phase C — Enablement:** Task 25. Flip the flag, verify, remove legacy.

---

## Phase A: Beeper-Admin

### Task 1: [BA] Migration — add creator fields to spree_users

**Files:**
- Create: `db/migrate/YYYYMMDDHHMMSS_add_creator_fields_to_spree_users.rb`

- [ ] **Step 1: Generate migration**

```bash
cd /Users/smokey/Internal/Beeper/code/Beeper-Admin
bin/rails generate migration AddCreatorFieldsToSpreeUsers
```

- [ ] **Step 2: Write migration body**

Replace the generated migration content with:

```ruby
class AddCreatorFieldsToSpreeUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :spree_users, :is_creator,   :boolean, default: false, null: false
    add_column :spree_users, :display_name, :string
    add_column :spree_users, :bio,          :text
    add_column :spree_users, :avatar_url,   :string
    add_column :spree_users, :banner_url,   :string
    add_column :spree_users, :website,      :string
    add_column :spree_users, :instagram,    :string
    add_column :spree_users, :tiktok,       :string
    add_column :spree_users, :youtube,      :string
    add_column :spree_users, :soundcloud,   :string
    add_column :spree_users, :bandcamp,     :string

    add_index :spree_users, :is_creator, where: "is_creator = true"
    add_index :spree_users, :display_name, unique: true, where: "display_name IS NOT NULL"
  end
end
```

- [ ] **Step 3: Run migration on dev DB**

```bash
bin/rails db:migrate
```
Expected: migration runs cleanly, no errors.

- [ ] **Step 4: Verify rollback works**

```bash
bin/rails db:rollback
bin/rails db:migrate
```
Expected: both commands succeed. The down path drops all columns cleanly.

- [ ] **Step 5: Commit**

```bash
git add db/migrate/
git commit -m "add creator profile fields to spree_users"
```

---

### Task 2: [BA] User model decorator — validations + normalizers

**Files:**
- Create or modify: `app/models/spree/user_decorator.rb`
- Create: `spec/models/spree/user_decorator_spec.rb`

- [ ] **Step 1: Write failing tests**

Create `spec/models/spree/user_decorator_spec.rb`:

```ruby
require "rails_helper"

RSpec.describe Spree::User, type: :model do
  describe "display_name validation" do
    it "allows nil display_name" do
      user = build(:user, display_name: nil)
      expect(user).to be_valid
    end

    it "accepts 3-30 chars of a-z0-9_" do
      user = build(:user, display_name: "beeper_99")
      expect(user).to be_valid
    end

    it "rejects uppercase — normalized to lowercase before save" do
      user = create(:user, display_name: "Beeper99")
      expect(user.reload.display_name).to eq("beeper99")
    end

    it "rejects special chars" do
      user = build(:user, display_name: "beep.er")
      expect(user).not_to be_valid
    end

    it "rejects reserved slugs" do
      user = build(:user, display_name: "cart")
      expect(user).not_to be_valid
    end

    it "rejects display_name shorter than 3 chars" do
      user = build(:user, display_name: "ab")
      expect(user).not_to be_valid
    end

    it "enforces uniqueness case-insensitively" do
      create(:user, display_name: "aaron")
      dup = build(:user, display_name: "Aaron")
      expect(dup).not_to be_valid
    end
  end

  describe "is_creator validation" do
    it "requires display_name when is_creator is true" do
      user = build(:user, is_creator: true, display_name: nil)
      expect(user).not_to be_valid
      expect(user.errors[:display_name]).to be_present
    end

    it "allows is_creator false without display_name" do
      user = build(:user, is_creator: false, display_name: nil)
      expect(user).to be_valid
    end
  end

  describe "URL validation" do
    it "requires https for avatar_url" do
      user = build(:user, display_name: "tester", avatar_url: "http://example.com/a.jpg")
      expect(user).not_to be_valid
    end

    it "accepts https avatar_url" do
      user = build(:user, display_name: "tester", avatar_url: "https://example.com/a.jpg")
      expect(user).to be_valid
    end
  end

  describe "social handle normalization" do
    it "strips protocol and domain from instagram field" do
      user = create(:user, display_name: "tester", instagram: "https://instagram.com/beeper_buzz")
      expect(user.reload.instagram).to eq("beeper_buzz")
    end

    it "strips leading @ from handles" do
      user = create(:user, display_name: "tester", tiktok: "@some_user")
      expect(user.reload.tiktok).to eq("some_user")
    end

    it "leaves bare handles unchanged" do
      user = create(:user, display_name: "tester", youtube: "chan_handle")
      expect(user.reload.youtube).to eq("chan_handle")
    end
  end
end
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
bin/rspec spec/models/spree/user_decorator_spec.rb
```
Expected: all tests fail (module doesn't exist yet or validations missing).

- [ ] **Step 3: Write the decorator**

Create `app/models/spree/user_decorator.rb`:

```ruby
module Spree
  module UserDecorator
    DISPLAY_NAME_REGEX = /\A[a-z0-9_]{3,30}\z/

    RESERVED_SLUGS = %w[
      cart checkout login signup account browse about terms privacy home
      reset-password thank-you update-email update-password api admin
      tv user images fonts static assets _next creator-application
    ].freeze

    def self.prepended(base)
      base.class_eval do
        validates :display_name,
          format: { with: DISPLAY_NAME_REGEX, message: "must be 3-30 lowercase letters, numbers, or underscores" },
          exclusion: { in: RESERVED_SLUGS, message: "is reserved" },
          uniqueness: { case_sensitive: false, allow_nil: true },
          allow_nil: true

        validates :display_name, presence: true, if: :is_creator?

        validates :avatar_url, :banner_url,
          format: { with: %r{\Ahttps://}, message: "must start with https://" },
          allow_blank: true

        validates :website,
          format: { with: %r{\Ahttps?://}, message: "must start with http:// or https://" },
          allow_blank: true

        before_validation :normalize_display_name
        before_validation :normalize_social_handles
      end
    end

    private

    def normalize_display_name
      return if display_name.blank?
      self.display_name = display_name.to_s.downcase.strip
    end

    def normalize_social_handles
      %i[instagram tiktok youtube soundcloud bandcamp].each do |platform|
        raw = send(platform).to_s.strip
        next if raw.blank?
        cleaned = raw.sub(%r{\Ahttps?://(www\.)?[^/]+/}, "").sub(/\A@/, "").split("/").first
        send("#{platform}=", cleaned)
      end
    end
  end
end

Spree::User.prepend(Spree::UserDecorator) unless Spree::User.include?(Spree::UserDecorator)
```

- [ ] **Step 4: Run tests again**

```bash
bin/rspec spec/models/spree/user_decorator_spec.rb
```
Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/models/spree/user_decorator.rb spec/models/spree/user_decorator_spec.rb
git commit -m "add creator field validations and normalizers to user model"
```

---

### Task 3: [BA] Admin users_controller decorator — strong params

**Files:**
- Create or modify: `app/controllers/spree/admin/users_controller_decorator.rb`
- Create: `spec/controllers/spree/admin/users_controller_decorator_spec.rb`

- [ ] **Step 1: Write failing test**

```ruby
# spec/controllers/spree/admin/users_controller_decorator_spec.rb
require "rails_helper"

RSpec.describe Spree::Admin::UsersController, type: :controller do
  let(:admin) { create(:admin_user) }
  let(:user) { create(:user) }

  before { sign_in admin }

  it "permits new creator fields" do
    put :update, params: {
      id: user.id,
      user: {
        is_creator: true,
        display_name: "testhandle",
        bio: "A bio",
        website: "https://example.com",
        instagram: "beeper_buzz"
      }
    }
    user.reload
    expect(user.is_creator).to be true
    expect(user.display_name).to eq("testhandle")
    expect(user.bio).to eq("A bio")
    expect(user.instagram).to eq("beeper_buzz")
  end
end
```

- [ ] **Step 2: Run test, verify it fails**

```bash
bin/rspec spec/controllers/spree/admin/users_controller_decorator_spec.rb
```
Expected: fails because the new params are filtered out.

- [ ] **Step 3: Write the decorator**

```ruby
# app/controllers/spree/admin/users_controller_decorator.rb
module Spree
  module Admin
    module UsersControllerDecorator
      CREATOR_ATTRIBUTES = %i[
        is_creator display_name bio avatar_url banner_url
        website instagram tiktok youtube soundcloud bandcamp
      ].freeze

      private

      def permitted_user_attributes
        super + CREATOR_ATTRIBUTES
      end
    end
  end
end

Spree::Admin::UsersController.prepend(Spree::Admin::UsersControllerDecorator)
```

- [ ] **Step 4: Run tests, verify pass**

```bash
bin/rspec spec/controllers/spree/admin/users_controller_decorator_spec.rb
```

- [ ] **Step 5: Commit**

```bash
git add app/controllers/spree/admin/users_controller_decorator.rb spec/controllers/spree/admin/users_controller_decorator_spec.rb
git commit -m "permit creator fields in admin user update"
```

---

### Task 4: [BA] Deface override — creator fields in admin user edit form

**Files:**
- Create: `app/overrides/admin_user_creator_fields.html.erb.deface`

- [ ] **Step 1: Create the Deface override**

```erb
<!-- app/overrides/admin_user_creator_fields.html.erb.deface -->
<!-- insert_bottom "[data-hook='admin_user_form_fields']" -->
<fieldset class="no-border-bottom">
  <legend align="center">Creator Profile</legend>

  <div class="row">
    <div class="col-12">
      <%= f.field_container :is_creator do %>
        <label>
          <%= f.check_box :is_creator %>
          Creator (enables public profile enhancements)
        </label>
        <small class="form-text text-muted">
          Creator status grants access to bio, banner, and social fields on their public profile. Requires display_name.
        </small>
      <% end %>
    </div>
  </div>

  <div class="row">
    <div class="col-6">
      <%= f.field_container :display_name do %>
        <%= f.label :display_name, "Display Name (handle)" %>
        <%= f.text_field :display_name, class: "form-control" %>
      <% end %>
    </div>
    <div class="col-6">
      <%= f.field_container :website do %>
        <%= f.label :website %>
        <%= f.url_field :website, class: "form-control", placeholder: "https://example.com" %>
      <% end %>
    </div>
  </div>

  <div class="row">
    <div class="col-12">
      <%= f.field_container :bio do %>
        <%= f.label :bio %>
        <%= f.text_area :bio, class: "form-control", rows: 3, maxlength: 280 %>
      <% end %>
    </div>
  </div>

  <div class="row">
    <div class="col-6">
      <%= f.field_container :avatar_url do %>
        <%= f.label :avatar_url %>
        <%= f.url_field :avatar_url, class: "form-control", placeholder: "https://..." %>
      <% end %>
    </div>
    <div class="col-6">
      <%= f.field_container :banner_url do %>
        <%= f.label :banner_url %>
        <%= f.url_field :banner_url, class: "form-control", placeholder: "https://..." %>
      <% end %>
    </div>
  </div>

  <div class="row">
    <div class="col-4">
      <%= f.field_container :instagram do %>
        <%= f.label :instagram %>
        <%= f.text_field :instagram, class: "form-control", placeholder: "handle" %>
      <% end %>
    </div>
    <div class="col-4">
      <%= f.field_container :tiktok do %>
        <%= f.label :tiktok %>
        <%= f.text_field :tiktok, class: "form-control", placeholder: "handle" %>
      <% end %>
    </div>
    <div class="col-4">
      <%= f.field_container :youtube do %>
        <%= f.label :youtube %>
        <%= f.text_field :youtube, class: "form-control", placeholder: "handle" %>
      <% end %>
    </div>
  </div>

  <div class="row">
    <div class="col-6">
      <%= f.field_container :soundcloud do %>
        <%= f.label :soundcloud %>
        <%= f.text_field :soundcloud, class: "form-control", placeholder: "handle" %>
      <% end %>
    </div>
    <div class="col-6">
      <%= f.field_container :bandcamp do %>
        <%= f.label :bandcamp %>
        <%= f.text_field :bandcamp, class: "form-control", placeholder: "handle" %>
      <% end %>
    </div>
  </div>
</fieldset>
```

- [ ] **Step 2: Verify override loads**

```bash
bin/rails runner "puts Deface::Override.all.map(&:name)" | grep creator
```
Expected: the override name appears in the list.

- [ ] **Step 3: Manual browser test**

```bash
bin/rails server
```

Visit `http://localhost:3000/admin/users/<any-user-id>/edit`. Verify the "Creator Profile" fieldset appears at the bottom of the form. Fill in `display_name = "testhandle"`, check `is_creator`, click Update. Verify it saves.

- [ ] **Step 4: Commit**

```bash
git add app/overrides/admin_user_creator_fields.html.erb.deface
git commit -m "add creator profile fields to admin user edit form"
```

---

### Task 5: [BA] Storefront account controller decorator — permit creator fields (NOT is_creator)

**Files:**
- Create: `app/controllers/spree/api/v2/storefront/account_controller_decorator.rb`
- Create: `spec/controllers/spree/api/v2/storefront/account_controller_decorator_spec.rb`

- [ ] **Step 1: Write failing tests**

```ruby
# spec/controllers/spree/api/v2/storefront/account_controller_decorator_spec.rb
require "rails_helper"

RSpec.describe "Storefront Account API", type: :request do
  let(:user) { create(:user, display_name: "tester") }
  let(:token) { Doorkeeper::AccessToken.create!(resource_owner_id: user.id) }
  let(:headers) { { "Authorization" => "Bearer #{token.token}" } }

  describe "PATCH /api/v2/storefront/account" do
    it "allows updating display_name, bio, socials" do
      patch "/api/v2/storefront/account", headers: headers, params: {
        user: { display_name: "newhandle", bio: "Fresh bio", instagram: "cool_handle" }
      }
      expect(response).to have_http_status(:ok)
      user.reload
      expect(user.display_name).to eq("newhandle")
      expect(user.bio).to eq("Fresh bio")
      expect(user.instagram).to eq("cool_handle")
    end

    it "SILENTLY REJECTS is_creator (security boundary)" do
      expect(user.is_creator).to be false
      patch "/api/v2/storefront/account", headers: headers, params: {
        user: { is_creator: true, display_name: "tester" }
      }
      expect(response).to have_http_status(:ok)
      user.reload
      expect(user.is_creator).to be false  # still false, param was dropped
    end
  end
end
```

- [ ] **Step 2: Run tests, verify failure**

```bash
bin/rspec spec/controllers/spree/api/v2/storefront/account_controller_decorator_spec.rb
```
Expected: first test fails (fields not permitted). Second test may pass by coincidence — we still need the decorator to make the security boundary explicit.

- [ ] **Step 3: Write the decorator**

```ruby
# app/controllers/spree/api/v2/storefront/account_controller_decorator.rb
module Spree
  module Api
    module V2
      module Storefront
        module AccountControllerDecorator
          STOREFRONT_CREATOR_ATTRIBUTES = %i[
            display_name bio avatar_url banner_url
            website instagram tiktok youtube soundcloud bandcamp
          ].freeze
          # Intentionally excludes :is_creator — only admins can toggle creator status.

          private

          def spree_user_params
            params.require(:user).permit(
              :email, :password, :password_confirmation,
              :first_name, :last_name,
              *STOREFRONT_CREATOR_ATTRIBUTES
            )
          end
        end
      end
    end
  end
end

Spree::Api::V2::Storefront::AccountController.prepend(
  Spree::Api::V2::Storefront::AccountControllerDecorator
)
```

- [ ] **Step 4: Run tests, verify pass**

```bash
bin/rspec spec/controllers/spree/api/v2/storefront/account_controller_decorator_spec.rb
```
Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/controllers/spree/api/v2/storefront/account_controller_decorator.rb spec/controllers/spree/api/v2/storefront/
git commit -m "storefront account API: permit creator fields, lock is_creator"
```

---

### Task 6: [BA] Extend users#profile action — creator fields + gated recent_streams

**Files:**
- Modify: `app/controllers/spree/api/v1/users_controller.rb:252-285`
- Modify or create: `spec/controllers/spree/api/v1/users_controller_spec.rb`

- [ ] **Step 1: Write failing test**

```ruby
# spec/controllers/spree/api/v1/users_controller_spec.rb
require "rails_helper"

RSpec.describe Spree::Api::V1::UsersController, type: :request do
  describe "GET /api/v1/users/:id/profile" do
    context "for a non-creator" do
      let(:user) { create(:user, email: "x@y.com") }

      it "returns the extended profile shape without recent_streams" do
        get "/api/v1/users/#{user.id}/profile"
        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)["response_data"]
        expect(data).to include(
          "id" => user.id,
          "is_creator" => false,
          "display_name" => nil,
          "bio" => nil,
          "avatar_url" => nil,
          "banner_url" => nil
        )
        expect(data["socials"]).to eq({})
        expect(data["recent_streams"]).to eq([])
      end
    end

    context "for a creator with socials" do
      let(:user) {
        create(:user,
          is_creator: true,
          display_name: "beeper",
          bio: "making music",
          instagram: "beeper_buzz",
          website: "https://beeper.buzz"
        )
      }

      it "returns bio, socials, and is_creator true" do
        get "/api/v1/users/#{user.id}/profile"
        data = JSON.parse(response.body)["response_data"]
        expect(data["is_creator"]).to be true
        expect(data["display_name"]).to eq("beeper")
        expect(data["bio"]).to eq("making music")
        expect(data["socials"]).to include("instagram" => "beeper_buzz")
        expect(data["website"]).to eq("https://beeper.buzz")
      end
    end
  end
end
```

- [ ] **Step 2: Run test, verify failure**

```bash
bin/rspec spec/controllers/spree/api/v1/users_controller_spec.rb
```
Expected: fails because new fields missing.

- [ ] **Step 3: Replace the profile action**

In `app/controllers/spree/api/v1/users_controller.rb` at line 252, replace the entire `def profile ... end` block with:

```ruby
def profile
  user = Spree::User.find_by_id(params[:id])
  return error_model(404, "User not found") unless user
  render_profile(user)
end

private

def render_profile(user)
  public_favorites = user.favorites.public_favorites.includes(variant: :product).recent.map do |fav|
    {
      id: fav.id,
      variant_id: fav.variant_id,
      product_id: fav.product&.id,
      name: fav.product&.name,
      slug: fav.product&.slug,
      price: fav.variant&.price&.to_s
    }
  end

  is_following = @current_api_user.present? ? UserFollow.following?(@current_api_user, user) : false

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
    recent_streams: user.is_creator ? fetch_recent_streams(user) : []
  }

  singular_success_model(200, "User profile retrieved successfully", profile_data)
end

def fetch_recent_streams(user)
  return [] unless user.respond_to?(:live_streams)
  user.live_streams
      .where.not(ended_at: nil)
      .order(ended_at: :desc)
      .limit(6)
      .map { |s| { id: s.id, title: s.title, thumbnail_url: s.try(:thumbnail_url), ended_at: s.ended_at } }
end
```

Also update the Swagger schema nearby (around line 195 / 373) — add the new fields to `response_data` for OpenAPI consumers. If tight on time, document the change in commit body instead.

- [ ] **Step 4: Run tests, verify pass**

```bash
bin/rspec spec/controllers/spree/api/v1/users_controller_spec.rb
```

- [ ] **Step 5: Commit**

```bash
git add app/controllers/spree/api/v1/users_controller.rb spec/controllers/spree/api/v1/users_controller_spec.rb
git commit -m "extend users#profile with creator fields, gated recent_streams"
```

---

### Task 7: [BA] New profile_by_handle action + route

**Files:**
- Modify: `app/controllers/spree/api/v1/users_controller.rb` (add new action)
- Modify: `config/routes.rb` (add route)
- Modify: `spec/controllers/spree/api/v1/users_controller_spec.rb` (add tests)

- [ ] **Step 1: Add failing test**

Append to `spec/controllers/spree/api/v1/users_controller_spec.rb`:

```ruby
describe "GET /api/v1/users/by_handle/:handle/profile" do
  let!(:user) { create(:user, display_name: "beeper", is_creator: true) }

  it "finds user by handle (case-insensitive)" do
    get "/api/v1/users/by_handle/Beeper/profile"
    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)["response_data"]
    expect(data["id"]).to eq(user.id)
    expect(data["display_name"]).to eq("beeper")
  end

  it "404s for unknown handle" do
    get "/api/v1/users/by_handle/unknown/profile"
    expect(response).to have_http_status(:not_found)
  end

  it "handles numeric-only display_name without ambiguity" do
    numeric_user = create(:user, display_name: "808")
    get "/api/v1/users/by_handle/808/profile"
    data = JSON.parse(response.body)["response_data"]
    expect(data["id"]).to eq(numeric_user.id)
  end
end
```

- [ ] **Step 2: Run test, verify failure**

```bash
bin/rspec spec/controllers/spree/api/v1/users_controller_spec.rb
```
Expected: 3 new failures (route not found).

- [ ] **Step 3: Add the action**

In `app/controllers/spree/api/v1/users_controller.rb`, below the existing `def profile`:

```ruby
def profile_by_handle
  handle = params[:handle].to_s.downcase
  user = Spree::User.find_by(display_name: handle)
  return error_model(404, "User not found") unless user
  render_profile(user)
end
```

- [ ] **Step 4: Add the route**

In `config/routes.rb`, find the existing users routes block and add:

```ruby
namespace :api do
  namespace :v1 do
    # ... existing routes
    get "users/by_handle/:handle/profile", to: "users#profile_by_handle"
  end
end
```

(Adapt to wherever the existing users routes are declared — search for `"users/:id/profile"` and add the new line directly below it.)

- [ ] **Step 5: Run tests, verify pass**

```bash
bin/rspec spec/controllers/spree/api/v1/users_controller_spec.rb
```

- [ ] **Step 6: Commit**

```bash
git add app/controllers/spree/api/v1/users_controller.rb config/routes.rb spec/controllers/spree/api/v1/users_controller_spec.rb
git commit -m "add /users/by_handle/:handle/profile endpoint for vanity URL lookups"
```

---

### Task 8: [BA] Integration test — is_creator requires display_name

**Files:**
- Modify: `spec/controllers/spree/admin/users_controller_decorator_spec.rb`

- [ ] **Step 1: Add the test**

```ruby
it "refuses to set is_creator=true without a display_name" do
  user = create(:user, display_name: nil)
  put :update, params: { id: user.id, user: { is_creator: true } }
  user.reload
  expect(user.is_creator).to be false
  expect(flash[:error]).to be_present  # or response.body.include?("Display name can't be blank")
end
```

- [ ] **Step 2: Run test**

```bash
bin/rspec spec/controllers/spree/admin/users_controller_decorator_spec.rb
```
Expected: pass (validation from Task 2 should already enforce this).

- [ ] **Step 3: Commit**

```bash
git add spec/controllers/spree/admin/users_controller_decorator_spec.rb
git commit -m "test: verify is_creator requires display_name"
```

---

### Task 9: [BA] Deploy backend to Heroku

- [ ] **Step 1: Review all committed changes**

```bash
git log origin/main..HEAD --oneline
```
Expected: 8 commits (Tasks 1-8).

- [ ] **Step 2: Push to origin**

```bash
git push origin @aaron.smulktis/develop
```

- [ ] **Step 3: Deploy to Heroku prod**

```bash
git push heroku @aaron.smulktis/develop:main
```

Watch build output for migration errors.

- [ ] **Step 4: Run migration on Heroku**

```bash
heroku run bin/rails db:migrate -a beeper-admin-prod
```
Expected: migration runs cleanly.

- [ ] **Step 5: Toggle self as creator via admin**

Visit `https://admin.beeper.buzz/admin/users/<my-user-id>/edit`, fill in `display_name = "aaron"`, check `is_creator`, save.

- [ ] **Step 6: Verify API responses**

```bash
curl -s https://admin.beeper.buzz/api/v1/users/<id>/profile | jq '.response_data | {is_creator, display_name, bio, socials}'
curl -s https://admin.beeper.buzz/api/v1/users/by_handle/aaron/profile | jq '.response_data | {is_creator, display_name}'
```
Expected: both return the creator record.

- [ ] **Step 7: Mark Phase A complete**

No code commit — just a checkpoint note in the plan.

---

## Phase B: Beeper-Frontend

### Task 10: [BF] Update useUserProfile types

**Files:**
- Modify: `hooks/useUserProfile/index.ts`

- [ ] **Step 1: Extend UserProfileData interface**

Replace the existing `interface UserProfileData` with:

```ts
export interface UserProfileSocials {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  soundcloud?: string;
  bandcamp?: string;
}

export interface UserProfileStream {
  id: number;
  title: string;
  thumbnail_url?: string;
  ended_at: string;
}

export interface UserProfileData {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name: string | null;
  is_creator: boolean;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website: string | null;
  socials: UserProfileSocials;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  public_favorites: Array<{
    id: number;
    variant_id: number;
    product_id: number;
    name: string;
    slug: string;
    price: string;
  }>;
  recent_streams: UserProfileStream[];
}
```

- [ ] **Step 2: Add fetchUserProfileByHandle helper**

Also add a new fetcher alongside `fetchUserProfile`:

```ts
export const fetchUserProfileByHandle = async (
  handle: string
): Promise<UserProfileData> => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token?.access_token) {
    headers["Authorization"] = `Bearer ${token.access_token}`;
  }

  const response = await fetch(
    `${API_BASE}/api/v1/users/by_handle/${encodeURIComponent(handle)}/profile`,
    { headers }
  );

  if (!response.ok) throw new Error("Failed to fetch user profile");
  const data: UserProfileResponse = await response.json();
  return data.response_data;
};

export const useUserProfileByHandle = (handle: string) => {
  return useQuery(
    [QueryKeys.USER_PROFILE, "handle", handle],
    () => fetchUserProfileByHandle(handle),
    { enabled: !!handle, staleTime: 30000, retry: false }
  );
};
```

- [ ] **Step 3: Verify compile**

```bash
yarn tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add hooks/useUserProfile/index.ts
git commit -m "extend UserProfileData with creator fields + handle lookup"
```

---

### Task 11: [BF] Update useAccounts types for extended profile save

**Files:**
- Modify: `hooks/useAccounts/index.ts`

- [ ] **Step 1: Update updateAccountInfo signature**

Find the existing `updateAccountInfo` function (around line 30) and update its param type:

```ts
export const updateAccountInfo = async (params: {
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  password_confirmation?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  website?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  soundcloud?: string;
  bandcamp?: string;
}) => {
  // ... existing implementation (no change needed, it spreads params)
};
```

- [ ] **Step 2: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useAccounts/index.ts
git commit -m "extend updateAccountInfo params with creator fields"
```

---

### Task 12: [BF] AccountProfile — extract CreatorFieldsSection

**Files:**
- Create: `components/AccountProfile/CreatorFieldsSection.tsx`

- [ ] **Step 1: Create the sub-component**

```tsx
// components/AccountProfile/CreatorFieldsSection.tsx
import React from "react";
import { Field } from "formik";
import { FormikInput } from "../FormikWrappers";

export const CreatorFieldsSection = () => (
  <div className="glass-panel p-6">
    <h2 className="font-micro5 text-xs tracking-widest text-neon-magenta mb-2">
      CREATOR PROFILE
    </h2>
    <p className="text-xs text-white/40 mb-4">
      These fields only appear on your public profile. Handles should be bare (no @ or URL).
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field name="avatar_url" component={FormikInput} label="Avatar URL (https://)" />
      <Field name="banner_url" component={FormikInput} label="Banner URL (https://)" />
    </div>
    <div className="mt-4">
      <Field name="website" component={FormikInput} label="Website (https://)" />
    </div>

    <h3 className="font-micro5 text-xs tracking-widest text-white/50 mt-6 mb-3">
      SOCIAL HANDLES
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field name="instagram" component={FormikInput} label="Instagram" />
      <Field name="tiktok" component={FormikInput} label="TikTok" />
      <Field name="youtube" component={FormikInput} label="YouTube" />
      <Field name="soundcloud" component={FormikInput} label="SoundCloud" />
      <Field name="bandcamp" component={FormikInput} label="Bandcamp" />
    </div>
  </div>
);
```

- [ ] **Step 2: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/AccountProfile/CreatorFieldsSection.tsx
git commit -m "add CreatorFieldsSection for profile editor"
```

---

### Task 13: [BF] AccountProfile — wire up conditional rendering

**Files:**
- Modify: `components/AccountProfile/AccountProfile.tsx`

- [ ] **Step 1: Import CreatorFieldsSection and extend initial values**

At the top of `AccountProfile.tsx`, add:

```tsx
import { CreatorFieldsSection } from "./CreatorFieldsSection";
```

Extend `initialValues` in the Formik config to include all the new fields, sourced from `attrs`:

```tsx
initialValues={{
  first_name: attrs.first_name || "",
  last_name: attrs.last_name || "",
  email: attrs.email || "",
  display_name: attrs.display_name || "",
  bio: attrs.bio || "",
  address: "",
  unit: "",
  // creator-only (only rendered if is_creator)
  avatar_url: attrs.avatar_url || "",
  banner_url: attrs.banner_url || "",
  website: attrs.website || "",
  instagram: attrs.instagram || "",
  tiktok: attrs.tiktok || "",
  youtube: attrs.youtube || "",
  soundcloud: attrs.soundcloud || "",
  bandcamp: attrs.bandcamp || ""
}}
```

- [ ] **Step 2: Extend onSubmit to include new fields**

```tsx
onSubmit={async (values, { setSubmitting }) => {
  try {
    await updateAccount.mutateAsync({
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      display_name: values.display_name,
      bio: values.bio,
      ...(attrs.is_creator && {
        avatar_url: values.avatar_url,
        banner_url: values.banner_url,
        website: values.website,
        instagram: values.instagram,
        tiktok: values.tiktok,
        youtube: values.youtube,
        soundcloud: values.soundcloud,
        bandcamp: values.bandcamp
      })
    });
    Alert.fire({ icon: "success", title: "Profile updated!" });
  } catch (err: any) {
    Alert.fire({ icon: "error", title: "Update failed", text: err.message });
  } finally {
    setSubmitting(false);
  }
}}
```

- [ ] **Step 3: Conditionally render the CreatorFieldsSection**

Find the existing `CREATOR PROFILE` stub (around line 130) that says "Coming soon" and replace the entire block with:

```tsx
{attrs.is_creator ? (
  <CreatorFieldsSection />
) : (
  <div className="glass-panel p-6 opacity-70">
    <h2 className="font-micro5 text-xs tracking-widest text-white/50 mb-2">
      CREATOR STATUS
    </h2>
    <p className="text-xs text-white/40">
      Interested in selling on Beeper? Creator status is manually approved.{" "}
      <a href="mailto:hello@beeper.buzz?subject=Creator%20Application" className="text-neon-cyan underline">
        Reach out
      </a>{" "}
      to apply.
    </p>
  </div>
)}
```

- [ ] **Step 4: Verify compile**

```bash
yarn tsc --noEmit
yarn eslint components/AccountProfile/
```

- [ ] **Step 5: Manual test locally**

```bash
yarn dev
```

Visit `http://localhost:3000/account/profile`. As a non-creator, verify the "Creator Status" card renders with the mailto link. As a creator (toggle in admin first), verify the full CreatorFieldsSection renders with all 8 fields.

- [ ] **Step 6: Commit**

```bash
git add components/AccountProfile/AccountProfile.tsx
git commit -m "conditional creator section in profile editor"
```

---

### Task 14: [BF] Feature flag env var

**Files:**
- Modify: `.env.local.example` (if exists) or document in README
- Modify: `next.config.js`

- [ ] **Step 1: Add env var**

In `.env.local`:

```
NEXT_PUBLIC_CREATOR_PROFILE_ENABLED=false
```

In `.env.local.example` (or wherever defaults are documented):

```
NEXT_PUBLIC_CREATOR_PROFILE_ENABLED=false  # Flip to "true" to enable new profile layout
```

- [ ] **Step 2: Verify the env var is exposed**

Next.js automatically exposes `NEXT_PUBLIC_*` vars to client code. No config change needed. Verify by adding `console.log(process.env.NEXT_PUBLIC_CREATOR_PROFILE_ENABLED)` temporarily in `pages/_app.tsx` and reloading.

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "add NEXT_PUBLIC_CREATOR_PROFILE_ENABLED feature flag env var"
```

---

### Task 15: [BF] Move current UserProfile to legacy

**Files:**
- Move: `components/UserProfile/UserProfile.tsx` → `components/UserProfile/legacy/UserProfile.tsx`
- Modify: `components/UserProfile/index.ts` (if exists) to keep exporting from legacy for now

- [ ] **Step 1: Create legacy folder and copy the file**

```bash
mkdir -p components/UserProfile/legacy
git mv components/UserProfile/UserProfile.tsx components/UserProfile/legacy/UserProfile.tsx
```

- [ ] **Step 2: Update the legacy component import paths**

Legacy file may have relative imports that break after the move. Fix any `from "./types"` → `from "../types"` etc.

- [ ] **Step 3: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/UserProfile/
git commit -m "move UserProfile to /legacy for side-by-side rollout"
```

---

### Task 16: [BF] Create SocialChip component

**Files:**
- Create: `components/UserProfile/SocialChip.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/UserProfile/SocialChip.tsx
import React from "react";
import { Instagram, Youtube, Globe } from "lucide-react";

// Custom SVGs for platforms not in lucide
const TikTokIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/>
  </svg>
);

const SoundCloudIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 17.939h-1V9.061c.316-.083.65-.124 1-.124.34 0 .67.041 1 .124v8.878A3.93 3.93 0 0 1 7 17.939zM4 17.939H3v-7c.32-.081.653-.124 1-.124s.68.043 1 .124v7zm15.354-9.82a5.942 5.942 0 0 0-1.7.247 6 6 0 0 0-5.6-3.896c-1.42 0-2.76.493-3.814 1.35v11.938h11.114c2.043 0 3.7-1.657 3.7-3.7s-1.657-3.7-3.7-3.7v-.239z"/>
  </svg>
);

const BandcampIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/>
  </svg>
);

type Platform = "instagram" | "tiktok" | "youtube" | "soundcloud" | "bandcamp" | "website";

const buildUrl = (platform: Platform, handle: string): string => {
  switch (platform) {
    case "instagram": return `https://instagram.com/${handle}`;
    case "tiktok":    return `https://tiktok.com/@${handle}`;
    case "youtube":   return `https://youtube.com/@${handle}`;
    case "soundcloud": return `https://soundcloud.com/${handle}`;
    case "bandcamp":  return `https://${handle}.bandcamp.com`;
    case "website":   return handle.startsWith("http") ? handle : `https://${handle}`;
  }
};

const getIcon = (platform: Platform) => {
  switch (platform) {
    case "instagram": return <Instagram className="h-4 w-4" />;
    case "tiktok": return <TikTokIcon />;
    case "youtube": return <Youtube className="h-4 w-4" />;
    case "soundcloud": return <SoundCloudIcon />;
    case "bandcamp": return <BandcampIcon />;
    case "website": return <Globe className="h-4 w-4" />;
  }
};

const getLabel = (platform: Platform, handle: string): string => {
  if (platform === "website") {
    return handle.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return handle;
};

interface SocialChipProps {
  platform: Platform;
  handle: string;
}

export const SocialChip = ({ platform, handle }: SocialChipProps) => (
  <a
    href={buildUrl(platform, handle)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-1.5 font-mono text-xs text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/15"
  >
    {getIcon(platform)}
    <span>{getLabel(platform, handle)}</span>
  </a>
);
```

- [ ] **Step 2: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/UserProfile/SocialChip.tsx
git commit -m "add SocialChip component for creator socials"
```

---

### Task 17: [BF] Create CreatorBadge component

**Files:**
- Create: `components/UserProfile/CreatorBadge.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/UserProfile/CreatorBadge.tsx
import React from "react";
import { BadgeCheck } from "lucide-react";

export const CreatorBadge = () => (
  <span
    className="inline-flex items-center gap-1 rounded-full border border-neon-magenta/40 bg-neon-magenta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon-magenta"
    title="Verified Creator"
  >
    <BadgeCheck className="h-3 w-3" />
    Creator
  </span>
);
```

- [ ] **Step 2: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/UserProfile/CreatorBadge.tsx
git commit -m "add CreatorBadge component"
```

---

### Task 18: [BF] Create ProfileBanner component

**Files:**
- Create: `components/UserProfile/ProfileBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/UserProfile/ProfileBanner.tsx
import React from "react";
import { Share2, UserPlus, UserMinus } from "lucide-react";
import { UserProfileData } from "@hooks/useUserProfile";
import { CreatorBadge } from "./CreatorBadge";
import { SocialChip } from "./SocialChip";

interface ProfileBannerProps {
  user: UserProfileData;
  onFollowToggle: () => void;
  onShare: () => void;
}

const getDisplayName = (user: UserProfileData): string => {
  if (user.display_name) return user.display_name;
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (full) return full;
  return user.email.split("@")[0] || "User";
};

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

export const ProfileBanner = ({ user, onFollowToggle, onShare }: ProfileBannerProps) => {
  const displayName = getDisplayName(user);
  const showBanner = user.is_creator;
  const bannerStyle = user.banner_url
    ? { backgroundImage: `url(${user.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg, #7c3aed 0%, #ff008a 50%, #00ffff 100%)" };

  return (
    <div className="relative">
      {showBanner && (
        <div
          className="h-40 md:h-64 rounded-xl overflow-hidden border border-glass-border"
          style={bannerStyle}
          aria-hidden="true"
        />
      )}

      <div className={`flex items-start gap-6 rounded-xl border border-glass-border glass-panel p-6 ${showBanner ? "-mt-12 relative mx-4 md:mx-8" : ""}`}>
        {/* Avatar */}
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={`${displayName}'s avatar`}
            className="h-20 w-20 shrink-0 rounded-full border-2 border-glass-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-neon-cyan/10 font-title text-2xl font-bold text-neon-cyan">
            {getInitials(displayName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="neon-text-magenta font-pressstart text-lg sm:text-xl">
              {displayName}
            </h1>
            {user.is_creator && <CreatorBadge />}
          </div>
          {user.display_name && (
            <p className="mt-0.5 font-mono text-xs text-white/40">@{user.display_name}</p>
          )}

          {user.bio && (
            <p className="mt-3 font-body text-sm text-white/70 max-w-prose">{user.bio}</p>
          )}

          <div className="mt-4 flex items-center gap-6">
            <div className="text-center">
              <span className="block font-title text-lg font-bold text-white">
                {user.followers_count?.toLocaleString()}
              </span>
              <span className="font-body text-xs text-white/50">Followers</span>
            </div>
            <div className="text-center">
              <span className="block font-title text-lg font-bold text-white">
                {user.following_count?.toLocaleString()}
              </span>
              <span className="font-body text-xs text-white/50">Following</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onFollowToggle}
              className="flex items-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 font-body text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20"
            >
              {user.is_following ? <><UserMinus className="h-3 w-3" /> Unfollow</> : <><UserPlus className="h-3 w-3" /> Follow</>}
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 font-body text-xs text-white/70 transition-colors hover:text-white"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>

          {user.is_creator && (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.socials.instagram && <SocialChip platform="instagram" handle={user.socials.instagram} />}
              {user.socials.tiktok && <SocialChip platform="tiktok" handle={user.socials.tiktok} />}
              {user.socials.youtube && <SocialChip platform="youtube" handle={user.socials.youtube} />}
              {user.socials.soundcloud && <SocialChip platform="soundcloud" handle={user.socials.soundcloud} />}
              {user.socials.bandcamp && <SocialChip platform="bandcamp" handle={user.socials.bandcamp} />}
              {user.website && <SocialChip platform="website" handle={user.website} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/UserProfile/ProfileBanner.tsx
git commit -m "add ProfileBanner component with adaptive creator layout"
```

---

### Task 19: [BF] Create ProfileTabs, ProfileFavorites, ProfileStreams, ProfileShopPlaceholder

**Files:**
- Create: `components/UserProfile/ProfileTabs.tsx`
- Create: `components/UserProfile/ProfileFavorites.tsx`
- Create: `components/UserProfile/ProfileStreams.tsx`
- Create: `components/UserProfile/ProfileShopPlaceholder.tsx`

- [ ] **Step 1: ProfileTabs**

```tsx
// components/UserProfile/ProfileTabs.tsx
import React from "react";
import { cn } from "@lib/utils";

export type ProfileTab = "favorites" | "streams" | "shop";

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  showStreams: boolean;
  showShop: boolean;
}

export const ProfileTabs = ({ active, onChange, showStreams, showShop }: ProfileTabsProps) => {
  const tabClass = (tab: ProfileTab) => cn(
    "px-4 py-2 font-pressstart text-xs uppercase tracking-wider transition-colors border-b-2",
    active === tab
      ? "text-neon-cyan border-neon-cyan"
      : "text-white/50 border-transparent hover:text-white"
  );

  return (
    <div className="mb-6 mt-8 flex gap-2 border-b border-glass-border overflow-x-auto">
      <button className={tabClass("favorites")} onClick={() => onChange("favorites")}>
        Favorites
      </button>
      {showStreams && (
        <button className={tabClass("streams")} onClick={() => onChange("streams")}>
          Streams
        </button>
      )}
      {showShop && (
        <button className={tabClass("shop")} onClick={() => onChange("shop")}>
          Shop
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 2: ProfileFavorites**

```tsx
// components/UserProfile/ProfileFavorites.tsx
import React from "react";
import { useRouter } from "next/router";
import { UserProfileData } from "@hooks/useUserProfile";

interface ProfileFavoritesProps {
  favorites: UserProfileData["public_favorites"];
}

export const ProfileFavorites = ({ favorites }: ProfileFavoritesProps) => {
  const router = useRouter();

  if (!favorites || favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center text-white/50">
        No public favorites
      </div>
    );
  }

  return (
    <div className="product-grid-comfortable">
      {favorites.map((favorite) => (
        <div
          key={favorite.id}
          onClick={() => router.push(`/${favorite.slug}`)}
          className="group cursor-pointer overflow-hidden rounded-xl border border-glass-border glass-panel transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="aspect-square bg-muted" />
          <div className="p-4">
            <h3 className="font-title text-sm font-semibold text-white">{favorite.name}</h3>
            <p className="mt-1 font-body text-sm text-white/50">${favorite.price}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: ProfileStreams**

```tsx
// components/UserProfile/ProfileStreams.tsx
import React from "react";
import { useRouter } from "next/router";
import { Play } from "lucide-react";
import { UserProfileStream } from "@hooks/useUserProfile";

interface ProfileStreamsProps {
  streams: UserProfileStream[];
}

const formatEndedAt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const ProfileStreams = ({ streams }: ProfileStreamsProps) => {
  const router = useRouter();

  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center text-white/50">
        No recent streams
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {streams.map((stream) => (
        <button
          key={stream.id}
          onClick={() => router.push(`/tv/${stream.id}`)}
          className="group text-left glass-panel rounded-xl overflow-hidden hover:-translate-y-0.5 transition-all"
        >
          <div className="relative aspect-video bg-surface-deep">
            {stream.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stream.thumbnail_url} alt={stream.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-neon-magenta/20 to-neon-cyan/20" />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <Play className="h-12 w-12 text-white" />
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-title text-sm font-semibold text-white truncate">{stream.title}</h3>
            <p className="mt-1 font-mono text-xs text-white/40">Ended {formatEndedAt(stream.ended_at)}</p>
          </div>
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 4: ProfileShopPlaceholder**

```tsx
// components/UserProfile/ProfileShopPlaceholder.tsx
import React from "react";
import { ShoppingBag } from "lucide-react";

export const ProfileShopPlaceholder = ({ displayName }: { displayName: string }) => (
  <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center">
    <ShoppingBag className="mb-4 h-12 w-12 text-white/30" />
    <h2 className="mb-2 font-title text-lg text-white">Creator shop coming soon</h2>
    <p className="font-body text-sm text-white/50">
      {displayName} will be selling their own products on Beeper.
    </p>
  </div>
);
```

- [ ] **Step 5: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/UserProfile/ProfileTabs.tsx components/UserProfile/ProfileFavorites.tsx components/UserProfile/ProfileStreams.tsx components/UserProfile/ProfileShopPlaceholder.tsx
git commit -m "add ProfileTabs, Favorites, Streams, ShopPlaceholder sub-components"
```

---

### Task 20: [BF] Rewrite UserProfile.tsx as composition + feature flag toggle

**Files:**
- Create: `components/UserProfile/UserProfile.tsx` (the new composition, replacing the moved-to-legacy one)

- [ ] **Step 1: Write the new composition**

```tsx
// components/UserProfile/UserProfile.tsx
import React, { useState } from "react";
import Head from "next/head";
import { useUserProfile, useUserProfileByHandle, useFollowUser, useUnfollowUser } from "@hooks/useUserProfile";
import { Loading } from "@components/Loading";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileTabs, ProfileTab } from "./ProfileTabs";
import { ProfileFavorites } from "./ProfileFavorites";
import { ProfileStreams } from "./ProfileStreams";
import { ProfileShopPlaceholder } from "./ProfileShopPlaceholder";
import { UserProfile as LegacyUserProfile } from "./legacy/UserProfile";

interface UserProfileProps {
  username: string;
}

const FLAG_ENABLED = process.env.NEXT_PUBLIC_CREATOR_PROFILE_ENABLED === "true";

export const UserProfile: React.FC<UserProfileProps> = ({ username }) => {
  // Feature flag: fall back to the legacy single-file component if disabled
  if (!FLAG_ENABLED) {
    return <LegacyUserProfile username={username} />;
  }

  return <UserProfileInner username={username} />;
};

const UserProfileInner: React.FC<UserProfileProps> = ({ username }) => {
  const { data: user, isLoading, error } = useUserProfileByHandle(username);
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const [activeTab, setActiveTab] = useState<ProfileTab>("favorites");

  const handleFollowToggle = () => {
    if (!user) return;
    if (user.is_following) {
      unfollowMutation.mutate(String(user.id));
    } else {
      followMutation.mutate(String(user.id));
    }
  };

  const handleShare = async () => {
    if (!user) return;
    const url = `https://beeper.buzz/${user.display_name || user.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: user.display_name || "Beeper Profile", url });
        return;
      } catch {
        // User cancelled; fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    // TODO: toast on success
  };

  if (isLoading) {
    return (
      <div className="section-container py-10">
        <Loading />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="section-container py-10">
        <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center text-white/50">
          User not found
        </div>
      </div>
    );
  }

  const displayName = user.display_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Beeper User";
  const ogImage = user.banner_url || user.avatar_url || "/images/beeper-og-image.png";

  return (
    <>
      <Head>
        <title>{displayName} · Beeper</title>
        <meta name="description" content={user.bio || `${displayName} on Beeper`} />
        <meta property="og:title" content={`${displayName} · Beeper`} />
        <meta property="og:description" content={user.bio || ""} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={`https://beeper.buzz/${user.display_name || user.id}`} />
        <meta property="og:type" content="profile" />
      </Head>

      <div className="section-container py-10">
        <ProfileBanner user={user} onFollowToggle={handleFollowToggle} onShare={handleShare} />

        <ProfileTabs
          active={activeTab}
          onChange={setActiveTab}
          showStreams={user.is_creator && user.recent_streams.length > 0}
          showShop={user.is_creator}
        />

        {activeTab === "favorites" && <ProfileFavorites favorites={user.public_favorites} />}
        {activeTab === "streams" && <ProfileStreams streams={user.recent_streams} />}
        {activeTab === "shop" && <ProfileShopPlaceholder displayName={displayName} />}
      </div>
    </>
  );
};
```

- [ ] **Step 2: Verify compile**

```bash
yarn tsc --noEmit
yarn eslint components/UserProfile/
```

- [ ] **Step 3: Commit**

```bash
git add components/UserProfile/UserProfile.tsx
git commit -m "rewrite UserProfile as composition with feature flag fallback"
```

---

### Task 21: [BF] Update pages/[slug].tsx — reserved slug list + handle lookup

**Files:**
- Modify: `pages/[slug].tsx`

- [ ] **Step 1: Update RESERVED_SLUGS list**

Extend `RESERVED_SLUGS` to match the Rails model's `RESERVED_SLUGS`:

```tsx
const RESERVED_SLUGS = [
  "cart", "checkout", "login", "signup", "account", "browse",
  "about", "terms", "privacy", "home", "reset-password", "thank-you",
  "update-email", "update-password", "api", "admin", "tv", "user",
  "images", "fonts", "static", "assets", "_next", "creator-application"
];
```

- [ ] **Step 2: Update the profile lookup branch**

Find the existing server-side profile lookup (around line 60) and replace it with a call to the new `by_handle` endpoint:

```tsx
// 2. Try user profile by handle
try {
  const adminUrl = process.env.NEXT_PUBLIC_SPREE_API_URL || "http://localhost:3001";
  const profileRes = await fetch(
    `${adminUrl}/api/v1/users/by_handle/${encodeURIComponent(slug.toLowerCase())}/profile`
  );
  if (profileRes.ok) {
    const profileJson = await profileRes.json();
    return {
      props: {
        type: "profile",
        slug,
        profileData: profileJson.response_data
      }
    };
  }
} catch {
  // fall through
}

return { notFound: true };
```

- [ ] **Step 3: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 4: Manual test**

```bash
yarn dev
```

Visit `http://localhost:3000/aaron` (where `aaron` has `is_creator = true`). Verify it loads the profile page.

Visit `http://localhost:3000/cart` — should route to the cart page (reserved slug), not a 404.

Visit `http://localhost:3000/Aaron` (mixed case) — should resolve to the same profile (handle is lowercased on lookup).

- [ ] **Step 5: Commit**

```bash
git add pages/[slug].tsx
git commit -m "update slug router: reserved list + handle-based profile lookup"
```

---

### Task 22: [BF] Deploy frontend with flag OFF

- [ ] **Step 1: Review all commits**

```bash
git log origin/main..HEAD --oneline
```

- [ ] **Step 2: Push to origin**

```bash
git push origin main
```

- [ ] **Step 3: Verify Heroku prod still uses flag=false**

```bash
heroku config:get NEXT_PUBLIC_CREATOR_PROFILE_ENABLED -a beeper-frontend-prod
```
Expected: empty or `"false"`.

- [ ] **Step 4: Trigger auto-deploy (or push to heroku manually)**

```bash
git push heroku main
```

- [ ] **Step 5: Verify legacy profile still loads**

Visit `https://beeper.buzz/aaron` — should render the legacy UserProfile with no change.

---

### Task 23: [BF] Flip the flag in production

- [ ] **Step 1: Set the env var**

```bash
heroku config:set NEXT_PUBLIC_CREATOR_PROFILE_ENABLED=true -a beeper-frontend-prod
```

This triggers an auto-rebuild because `NEXT_PUBLIC_*` vars are baked into the bundle at build time.

- [ ] **Step 2: Watch the build**

```bash
heroku logs --tail -a beeper-frontend-prod
```

Wait for "Build succeeded" or equivalent.

- [ ] **Step 3: Verify the new profile layout loads**

Visit `https://beeper.buzz/aaron`. Expected: new `ProfileBanner` with banner image, `CreatorBadge`, social chips, tabs.

Also test a non-creator profile — expected: cleaner layout, no banner/badge/socials, still shows favorites.

- [ ] **Step 4: Rollback test (dry-run)**

If anything looks broken:

```bash
heroku config:set NEXT_PUBLIC_CREATOR_PROFILE_ENABLED=false -a beeper-frontend-prod
```

Verify the legacy layout comes back. Then flip it on again once the bug is identified.

---

### Task 24: [BF] Smoke test manual QA checklist

- [ ] **Step 1: Creator profile visual check**
  - Banner renders (or gradient fallback)
  - Avatar image or initials fallback
  - Pink glow title
  - CreatorBadge next to display name
  - Bio text
  - Follower/following counts
  - Follow / Share buttons work
  - Social chips render each filled handle
  - Tabs: Favorites / Streams / Shop visible
  - Streams tab shows ended streams with thumbnails
  - Shop tab shows "coming soon" placeholder

- [ ] **Step 2: Non-creator profile visual check**
  - No banner
  - Initials avatar
  - Pink glow title (same style)
  - No badge
  - No socials row
  - Follower/following counts + Follow + Share
  - Only Favorites tab visible

- [ ] **Step 3: Mobile responsive check**
  - Banner shrinks to `h-40` on mobile
  - Tabs horizontally scroll if needed
  - Social chips wrap to multiple rows
  - Banner + avatar stack gracefully on narrow screens

- [ ] **Step 4: Edge cases**
  - User with no display_name (use non-creator test user) — falls back to first+last or email
  - Creator with zero social handles — no chips render, no empty row
  - Creator with `banner_url = null` — gradient fallback shows
  - Creator with `avatar_url = null` — initials fallback shows
  - Visit `/cart` — still routes to cart (reserved slug)
  - Visit `/Aaron` (mixed case) — resolves to lowercased handle

- [ ] **Step 5: Account profile editor check**
  - As non-creator: "Creator Status" card with mailto link
  - As creator: full CreatorFieldsSection with 8 social/URL fields
  - Save form — values persist after reload
  - Invalid URL in avatar_url — surfaces validation error from API

---

## Phase C: Cleanup (after 1 week of stability)

### Task 25: [BF] Remove legacy UserProfile + feature flag

**Files:**
- Delete: `components/UserProfile/legacy/UserProfile.tsx`
- Modify: `components/UserProfile/UserProfile.tsx` (remove feature flag guard)

- [ ] **Step 1: Delete legacy file**

```bash
rm components/UserProfile/legacy/UserProfile.tsx
rmdir components/UserProfile/legacy
```

- [ ] **Step 2: Remove feature flag check**

In `components/UserProfile/UserProfile.tsx`, remove the `FLAG_ENABLED` check and the legacy import. `UserProfile` becomes a thin wrapper that directly renders `UserProfileInner`, or better: rename `UserProfileInner` to `UserProfile` and export it.

- [ ] **Step 3: Remove env var from Heroku**

```bash
heroku config:unset NEXT_PUBLIC_CREATOR_PROFILE_ENABLED -a beeper-frontend-prod
```

- [ ] **Step 4: Verify compile**

```bash
yarn tsc --noEmit
```

- [ ] **Step 5: Commit + deploy**

```bash
git add components/UserProfile/
git commit -m "remove legacy UserProfile and feature flag"
git push origin main
git push heroku main
```

---

## Summary

Total tasks: 25. Roughly 10 backend, 14 frontend, 1 cleanup.

Critical path:
1. Tasks 1-9 (backend) must ship first and be deployed + migrated before frontend.
2. Tasks 10-21 can land incrementally on `main` as long as the feature flag stays `false`.
3. Task 22 deploys with flag off, 23 flips it on, 24 is manual QA.
4. Task 25 is a follow-up a week later.

**Rollback paths:**
- Frontend regression → `heroku config:set NEXT_PUBLIC_CREATOR_PROFILE_ENABLED=false` (instant)
- Backend regression → revert individual decorator or migration with `rails db:rollback`
- Worst case → `git revert` the merge commit and redeploy
