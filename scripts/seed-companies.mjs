/**
 * Jeu de données de développement : commerces et artisans locaux français.
 *
 *   pnpm seed:companies [nombre]
 *
 * Déterministe (générateur pseudo-aléatoire à graine fixe) pour que deux
 * exécutions produisent le même jeu et que les captures d'écran restent
 * comparables. Refuse de tourner ailleurs qu'en local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`Refus : instance non locale (${url}).`);
  process.exit(1);
}
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Générateur déterministe ────────────────────────────────────────────────
let seed = 20260827;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const intBetween = (a, b) => a + Math.floor(rand() * (b - a + 1));

// ─── Vocabulaire ────────────────────────────────────────────────────────────
const ACTIVITIES = [
  { kind: 'Boulangerie', naf: '1071C', label: 'Boulangerie et boulangerie-pâtisserie' },
  { kind: 'Restaurant', naf: '5610A', label: 'Restauration traditionnelle' },
  { kind: 'Pizzeria', naf: '5610C', label: 'Restauration de type rapide' },
  { kind: 'Salon de coiffure', naf: '9602A', label: 'Coiffure' },
  { kind: 'Institut de beauté', naf: '9602B', label: 'Soins de beauté' },
  { kind: 'Garage', naf: '4520A', label: 'Entretien et réparation de véhicules' },
  { kind: 'Plomberie', naf: '4322A', label: 'Travaux d’installation d’eau et de gaz' },
  { kind: 'Électricité', naf: '4321A', label: 'Travaux d’installation électrique' },
  { kind: 'Menuiserie', naf: '4332A', label: 'Travaux de menuiserie' },
  { kind: 'Fleuriste', naf: '4776Z', label: 'Commerce de détail de fleurs' },
  { kind: 'Boucherie', naf: '4722Z', label: 'Commerce de détail de viandes' },
  { kind: 'Cave à vins', naf: '4725Z', label: 'Commerce de détail de boissons' },
  { kind: 'Opticien', naf: '4778A', label: 'Commerces de détail d’optique' },
  { kind: 'Auto-école', naf: '8553Z', label: 'Enseignement de la conduite' },
  { kind: 'Cabinet vétérinaire', naf: '7500Z', label: 'Activités vétérinaires' },
  { kind: 'Pressing', naf: '9601B', label: 'Blanchisserie-teinturerie de détail' },
];

const SURNAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier',
];

const PREFIXES = ['Maison', 'Chez', 'Au', 'Le', 'La', 'Atelier'];

const CITIES = [
  { city: 'Paris', cp: '75011', region: 'Île-de-France', lat: 48.8586, lon: 2.3781 },
  { city: 'Lyon', cp: '69003', region: 'Auvergne-Rhône-Alpes', lat: 45.7597, lon: 4.8563 },
  { city: 'Marseille', cp: '13006', region: "Provence-Alpes-Côte d'Azur", lat: 43.2865, lon: 5.3813 },
  { city: 'Toulouse', cp: '31000', region: 'Occitanie', lat: 43.6045, lon: 1.4442 },
  { city: 'Bordeaux', cp: '33000', region: 'Nouvelle-Aquitaine', lat: 44.8378, lon: -0.5792 },
  { city: 'Nantes', cp: '44000', region: 'Pays de la Loire', lat: 47.2184, lon: -1.5536 },
  { city: 'Lille', cp: '59000', region: 'Hauts-de-France', lat: 50.6292, lon: 3.0573 },
  { city: 'Rennes', cp: '35000', region: 'Bretagne', lat: 48.1173, lon: -1.6778 },
  { city: 'Strasbourg', cp: '67000', region: 'Grand Est', lat: 48.5734, lon: 7.7521 },
  { city: 'Montpellier', cp: '34000', region: 'Occitanie', lat: 43.6108, lon: 3.8767 },
  { city: 'Saint-Denis', cp: '97400', region: 'La Réunion', lat: -20.8789, lon: 55.4481 },
  { city: 'Angers', cp: '49000', region: 'Pays de la Loire', lat: 47.4784, lon: -0.5632 },
];

const STACKS = [
  { cms: 'WordPress', framework: null, tech: ['php', 'wordpress', 'jquery'], dated: false },
  { cms: 'WordPress', framework: null, tech: ['php', 'wordpress', 'jquery', 'bootstrap3'], dated: true },
  { cms: 'Wix', framework: null, tech: ['wix'], dated: true },
  { cms: 'Jimdo', framework: null, tech: ['jimdo'], dated: true },
  { cms: 'IONOS MyWebsite', framework: null, tech: ['ionos'], dated: true },
  { cms: 'PrestaShop', framework: null, tech: ['php', 'prestashop'], dated: true },
  { cms: 'Shopify', framework: null, tech: ['shopify', 'liquid'], dated: false },
  { cms: 'Squarespace', framework: null, tech: ['squarespace'], dated: false },
  { cms: null, framework: 'Next.js', tech: ['react', 'nextjs'], dated: false },
];

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

// ─── Génération ─────────────────────────────────────────────────────────────
const total = Number(process.argv[2] ?? 120);
console.log(`Génération de ${total} entreprises…`);

await db.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await db.from('company_cooldowns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await db.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await db.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

const companies = [];
const usedSirens = new Set();

for (let i = 0; i < total; i += 1) {
  const activity = pick(ACTIVITIES);
  const place = pick(CITIES);
  const surname = pick(SURNAMES);
  const commercial = chance(0.5)
    ? `${pick(PREFIXES)} ${surname}`
    : `${activity.kind} ${surname}`;
  const legal = `${surname.toUpperCase()} ${pick(['SARL', 'SAS', 'EURL', 'SASU'])}`;

  let siren;
  do {
    siren = String(intBetween(100_000_000, 999_999_999));
  } while (usedSirens.has(siren));
  usedSirens.add(siren);

  const ageDays = chance(0.18) ? intBetween(5, 80) : intBetween(400, 7000);
  const hasWebsite = chance(0.62);
  const stack = hasWebsite ? pick(STACKS) : null;
  // Un seul tirage : domain, website_url et contact_form_url doivent désigner
  // le même site, sinon la fiche affiche un domaine et pointe vers un autre.
  const domain = hasWebsite ? `${slug(commercial)}${intBetween(1, 99)}.fr` : null;

  companies.push({
    siren,
    siret: `${siren}${String(intBetween(10, 99))}${String(intBetween(100, 999))}`,
    legal_name: legal,
    commercial_name: commercial,
    domain,
    website_url: domain ? `https://${domain}` : null,
    website_confidence: hasWebsite ? Number((0.75 + rand() * 0.24).toFixed(2)) : null,
    phone: chance(0.87) ? `+33${intBetween(1, 5)}${String(intBetween(10_000_000, 99_999_999))}` : null,
    contact_form_url: domain && chance(0.5) ? `https://${domain}/contact` : null,
    address: `${intBetween(1, 180)} rue ${pick(SURNAMES)}`,
    postal_code: place.cp,
    city: place.city,
    region: place.region,
    lat: Number((place.lat + (rand() - 0.5) * 0.06).toFixed(6)),
    lon: Number((place.lon + (rand() - 0.5) * 0.06).toFixed(6)),
    industry_code: activity.naf,
    industry_label: activity.label,
    segment: 'local_commerce',
    employee_min: intBetween(0, 3),
    employee_max: intBetween(4, 20),
    creation_date: daysAgo(ageDays).slice(0, 10),
    company_status: chance(0.96) ? 'active' : 'closed',
    identity_confidence: Number((0.72 + rand() * 0.27).toFixed(2)),
    data_quality_score: intBetween(35, 98),
    prospecting_allowed: chance(0.97),
    suppression_global: false,
    scan_priority: intBetween(10, 100),
    last_scanned_at: chance(0.8) ? daysAgo(intBetween(0, 60)) : null,
    next_scan_at: daysAgo(-intBetween(1, 45)),
    last_seen_at: daysAgo(intBetween(0, 10)),
    _meta: { activity, stack, hasWebsite, ageDays },
  });
}

// Quelques entreprises explicitement exclues, pour vérifier les filtres.
companies[3].suppression_global = true;
companies[3].suppression_reason = 'opposition explicite du dirigeant';
companies[7].prospecting_allowed = false;

const payload = companies.map(({ _meta, ...row }) => row);
const inserted = [];
for (let i = 0; i < payload.length; i += 50) {
  const { data, error } = await db
    .from('companies')
    .insert(payload.slice(i, i + 50))
    .select('id, siren, domain, creation_date');
  if (error) throw new Error(`companies : ${error.message}`);
  inserted.push(...data);
}
console.log(`✓ ${inserted.length} entreprises`);

const bySiren = new Map(inserted.map((c) => [c.siren, c]));

// ─── Sources ────────────────────────────────────────────────────────────────
const sources = [];
for (const c of companies) {
  const row = bySiren.get(c.siren);
  sources.push({
    company_id: row.id,
    source_name: 'sirene',
    source_external_id: c.siret,
    raw_payload: { siren: c.siren, denominationUniteLegale: c.legal_name, activitePrincipale: c.industry_code },
    confidence: 0.99,
  });
  if (c.phone) {
    sources.push({
      company_id: row.id,
      source_name: 'openstreetmap',
      source_external_id: `node/${intBetween(1_000_000, 9_999_999)}`,
      raw_payload: { name: c.commercial_name, phone: c.phone, website: c.website_url },
      confidence: 0.85,
    });
  }
  if (c.domain && chance(0.4)) {
    sources.push({
      company_id: row.id,
      source_name: 'afnic',
      source_external_id: c.domain,
      raw_payload: { domain: c.domain, registered_at: c.creation_date },
      confidence: 0.9,
    });
  }
}
for (let i = 0; i < sources.length; i += 200) {
  const { error } = await db.from('company_sources').insert(sources.slice(i, i + 200));
  if (error) throw new Error(`company_sources : ${error.message}`);
}
console.log(`✓ ${sources.length} rattachements de source`);

// ─── Snapshots, événements, signaux, opportunités ───────────────────────────
const snapshots = [];
const events = [];
const signals = [];
const opportunities = [];

for (const c of companies) {
  const row = bySiren.get(c.siren);
  const { activity, stack, hasWebsite, ageDays } = c._meta;
  const isRecent = ageDays <= 90;
  const capturedAt = daysAgo(intBetween(0, 20));

  if (hasWebsite) {
    const mobile = stack.dated ? intBetween(12, 45) : intBetween(48, 96);
    const perf = stack.dated ? intBetween(15, 50) : intBetween(52, 97);
    snapshots.push({
      company_id: row.id,
      domain: c.domain,
      http_status: chance(0.94) ? 200 : pick([301, 403, 500, 503]),
      final_url: c.website_url,
      title: `${c.commercial_name} — ${activity.kind} à ${c.city}`,
      html_hash: `h${Math.floor(rand() * 1e12).toString(36)}`,
      tech_hash: `t${Math.floor(rand() * 1e12).toString(36)}`,
      cms: stack.cms,
      framework: stack.framework,
      technologies: stack.tech,
      has_ssl: chance(0.93),
      has_viewport_meta: !stack.dated || chance(0.4),
      has_media_queries: !stack.dated || chance(0.35),
      html_bytes: intBetween(18_000, 420_000),
      ttfb_ms: stack.dated ? intBetween(600, 3400) : intBetween(80, 600),
      ecommerce_detected: ['Shopify', 'PrestaShop'].includes(stack.cms),
      contact_form_detected: chance(0.6),
      copyright_year: stack.dated ? intBetween(2014, 2020) : intBetween(2024, 2026),
      performance_score: perf,
      mobile_score: mobile,
      seo_score: intBetween(30, 95),
      scan_depth: chance(0.25) ? 'deep' : 'cheap',
      captured_at: capturedAt,
    });
  }

  // ── Déclencheur daté : sans lui, aucune opportunité ─────────────────────
  let trigger = null;
  if (isRecent) {
    trigger = {
      company_id: row.id,
      event_type: 'company_recently_created',
      payload: { creation_date: c.creation_date },
      importance: 92,
      confidence: 0.99,
      source: 'sirene',
      occurred_at: daysAgo(ageDays),
      detected_at: daysAgo(Math.max(0, ageDays - intBetween(1, 10))),
      dedupe_key: `sirene:created:${c.siren}`,
    };
  } else if (hasWebsite && stack.dated && chance(0.45)) {
    trigger = {
      company_id: row.id,
      event_type: 'website_changed',
      payload: { previous_hash: 'ancien', reason: 'contenu modifié' },
      importance: 68,
      confidence: 0.85,
      source: 'cheap_scan',
      occurred_at: daysAgo(intBetween(1, 25)),
      detected_at: daysAgo(intBetween(0, 12)),
      dedupe_key: `scan:changed:${c.siren}:${intBetween(1, 1e6)}`,
    };
  } else if (!hasWebsite && c.phone && chance(0.55)) {
    trigger = {
      company_id: row.id,
      event_type: 'no_website_confirmed',
      payload: { source: 'fiche POI complète, champ website vide' },
      importance: 80,
      confidence: 0.88,
      source: 'openstreetmap',
      occurred_at: daysAgo(intBetween(1, 30)),
      detected_at: daysAgo(intBetween(0, 15)),
      dedupe_key: `osm:nowebsite:${c.siren}`,
    };
  }

  if (trigger) events.push({ ...trigger, _company: row.id, _c: c });
}

for (let i = 0; i < snapshots.length; i += 100) {
  const { error } = await db.from('website_snapshots').insert(snapshots.slice(i, i + 100));
  if (error) throw new Error(`website_snapshots : ${error.message}`);
}
console.log(`✓ ${snapshots.length} snapshots de site`);

const eventPayload = events.map(({ _company, _c, ...e }) => e);
const insertedEvents = [];
for (let i = 0; i < eventPayload.length; i += 100) {
  const { data, error } = await db
    .from('company_events')
    .insert(eventPayload.slice(i, i + 100))
    .select('id, company_id, event_type, occurred_at');
  if (error) throw new Error(`company_events : ${error.message}`);
  insertedEvents.push(...data);
}
console.log(`✓ ${insertedEvents.length} événements déclencheurs`);

const eventByCompany = new Map(insertedEvents.map((e) => [e.company_id, e]));

const HALF_LIVES = {
  company_recently_created: 45,
  website_changed: 14,
  no_website_confirmed: 30,
};

for (const c of companies) {
  const row = bySiren.get(c.siren);
  const event = eventByCompany.get(row.id);
  if (!event) continue;
  const { stack, hasWebsite } = c._meta;

  // Signal déclencheur
  signals.push({
    company_id: row.id,
    signal_type: event.event_type,
    kind: 'trigger',
    category: 'timing',
    strength: Number((0.7 + rand() * 0.29).toFixed(2)),
    confidence: Number((0.8 + rand() * 0.19).toFixed(2)),
    source: 'seed',
    trigger_event_id: event.id,
    fingerprint: `${event.event_type}:${event.id}`,
    evidence: [{ type: 'event', id: event.id }],
  });

  // Signaux modificateurs
  const modifiers = [];
  if (hasWebsite && stack.dated) {
    modifiers.push(['outdated_stack', 'need', 0.8], ['poor_mobile', 'need', 0.85]);
    if (chance(0.6)) modifiers.push(['slow_website', 'need', 0.7]);
  }
  if (!hasWebsite) modifiers.push(['no_website_proven', 'need', 0.95]);
  if (c.phone) modifiers.push(['reachable_by_phone', 'quality', 0.9]);
  if (c.identity_confidence < 0.8) modifiers.push(['weak_identity', 'risk', 0.5]);

  for (const [type, category, strength] of modifiers) {
    signals.push({
      company_id: row.id,
      signal_type: type,
      kind: 'modifier',
      category,
      strength,
      confidence: Number((0.75 + rand() * 0.24).toFixed(2)),
      source: 'seed',
      // Toujours renseigné : PostgREST met à null les colonnes absentes d'une
      // ligne mais présentes dans une autre du même lot.
      trigger_event_id: null,
      evidence: [{ type: 'observation', signal: type }],
      fingerprint: `${type}:${row.id}`,
    });
  }

  // ── Opportunité : scoring conforme à la formule V0 ──────────────────────
  const type = !hasWebsite
    ? 'website_creation'
    : stack.dated
      ? 'website_redesign'
      : pick(['seo', 'maintenance', 'ecommerce']);

  const need = !hasWebsite ? intBetween(70, 96) : stack.dated ? intBetween(58, 92) : intBetween(30, 62);
  const timing = Math.round(event.event_type === 'company_recently_created' ? intBetween(72, 96) : intBetween(40, 78));
  const ageOfEvent = Math.max(0, (Date.now() - new Date(event.occurred_at).getTime()) / 86_400_000);
  const halfLife = HALF_LIVES[event.event_type] ?? 30;
  const freshness = Math.max(0.05, Math.exp((-Math.LN2 * ageOfEvent) / halfLife));
  const confidence = Number((0.62 + rand() * 0.36).toFixed(2));
  const base = (need * 0.55 + timing * 0.45) * freshness * (0.4 + 0.6 * confidence);

  opportunities.push({
    company_id: row.id,
    opportunity_type: type,
    need_score: need,
    timing_score: timing,
    freshness_factor: Number(freshness.toFixed(3)),
    confidence_score: confidence,
    base_score: Number(Math.min(100, base).toFixed(2)),
    trigger_event_id: event.id,
    reason_data: {
      trigger: event.event_type,
      need_breakdown: modifiers.map(([t, , s]) => ({ signal: t, contribution: Math.round(s * 20) })),
      formula: '(need*0.55 + timing*0.45) * freshness * (0.4 + 0.6*confidence)',
    },
    algorithm_version: 'v0',
    expires_at: daysAgo(-intBetween(5, 30)),
  });
}

for (let i = 0; i < signals.length; i += 200) {
  const { error } = await db.from('signals').insert(signals.slice(i, i + 200));
  if (error) throw new Error(`signals : ${error.message}`);
}
console.log(`✓ ${signals.length} signaux`);

for (let i = 0; i < opportunities.length; i += 100) {
  const { error } = await db.from('opportunities').insert(opportunities.slice(i, i + 100));
  if (error) throw new Error(`opportunities : ${error.message}`);
}
console.log(`✓ ${opportunities.length} opportunités`);

// ─── Quelques cooldowns, pour que les filtres aient de la matière ───────────
const cooled = inserted.slice(0, 6).map((c, i) => ({
  company_id: c.id,
  reason: pick(['no_response', 'not_interested', 'meeting']),
  ends_at: daysAgo(-intBetween(10, 60)),
  notes: 'Cooldown de démonstration',
  permanent: false,
  starts_at: daysAgo(i + 1),
}));
await db.from('company_cooldowns').insert(cooled);
console.log(`✓ ${cooled.length} cooldowns`);

const { data: stats } = await db.from('admin_stats').select('*').single();
console.log('\nÉtat de la base :');
console.log(`  entreprises           ${stats.companies_total}`);
console.log(`  avec site             ${stats.companies_with_website}`);
console.log(`  joignables            ${stats.companies_with_contact}`);
console.log(`  signaux actifs        ${stats.signals_active}`);
console.log(`  opportunités en stock ${stats.opportunities_available}`);
