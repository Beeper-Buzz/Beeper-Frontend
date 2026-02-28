#!/usr/bin/env ts-node
/**
 * Spree 4.2.5 Platform Admin API Seed Script
 *
 * Idempotent — safe to run multiple times. Checks for existing records by name
 * before creating. Uses OAuth2 client_credentials grant for authentication.
 *
 * Required env vars:
 *   SPREE_API_URL (or NEXT_PUBLIC_SPREE_API_URL) — e.g. http://localhost:4000
 *   SPREE_CLIENT_ID
 *   SPREE_CLIENT_SECRET
 *
 * Usage:
 *   yarn seed
 */

import {
  TAXONOMIES,
  TAXONS,
  OPTION_TYPES,
  PROPERTIES,
  PRODUCTS,
  PROMOTIONS,
  ProductDef,
} from './seed-spree-data';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.SPREE_API_URL ||
  process.env.NEXT_PUBLIC_SPREE_API_URL ||
  'http://localhost:4000';

const CLIENT_ID = process.env.SPREE_CLIENT_ID;
const CLIENT_SECRET = process.env.SPREE_CLIENT_SECRET;

const PLATFORM_PREFIX = '/api/v2/platform';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let accessToken = '';

async function authenticate(): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'Missing SPREE_CLIENT_ID and/or SPREE_CLIENT_SECRET environment variables.',
    );
  }

  console.log(`\nAuthenticating with Spree at ${BASE_URL} ...`);

  const res = await fetch(`${BASE_URL}/spree_oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'admin',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth token request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  accessToken = data.access_token;
  console.log('Authenticated successfully.');
}

/** Standard headers for Platform API requests. */
function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Generic GET with pagination support. Returns all items from all pages.
 * Spree 4.2.5 Platform API uses `?page=N&per_page=N`.
 */
async function fetchAll<T extends { id: string }>(
  endpoint: string,
  perPage = 100,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE_URL}${PLATFORM_PREFIX}${endpoint}?page=${page}&per_page=${perPage}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GET ${endpoint} page ${page} failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { data: Array<{ id: string; attributes: Record<string, unknown> }> };
    const pageItems = json.data.map((d) => ({ id: d.id, ...d.attributes } as unknown as T));
    items.push(...pageItems);

    if (json.data.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return items;
}

/**
 * POST a new resource. Uses SINGULAR resource key per Spree 4.2.5 JSON:API format.
 */
async function create<T>(
  endpoint: string,
  resourceKey: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${BASE_URL}${PLATFORM_PREFIX}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ [resourceKey]: body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${endpoint} failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { data: { id: string; attributes: Record<string, unknown> } };
  return { id: json.data.id, ...json.data.attributes } as unknown as T;
}

/**
 * PATCH an existing resource.
 */
async function update<T>(
  endpoint: string,
  id: string,
  resourceKey: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${BASE_URL}${PLATFORM_PREFIX}${endpoint}/${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ [resourceKey]: body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${endpoint}/${id} failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { data: { id: string; attributes: Record<string, unknown> } };
  return { id: json.data.id, ...json.data.attributes } as unknown as T;
}

// ---------------------------------------------------------------------------
// Entity types (minimal, for lookup purposes)
// ---------------------------------------------------------------------------

interface SpreeRecord {
  id: string;
  name: string;
}

interface SpreeTaxon extends SpreeRecord {
  taxonomy_id: number;
  parent_id: number | null;
  permalink: string;
}

interface SpreeOptionType extends SpreeRecord {
  presentation: string;
}

interface SpreeOptionValue extends SpreeRecord {
  presentation: string;
  option_type_id: number;
}

interface SpreeProperty extends SpreeRecord {
  presentation: string;
}

interface SpreeProduct extends SpreeRecord {
  slug: string;
  price: string;
}

interface SpreeVariant {
  id: string;
  sku: string;
  is_master: boolean;
  price: string;
  option_values: Array<{ id: string; name: string }>;
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

/**
 * Step 1 — Taxonomies
 * Creates top-level taxonomies (Shop, Marketplace, Collections).
 * Returns a map of taxonomy name -> id.
 */
async function seedTaxonomies(): Promise<Map<string, string>> {
  console.log('\n--- Seeding Taxonomies ---');
  const existing = await fetchAll<SpreeRecord>('/taxonomies');
  const nameToId = new Map<string, string>();

  for (const { name } of TAXONOMIES) {
    const found = existing.find((t) => t.name === name);
    if (found) {
      console.log(`  [skip] Taxonomy "${name}" already exists (id=${found.id})`);
      nameToId.set(name, found.id);
    } else {
      const created = await create<SpreeRecord>('/taxonomies', 'taxonomy', { name });
      console.log(`  [create] Taxonomy "${name}" (id=${created.id})`);
      nameToId.set(name, created.id);
    }
  }

  return nameToId;
}

/**
 * Step 2 — Taxons
 * Creates child taxons under each taxonomy.
 * Returns a map of taxon name -> id.
 */
async function seedTaxons(
  taxonomyIds: Map<string, string>,
): Promise<Map<string, string>> {
  console.log('\n--- Seeding Taxons ---');
  const existing = await fetchAll<SpreeTaxon>('/taxons');
  const nameToId = new Map<string, string>();

  // The root taxons created automatically by Spree share the taxonomy name.
  for (const t of existing) {
    nameToId.set(t.name, t.id);
  }

  for (const [taxonomyName, children] of Object.entries(TAXONS)) {
    const taxonomyId = taxonomyIds.get(taxonomyName);
    if (!taxonomyId) {
      console.warn(`  [warn] Taxonomy "${taxonomyName}" not found, skipping its taxons.`);
      continue;
    }

    // The root taxon for this taxonomy is the one whose name matches the taxonomy
    const rootTaxon = existing.find(
      (t) => t.name === taxonomyName && t.parent_id === null,
    );
    const parentId = rootTaxon?.id;

    for (const childName of children) {
      const found = existing.find((t) => t.name === childName);
      if (found) {
        console.log(`  [skip] Taxon "${childName}" already exists (id=${found.id})`);
        nameToId.set(childName, found.id);
      } else {
        const payload: Record<string, unknown> = {
          name: childName,
          taxonomy_id: taxonomyId,
        };
        if (parentId) {
          payload.parent_id = parentId;
        }
        const created = await create<SpreeTaxon>('/taxons', 'taxon', payload);
        console.log(`  [create] Taxon "${childName}" under "${taxonomyName}" (id=${created.id})`);
        nameToId.set(childName, created.id);
      }
    }
  }

  return nameToId;
}

/**
 * Step 3 — Option Types + Option Values
 * Returns maps of option type name -> id and option value name -> id.
 */
async function seedOptionTypes(): Promise<{
  typeIds: Map<string, string>;
  valueIds: Map<string, string>;
}> {
  console.log('\n--- Seeding Option Types ---');
  const existingTypes = await fetchAll<SpreeOptionType>('/option_types');
  const typeIds = new Map<string, string>();
  const valueIds = new Map<string, string>();

  const existingValues = await fetchAll<SpreeOptionValue>('/option_values');

  for (const ot of OPTION_TYPES) {
    let typeRecord = existingTypes.find((t) => t.name === ot.name);
    if (typeRecord) {
      console.log(`  [skip] Option type "${ot.name}" already exists (id=${typeRecord.id})`);
    } else {
      typeRecord = await create<SpreeOptionType>('/option_types', 'option_type', {
        name: ot.name,
        presentation: ot.presentation,
      });
      console.log(`  [create] Option type "${ot.name}" (id=${typeRecord.id})`);
    }
    typeIds.set(ot.name, typeRecord.id);

    // Seed option values for this type
    for (const ov of ot.values) {
      let valRecord = existingValues.find(
        (v) => v.name === ov.name && String(v.option_type_id) === typeRecord!.id,
      );
      if (valRecord) {
        console.log(`    [skip] Option value "${ov.name}" already exists (id=${valRecord.id})`);
      } else {
        valRecord = await create<SpreeOptionValue>('/option_values', 'option_value', {
          name: ov.name,
          presentation: ov.presentation,
          option_type_id: typeRecord.id,
        });
        console.log(`    [create] Option value "${ov.name}" (id=${valRecord.id})`);
      }
      valueIds.set(ov.name, valRecord.id);
    }
  }

  return { typeIds, valueIds };
}

/**
 * Step 4 — Properties
 * Returns a map of property name -> id.
 */
async function seedProperties(): Promise<Map<string, string>> {
  console.log('\n--- Seeding Properties ---');
  const existing = await fetchAll<SpreeProperty>('/properties');
  const nameToId = new Map<string, string>();

  for (const prop of PROPERTIES) {
    const found = existing.find((p) => p.name === prop.name);
    if (found) {
      console.log(`  [skip] Property "${prop.name}" already exists (id=${found.id})`);
      nameToId.set(prop.name, found.id);
    } else {
      const created = await create<SpreeProperty>('/properties', 'property', {
        name: prop.name,
        presentation: prop.presentation,
      });
      console.log(`  [create] Property "${prop.name}" (id=${created.id})`);
      nameToId.set(prop.name, created.id);
    }
  }

  return nameToId;
}

/**
 * Step 5 — Products
 * Creates products, assigns taxons, sets product properties, option types, and variants.
 */
async function seedProducts(
  taxonIds: Map<string, string>,
  propertyIds: Map<string, string>,
  optionTypeIds: Map<string, string>,
  optionValueIds: Map<string, string>,
): Promise<void> {
  console.log('\n--- Seeding Products ---');
  const existingProducts = await fetchAll<SpreeProduct>('/products');

  for (const def of PRODUCTS) {
    let product = existingProducts.find((p) => p.slug === def.slug || p.name === def.name);

    if (product) {
      console.log(`  [skip] Product "${def.name}" already exists (id=${product.id})`);
    } else {
      // Build taxon_ids array
      const taxonIdList = def.taxons
        .map((t) => taxonIds.get(t))
        .filter(Boolean) as string[];

      // Build the product payload
      const productPayload: Record<string, unknown> = {
        name: def.name,
        slug: def.slug,
        price: def.price,
        description: def.description,
        available_on: new Date().toISOString(),
        status: 'active',
        taxon_ids: taxonIdList,
      };

      if (def.shippingWeight) {
        productPayload.weight = def.shippingWeight;
      }

      // Assign option type if the product has variants
      if (def.optionType) {
        const otId = optionTypeIds.get(def.optionType);
        if (otId) {
          productPayload.option_type_ids = [otId];
        }
      }

      product = await create<SpreeProduct>('/products', 'product', productPayload);
      console.log(`  [create] Product "${def.name}" (id=${product.id})`);
    }

    // --- Product Properties ---
    await seedProductProperties(product.id, def, propertyIds);

    // --- Variants ---
    if (def.variants && def.variants.length > 0) {
      await seedVariants(product.id, def, optionValueIds);
    }
  }
}

/**
 * Assigns property values to a product via the product_properties endpoint.
 */
async function seedProductProperties(
  productId: string,
  def: ProductDef,
  propertyIds: Map<string, string>,
): Promise<void> {
  // Fetch existing product properties for this product
  let existingProdProps: Array<{ id: string; property_id: number; value: string }> = [];
  try {
    const url = `${BASE_URL}${PLATFORM_PREFIX}/products/${productId}/product_properties?per_page=100`;
    const res = await fetch(url, { headers: headers() });
    if (res.ok) {
      const json = (await res.json()) as {
        data: Array<{ id: string; attributes: { property_id: number; value: string } }>;
      };
      existingProdProps = json.data.map((d) => ({
        id: d.id,
        property_id: d.attributes.property_id,
        value: d.attributes.value,
      }));
    }
  } catch {
    // If the nested route doesn't exist, fall back to creating via the flat endpoint
  }

  for (const [propName, propValue] of Object.entries(def.properties)) {
    const propId = propertyIds.get(propName);
    if (!propId) {
      console.warn(`    [warn] Property "${propName}" not found, skipping.`);
      continue;
    }

    const alreadySet = existingProdProps.find(
      (pp) => String(pp.property_id) === propId,
    );
    if (alreadySet) {
      continue; // Already assigned
    }

    try {
      await create('/product_properties', 'product_property', {
        product_id: productId,
        property_id: propId,
        value: propValue,
      });
    } catch (err) {
      // Some Spree versions use a nested route instead
      try {
        const url = `${BASE_URL}${PLATFORM_PREFIX}/products/${productId}/product_properties`;
        const res = await fetch(url, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            product_property: {
              property_id: propId,
              value: propValue,
            },
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.warn(`    [warn] Could not set property "${propName}" on product ${productId}: ${text}`);
        }
      } catch (innerErr) {
        console.warn(`    [warn] Failed to set property "${propName}": ${innerErr}`);
      }
    }
  }
}

/**
 * Creates variants for a product with option value assignments and pricing.
 */
async function seedVariants(
  productId: string,
  def: ProductDef,
  optionValueIds: Map<string, string>,
): Promise<void> {
  // Fetch existing variants for this product
  let existingVariants: SpreeVariant[] = [];
  try {
    const url = `${BASE_URL}${PLATFORM_PREFIX}/products/${productId}/variants?per_page=100`;
    const res = await fetch(url, { headers: headers() });
    if (res.ok) {
      const json = (await res.json()) as {
        data: Array<{
          id: string;
          attributes: { sku: string; is_master: boolean; price: string };
          relationships?: { option_values?: { data: Array<{ id: string }> } };
        }>;
      };
      existingVariants = json.data.map((d) => ({
        id: d.id,
        sku: d.attributes.sku,
        is_master: d.attributes.is_master,
        price: d.attributes.price,
        option_values: [],
      }));
    }
  } catch {
    // Fall back to creating variants via the flat endpoint
  }

  if (!def.variants) return;

  for (const variantDef of def.variants) {
    const existingBySku = existingVariants.find(
      (v) => v.sku === variantDef.sku && !v.is_master,
    );

    if (existingBySku) {
      console.log(`    [skip] Variant "${variantDef.sku}" already exists (id=${existingBySku.id})`);
      continue;
    }

    const ovId = optionValueIds.get(variantDef.optionValue);
    if (!ovId) {
      console.warn(`    [warn] Option value "${variantDef.optionValue}" not found, skipping variant.`);
      continue;
    }

    const variantPayload: Record<string, unknown> = {
      sku: variantDef.sku,
      price: def.price,
      product_id: productId,
      option_value_ids: [ovId],
    };

    if (def.shippingWeight) {
      variantPayload.weight = def.shippingWeight;
    }

    try {
      const created = await create<{ id: string }>('/variants', 'variant', variantPayload);
      console.log(`    [create] Variant "${variantDef.sku}" (id=${created.id})`);
    } catch (err) {
      // Try nested route as fallback
      try {
        const url = `${BASE_URL}${PLATFORM_PREFIX}/products/${productId}/variants`;
        const res = await fetch(url, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            variant: {
              sku: variantDef.sku,
              price: def.price,
              option_value_ids: [ovId],
              weight: def.shippingWeight || undefined,
            },
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { data: { id: string } };
          console.log(`    [create] Variant "${variantDef.sku}" via nested route (id=${json.data.id})`);
        } else {
          const text = await res.text();
          console.warn(`    [warn] Could not create variant "${variantDef.sku}": ${text}`);
        }
      } catch (innerErr) {
        console.warn(`    [warn] Failed to create variant "${variantDef.sku}": ${innerErr}`);
      }
    }
  }
}

/**
 * Step 6 — Promotions
 * Creates promotion shells. Rules and actions should be configured in Spree Admin UI.
 */
async function seedPromotions(): Promise<void> {
  console.log('\n--- Seeding Promotions ---');

  // Spree 4.2.5 promotions list endpoint
  let existingPromotions: Array<{ id: string; name: string; code: string }> = [];
  try {
    const items = await fetchAll<{ id: string; name: string; code: string }>('/promotions');
    existingPromotions = items;
  } catch {
    console.warn('  [warn] Could not fetch existing promotions (endpoint may not be available).');
  }

  for (const promo of PROMOTIONS) {
    const found = existingPromotions.find(
      (p) => p.name === promo.name || p.code === promo.code,
    );

    if (found) {
      console.log(`  [skip] Promotion "${promo.name}" already exists (id=${found.id})`);
      continue;
    }

    try {
      const created = await create<{ id: string }>('/promotions', 'promotion', {
        name: promo.name,
        description: promo.description,
        code: promo.code,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      console.log(`  [create] Promotion "${promo.name}" (id=${created.id})`);
      console.log(`           Code: ${promo.code} — configure rules/actions in Spree Admin UI.`);
    } catch (err) {
      console.warn(`  [warn] Could not create promotion "${promo.name}": ${err}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Beeper Spree Seed Script ===');
  console.log(`Target: ${BASE_URL}`);

  try {
    await authenticate();

    const taxonomyIds = await seedTaxonomies();
    const taxonIds = await seedTaxons(taxonomyIds);
    const { typeIds: optionTypeIds, valueIds: optionValueIds } = await seedOptionTypes();
    const propertyIds = await seedProperties();
    await seedProducts(taxonIds, propertyIds, optionTypeIds, optionValueIds);
    await seedPromotions();

    console.log('\n=== Seed complete! ===\n');
  } catch (err) {
    console.error('\n[FATAL]', err);
    process.exit(1);
  }
}

main();
