/**
 * Jeu de démonstration du tableau de bord : vingt attributions qui couvrent
 * chaque état d'affichage, rattachées à un compte réel.
 *
 *   node scripts/seed-dashboard-demo.mjs [email]
 *
 * Ce que le jeu couvre, et que le seed générique ne garantit jamais :
 *
 *   Ce matin — cinq dossiers : score fort et faible (le dégradé des
 *   pastilles), exclusivité sous douze heures (corail), un déjà appelé
 *   (coche + progression), un sans téléphone, un sans ville, un sans
 *   « pourquoi maintenant » (voie diagnostique), un nom d'enseigne à
 *   rallonge (troncature), réserves présentes et absentes.
 *
 *   À relancer — cinq dossiers ouverts : les trois statuts, avec et sans
 *   note, dont un qui dort depuis 24 jours (date en corail) et une note
 *   longue (retour à la ligne).
 *
 *   Statistiques — dix issues closes pour des compteurs réalistes.
 *
 * Les sites des dossiers sont servis par l'application elle-même
 * (/demo-sites/…) et PRÉSENTENT le défaut annoncé : un lien mort sous un
 * constat « illisible sur téléphone » cassait la promesse « vérifiable en
 * une minute » au premier clic.
 *
 * Idempotent : le jeu vit sur la plage de SIREN 899999001-899999999 —
 * segment est un enum fermé, un SIREN fictif hors de tout registre fait un
 * marqueur aussi sûr — et tout l'existant sur cette plage est supprimé
 * avant réinsertion. Les autres seeds ne sont pas touchés. Refuse de
 * tourner hors local.
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

const email = process.argv[2] ?? 'eliottroche97419@gmail.com';

// ─── Le compte cible ────────────────────────────────────────────────────────
const { data: users, error: usersError } = await db.auth.admin.listUsers({ perPage: 200 });
if (usersError) throw new Error(usersError.message);
const user = users.users.find((u) => u.email === email);
if (!user) {
  console.error(`Aucun compte ${email} — connectez-vous une fois d'abord.`);
  process.exit(1);
}
console.log(`Compte : ${email}`);

// ─── Nettoyage du jeu précédent ─────────────────────────────────────────────
const { data: previous } = await db.from('companies').select('id, domain').like('siren', '899999%');
if (previous?.length) {
  const ids = previous.map((c) => c.id);
  await db.from('assignments').delete().in('company_id', ids);
  await db.from('company_cooldowns').delete().in('company_id', ids);
  await db.from('opportunities').delete().in('company_id', ids);
  await db.from('companies').delete().in('id', ids);
  const domains = previous.map((c) => c.domain).filter(Boolean);
  if (domains.length) await db.from('domains').delete().in('domain', domains);
  console.log(`✓ ancien jeu retiré (${ids.length} entreprises)`);
}

// ─── Outils ─────────────────────────────────────────────────────────────────
const now = Date.now();
const hours = (n) => new Date(now + n * 3_600_000).toISOString();
const daysAgoIso = (n) => new Date(now - n * 86_400_000).toISOString();

let sirenSeq = 899_999_001;
const company = (over) => ({
  siren: String(sirenSeq++),
  legal_name: over.name.toUpperCase(),
  commercial_name: over.name,
  segment: 'local_commerce',
  company_status: 'active',
  prospecting_allowed: true,
  suppression_global: false,
  city: 'Angers',
  region: 'Pays de la Loire',
  postal_code: '49000',
  industry_code: '5610A',
  industry_label: 'Restauration',
  phone: '+33241000000',
  ...over.fields,
});

// ─── Les vingt cas ──────────────────────────────────────────────────────────
// Chaque entrée : l'entreprise, ses faits de site, l'opportunité, et l'état
// de l'attribution. Les commentaires disent CE QUE le cas teste à l'écran.
const CASES = [
  // ── Ce matin ──────────────────────────────────────────────────────────
  {
    // Score fort, exclusivité NORMALE, site en panne avec réserve.
    name: 'Le Vieux Pressoir', fields: { industry_label: 'Restaurant', city: 'Angers', phone: '+33241887702', domain: 'demo-pressoir.fr', website_url: 'http://127.0.0.1:3000/demo-sites/pressoir' },
    domain: { status: 'broken', http_status: 503, tls_reason: 'DEPTH_ZERO_SELF_SIGNED_CERT', has_ssl: true, emails_found: ['contact@demo-pressoir.fr'] },
    opp: { type: 'website_redesign', trigger: 'website_found_down', occurred: daysAgoIso(2), needs: [['website_broken', 55], ['invalid_certificate', 40]] },
    assign: { rank: 1, score: 91, exclusive: hours(61) },
  },
  {
    // Exclusivité URGENTE (moins de 12 h → corail), création sans téléphone :
    // seule la voie « formulaire de contact » est offerte.
    name: 'Fratelli Nuovo', fields: { industry_label: 'Pizzeria', city: 'Nantes', phone: null, contact_form_url: 'https://exemple.invalid/contact', creation_date: daysAgoIso(48).slice(0, 10) },
    opp: { type: 'website_creation', trigger: 'bodacc_immatriculation', occurred: daysAgoIso(41), needs: [['no_website_proven', 70], ['company_recently_created', 20]] },
    assign: { rank: 2, score: 84, exclusive: hours(9) },
  },
  {
    // DÉJÀ APPELÉ : coche, progression « 1 sur 5 », dossier replié.
    name: 'Menuiserie Hardouin', fields: { industry_label: 'Menuiserie', city: 'Rennes', phone: '+33299441203', domain: 'demo-hardouin.fr', website_url: 'http://127.0.0.1:3000/demo-sites/hardouin' },
    domain: { status: 'reachable', cms: 'wordpress', tech_year: 2011, copyright_year: 2014, dated_components: [{ name: 'jquery', version: '1.7.2', year: 2011 }, { name: 'bootstrap', version: '2.3.2', year: 2013 }] },
    opp: { type: 'website_redesign', trigger: 'frozen_site_woke_up', occurred: daysAgoIso(5), needs: [['outdated_stack', 50], ['stale_content', 30]] },
    assign: { rank: 3, score: 76, exclusive: hours(58), contactedHoursAgo: 2 },
  },
  {
    // SANS déclencheur daté : « pourquoi maintenant » absent — la voie
    // diagnostique. Nom d'enseigne long : troncature de la ligne repliée.
    name: 'Atelier d’Architecture Beaumont, Lefèvre et Associés', fields: { industry_label: 'Cabinet d’architectes', city: 'Angers', phone: '+33241778812', domain: 'demo-beaumont.fr', website_url: 'http://127.0.0.1:3000/demo-sites/beaumont' },
    domain: { status: 'reachable', responsive: false, ttfb_ms: 4200, has_media_queries: false },
    opp: { type: 'website_redesign', trigger: null, occurred: null, needs: [['not_responsive', 55], ['slow_website', 25]] },
    assign: { rank: 4, score: 68, exclusive: hours(55) },
  },
  {
    // Score BAS (pastille claire), SANS VILLE, e-commerce.
    name: 'Aux Fleurs de Loire', fields: { industry_label: 'Fleuriste', city: null, region: null, phone: '+33240551209', domain: 'demo-fleursdeloire.fr', website_url: 'http://127.0.0.1:3000/demo-sites/fleurs' },
    domain: { status: 'reachable', ecommerce_detected: false, contact_form_detected: false },
    opp: { type: 'ecommerce', trigger: null, occurred: null, needs: [['retail_without_ecommerce', 45], ['no_contact_form', 15]] },
    assign: { rank: 5, score: 61, exclusive: hours(52) },
  },

  {
    // MIS DE CÔTÉ : attribué HIER (le plafond de cinq par jour est tenu
    // par la base, et elle a raison), encore sous exclusivité.
    name: 'Torréfaction du Ralliement', fields: { industry_label: 'Torréfacteur', city: 'Angers', phone: '+33241889917', domain: 'demo-ralliement.fr', website_url: 'http://127.0.0.1:3000/demo-sites/ralliement' },
    domain: { status: 'reachable', cms: 'wordpress', tech_year: 2013, copyright_year: 2016 },
    opp: { type: 'website_redesign', trigger: null, occurred: null, needs: [['dated_platform', 45], ['stale_content', 30]] },
    assign: { rank: 1, score: 64, exclusive: hours(40), snoozed: true, assignedHoursAgo: 30 },
  },

  // ── À relancer ────────────────────────────────────────────────────────
  {
    name: 'Garage Millet', fields: { industry_label: 'Garage automobile', city: 'Le Mans', phone: '+33243778001' },
    opp: { type: 'website_redesign', trigger: 'website_found_down', occurred: daysAgoIso(30), needs: [['website_broken', 55]] },
    assign: { outcome: 'interested', daysAgo: 3, notes: 'Rappeler jeudi matin — demander M. Millet directement.' },
  },
  {
    name: 'Boucherie Priou', fields: { industry_label: 'Boucherie-charcuterie', city: 'Angers', phone: '+33241660914' },
    opp: { type: 'website_creation', trigger: 'bodacc_creation', occurred: daysAgoIso(40), needs: [['no_website_proven', 70]] },
    assign: { outcome: 'meeting', daysAgo: 10, notes: 'RDV mardi 14 h à la boutique. Apporter deux références de commerces.' },
  },
  {
    // Dossier qui DORT depuis 24 jours : la date passe en corail. Sans note.
    name: 'Camping des Deux Rives', fields: { industry_label: 'Hôtellerie de plein air', city: 'Saumur', phone: '+33241530277' },
    opp: { type: 'website_redesign', trigger: null, occurred: null, needs: [['dated_platform', 45]] },
    assign: { outcome: 'proposal', daysAgo: 24, notes: null },
  },
  {
    name: 'Institut Léa Beauté', fields: { industry_label: 'Institut de beauté', city: 'Cholet', phone: '+33241621174' },
    opp: { type: 'website_creation', trigger: 'bodacc_immatriculation', occurred: daysAgoIso(60), needs: [['no_website_proven', 70]] },
    assign: { outcome: 'interested', daysAgo: 0, notes: null },
  },
  {
    // Note LONGUE : le champ doit rester lisible sans casser la carte.
    name: 'Brasserie du Port', fields: { industry_label: 'Brasserie', city: 'Nantes', phone: '+33240338822' },
    opp: { type: 'website_redesign', trigger: 'bodacc_cession', occurred: daysAgoIso(50), needs: [['website_broken', 55]] },
    assign: { outcome: 'meeting', daysAgo: 15, notes: 'Reprise récente, le gérant veut tout refaire : site, réservation, menus en ligne. Préparer un devis en deux tranches — vitrine d’abord, réservation ensuite. Sa fille gère les réseaux, la mettre en copie.' },
  },

  // ── Closes, pour les statistiques ─────────────────────────────────────
  ...[
    ['Pharmacie Centrale', 'not_interested', 12], ['Optique Rive Sud', 'not_interested', 18],
    ['Cave des Halles', 'not_interested', 26], ['Auto-École Departure', 'not_interested', 33],
    ['Boulangerie Fasseur', 'no_response', 8], ['Cordonnerie Michel', 'no_response', 21],
    ['Pressing de la Gare', 'no_response', 29], ['Tabac le Marigny', 'no_response', 35],
    ['Cabinet Véto Anjou', 'client', 40], ['Coiffure Passage Bleu', 'client', 55],
  ].map(([name, outcome, days]) => ({
    name,
    fields: { industry_label: 'Commerce', city: 'Angers', phone: '+33241000199' },
    opp: { type: 'website_redesign', trigger: null, occurred: null, needs: [['dated_platform', 45]] },
    assign: { outcome, daysAgo: days, notes: outcome === 'client' ? 'Signé — acompte reçu.' : null },
  })),
];

// ─── Insertion ──────────────────────────────────────────────────────────────
let inserted = 0;
for (const c of CASES) {
  if (c.fields?.domain && c.domain) {
    const { error } = await db.from('domains').upsert({ domain: c.fields.domain, first_seen_at: daysAgoIso(90), ...c.domain });
    if (error) throw new Error(`domains ${c.name} : ${error.message}`);
  }

  const { data: comp, error: compError } = await db.from('companies').insert(company(c)).select('id').single();
  if (compError) throw new Error(`companies ${c.name} : ${compError.message}`);

  const needScore = Math.min(100, c.opp.needs.reduce((s, [, p]) => s + p, 0));
  const { data: opp, error: oppError } = await db.from('opportunities').insert({
    company_id: comp.id,
    opportunity_type: c.opp.type,
    need_score: needScore,
    timing_score: c.opp.trigger ? 70 : 0,
    freshness_factor: 1,
    confidence_score: 0.85,
    base_score: c.assign.score ?? 60,
    reason_data: {
      trigger: c.opp.trigger,
      trigger_occurred_at: c.opp.occurred,
      need_breakdown: c.opp.needs.map(([signal, points]) => ({ signal, points })),
    },
    algorithm_version: 'demo',
    status: c.assign.outcome ? 'expired' : 'assigned',
    expires_at: hours(24 * 15),
  }).select('id').single();
  if (oppError) throw new Error(`opportunities ${c.name} : ${oppError.message}`);

  const closed = Boolean(c.assign.outcome);
  const outcomeAt = closed ? daysAgoIso(c.assign.daysAgo) : null;
  const { error: assignError } = await db.from('assignments').insert({
    user_id: user.id,
    company_id: comp.id,
    opportunity_id: opp.id,
    rank: c.assign.rank ?? 1,
    match_score: c.assign.score ?? 70,
    exclusive_until: c.assign.exclusive ?? daysAgoIso(c.assign.daysAgo ?? 0),
    status: closed ? 'completed' : (c.assign.contactedHoursAgo ? 'contacted' : 'active'),
    snoozed_at: c.assign.snoozed ? hours(-3) : null,
    contacted_at: closed ? outcomeAt : (c.assign.contactedHoursAgo ? hours(-c.assign.contactedHoursAgo) : null),
    outcome: c.assign.outcome ?? null,
    outcome_at: outcomeAt,
    notes: c.assign.notes ?? null,
    assigned_at: closed ? daysAgoIso((c.assign.daysAgo ?? 0) + 1) : hours(-(c.assign.assignedHoursAgo ?? 6)),
  });
  if (assignError) throw new Error(`assignments ${c.name} : ${assignError.message}`);
  inserted += 1;
}

console.log(`✓ ${inserted} attributions de démonstration pour ${email}`);
console.log('  Ce matin : 5 + 1 mis de côté (1 appelée, 1 urgente, 1 sans téléphone, 1 sans ville, 1 diagnostic)');
console.log('  À relancer : 5 (3 statuts, notes courte/longue/absente, 1 dossier à 24 j)');
console.log('  Closes : 10 (4 refus, 4 sans réponse, 2 clients)');
