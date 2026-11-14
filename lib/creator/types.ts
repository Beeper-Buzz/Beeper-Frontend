// Shapes of the creator, library and digital-summary endpoints (spec §1.1,
// §1.3). Kept tolerant: optional where the backend may omit a field.

import type { DigitalKind } from "../marketplace";

export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export interface PortfolioLink {
  label: string;
  url: string;
}

export interface CreatorApplication {
  id: number;
  status: ApplicationStatus;
  display_name: string;
  kinds: DigitalKind[];
  portfolio_links: PortfolioLink[];
  about: string;
  samples?: { filename: string; url?: string }[];
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface CreatorApplicationInput {
  display_name: string;
  kinds: DigitalKind[];
  portfolio_links: PortfolioLink[];
  about: string;
  sample_upload_signed_ids: string[];
}

export interface CreatorSummary {
  account: {
    revenue_share_bps: number;
    payout_email: string | null;
    status: "active" | "suspended";
  };
  profile: { handle: string; name: string; avatar_url: string | null };
  totals: {
    gross: string | number;
    earned: string | number;
    payable: string | number;
    paid: string | number;
    currency: string;
  };
  counts: { products_live: number; products_in_review: number; sales: number };
}

export type ReviewState =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "changes_requested";

export interface AssetFile {
  id: number;
  filename: string;
  byte_size: number;
  content_type: string;
  md5?: string;
  sha256?: string | null;
  url?: string;
}

export interface CreatorProduct {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price: string | number;
  currency: string;
  kind: DigitalKind;
  review_state: ReviewState;
  review_note: string | null;
  taxon_ids: number[];
  preview: { image_url: string | null; audio_url: string | null };
  asset: {
    id: number;
    version: number;
    status: "draft" | "published" | "retired";
    manifest: Record<string, any>;
    files: AssetFile[];
  } | null;
  live_asset_version: number | null;
  sales_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreatorProductInput {
  name: string;
  description: string;
  price: number;
  kind: DigitalKind;
  taxon_ids: number[];
  preview_image_signed_id?: string | null;
  preview_audio_signed_id?: string | null;
  /** Signed ids of the asset's files: newly uploaded and kept existing ones. */
  files: string[];
  manifest: Record<string, any>;
}

export interface SalesPoint {
  date: string;
  units: number;
  gross: string | number;
  earned: string | number;
}

export interface SalesRow {
  order_masked: string;
  product_id: number;
  units: number;
  gross: string | number;
  earned: string | number;
  state: "pending" | "payable" | "paid" | "void";
  created_at: string;
}

export interface CreatorSales {
  series: SalesPoint[];
  rows: SalesRow[];
}

export interface Payout {
  id: number;
  amount: string | number;
  currency: string;
  reference: string | null;
  paid_at: string | null;
  note?: string | null;
}

export interface LibraryItem {
  ownership_id: number;
  variant_id: number;
  product: {
    id: number;
    slug: string;
    name: string;
    image_url: string | null;
    creator: { handle: string; name: string } | null;
  };
  kind: DigitalKind;
  asset: {
    id: number;
    version: number;
    byte_size: number;
    manifest: Record<string, any>;
    files: AssetFile[];
  };
  source: "order" | "iap" | "grant" | "free";
  granted_at: string;
  revoked_at: string | null;
}

export interface LibraryLink {
  file_id: number;
  url: string;
  expires_at: string;
}

export interface DigitalSummary {
  kind: DigitalKind;
  byte_size?: number;
  file_count?: number;
  sample_count?: number;
  effect_count?: number;
  param_count?: number;
  version?: number;
  preview?: { image_url?: string | null; audio_url?: string | null };
}
