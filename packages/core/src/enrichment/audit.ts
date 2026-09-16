/**
 * La note du site, à partir de mesures.
 *
 * Quatre sous-notes, une note globale, et pour chacune la mesure qui la
 * justifie, écrite comme on la dirait au commerçant : « 5,2 s pour
 * s'afficher », « déborde de l'écran sur téléphone », « aucune balise
 * titre ». Pas d'avis esthétique : tout ce qui entre ici a été mesuré par
 * le navigateur du moteur, et se revérifie en ouvrant le site.
 *
 * Les barèmes sont volontairement simples et lisibles. Ils ne prétendent
 * pas reproduire un outil d'audit professionnel ; ils classent, et ils
 * expliquent leur classement.
 */

export interface SiteMeasures {
  url: string;
  https: boolean;
  /** Temps jusqu'au DOM prêt et jusqu'au chargement complet, en ms. Null si non mesurable. */
  domContentLoadedMs: number | null;
  loadMs: number | null;
  /** Le chargement complet n'est pas arrivé dans le délai imparti. */
  loadTimedOut: boolean;
  requests: number;
  transferBytes: number;
  imageBytes: number;
  /** Ressources chargées en http depuis une page https. */
  mixedContent: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imagesTotal: number;
  imagesWithAlt: number;
  lang: string | null;
  viewportMeta: boolean;
  /** Sur un écran de téléphone : la page déborde horizontalement. */
  mobileOverflow: boolean;
  /** Taille de police du corps de page sur téléphone, en px. */
  mobileBodyFontPx: number | null;
  /** Au moins un lien ou bouton d'appel visible : tel:, formulaire, mailto. */
  hasTelLink: boolean;
  hasMailLink: boolean;
  hasForm: boolean;
  /** Mention de copyright la plus récente trouvée dans la page. */
  copyrightYear: number | null;
  /** Certificat valide, quand on l'a examiné à part. */
  tlsValid: boolean | null;
}

export interface SiteScores {
  speed: number;
  mobile: number;
  seo: number;
  trust: number;
}

export interface SiteAudit {
  score: number;
  scores: SiteScores;
  /** Les constats, du plus grave au plus léger, formulés pour être dits. */
  findings: string[];
  measures: SiteMeasures;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const fr = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',');
const mb = (bytes: number) => fr(bytes / 1_000_000);

export function scoreSite(m: SiteMeasures, now = new Date()): SiteAudit {
  const findings: { severity: number; text: string }[] = [];
  const note = (severity: number, text: string) => findings.push({ severity, text });

  // ── Vitesse ──────────────────────────────────────────────────────────
  let speed = 100;
  const load = m.loadTimedOut ? null : m.loadMs;
  if (m.loadTimedOut) {
    speed = 5;
    note(90, "Le site n'a pas fini de charger en 25 secondes");
  } else if (load !== null) {
    if (load > 8000) { speed = 10; note(85, `${fr(load / 1000)} s pour s'afficher complètement`); }
    else if (load > 5000) { speed = 30; note(75, `${fr(load / 1000)} s pour s'afficher complètement`); }
    else if (load > 3000) { speed = 60; note(45, `${fr(load / 1000)} s pour s'afficher complètement`); }
    else if (load > 2000) { speed = 80; }
  }
  if (m.transferBytes > 6_000_000) { speed -= 25; note(60, `Page de ${mb(m.transferBytes)} Mo, ${m.requests} requêtes`); }
  else if (m.transferBytes > 3_000_000) { speed -= 12; note(35, `Page de ${mb(m.transferBytes)} Mo`); }
  if (m.imageBytes > 2_500_000) { speed -= 10; note(40, `${mb(m.imageBytes)} Mo d'images non optimisées`); }

  // ── Mobile ───────────────────────────────────────────────────────────
  let mobile = 100;
  if (!m.viewportMeta) { mobile -= 45; note(80, 'Aucune adaptation aux écrans de téléphone déclarée'); }
  if (m.mobileOverflow) { mobile -= 40; note(85, "Déborde de l'écran sur téléphone : il faut faire défiler de côté"); }
  if (m.mobileBodyFontPx !== null && m.mobileBodyFontPx < 13) {
    mobile -= 15; note(50, `Texte de ${Math.round(m.mobileBodyFontPx)} px sur téléphone, illisible sans zoomer`);
  }

  // ── Bases SEO ────────────────────────────────────────────────────────
  let seo = 100;
  if (!m.title || m.title.trim().length < 5) { seo -= 35; note(70, 'Aucune balise titre : invisible dans les résultats de recherche'); }
  else if (m.title.length > 70) { seo -= 8; }
  if (!m.metaDescription) { seo -= 25; note(45, 'Aucune description pour les moteurs de recherche'); }
  if (m.h1Count === 0) { seo -= 15; note(35, 'Aucun titre principal (H1) dans la page'); }
  else if (m.h1Count > 3) { seo -= 8; }
  if (m.imagesTotal >= 3 && m.imagesWithAlt / m.imagesTotal < 0.5) {
    seo -= 12; note(30, `${m.imagesTotal - m.imagesWithAlt} images sur ${m.imagesTotal} sans description`);
  }
  if (!m.lang) { seo -= 5; }

  // ── Confiance ────────────────────────────────────────────────────────
  let trust = 100;
  if (!m.https) { trust -= 45; note(88, 'Servi sans HTTPS : « Non sécurisé » dans la barre d’adresse, et Google le pénalise'); }
  else if (m.tlsValid === false) { trust -= 45; note(88, 'Certificat refusé par les navigateurs : page d’avertissement avant le site'); }
  if (m.mixedContent > 0) { trust -= 15; note(50, `${m.mixedContent} élément(s) chargés sans sécurité sur une page sécurisée`); }
  if (!m.hasTelLink && !m.hasForm && !m.hasMailLink) { trust -= 25; note(55, 'Aucun moyen de contact cliquable : ni téléphone, ni formulaire, ni e-mail'); }
  if (m.copyrightYear !== null) {
    const age = now.getFullYear() - m.copyrightYear;
    if (age >= 4) { trust -= 15; note(65, `Mention « © ${m.copyrightYear} » : ${age} ans sans mise à jour visible`); }
    else if (age >= 2) { trust -= 5; }
  }

  const scores: SiteScores = { speed: clamp(speed), mobile: clamp(mobile), seo: clamp(seo), trust: clamp(trust) };
  // La moyenne pondérée, plafonnée par le pire sous-score : un site rapide
  // et lisible mais « non sécurisé » sans aucun contact n'est pas un site
  // à 84. Le défaut le plus grave pèse sur la note qu'on lit en premier.
  const weighted = scores.speed * 0.3 + scores.mobile * 0.3 + scores.seo * 0.2 + scores.trust * 0.2;
  const worst = Math.min(scores.speed, scores.mobile, scores.seo, scores.trust);
  const score = clamp(Math.min(weighted, worst + 40));

  return {
    score,
    scores,
    findings: findings.sort((a, b) => b.severity - a.severity).map((f) => f.text),
    measures: m,
  };
}
