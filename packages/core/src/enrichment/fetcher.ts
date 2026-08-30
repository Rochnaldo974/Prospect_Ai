/**
 * Récupération de pages web.
 *
 * On visite des sites d'entreprises réelles, sur des hébergements souvent
 * modestes. Trois obligations en découlent, qui ne sont pas négociables :
 *
 *   — s'identifier, pour que l'hébergeur puisse nous joindre plutôt que nous
 *     bloquer ;
 *   — respecter robots.txt ;
 *   — n'envoyer qu'une requête par seconde et par hôte.
 *
 * Un scan qui ferait tomber le site d'une boulangerie serait un échec complet,
 * quelle que soit la qualité des données récoltées.
 */

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number | null;
  redirectChain: string[];
  html: string | null;
  contentType: string | null;
  bytes: number;
  ttfbMs: number | null;
  hasSsl: boolean;
  /**
   * Certificat TLS, quand il a pu être examiné.
   *
   * `hasSsl` ne dit que le schéma de l'URL. Un certificat auto-signé, expiré
   * ou émis pour un autre nom fait afficher au visiteur un avertissement de
   * sécurité pleine page — le défaut le plus vérifiable qu'un freelance
   * puisse montrer à un commerçant, et le plus invisible à son propriétaire,
   * qui a cliqué « continuer » une fois pour toutes.
   */
  tls: TlsInspection | null;
  error: string | null;
  /** La page a été écartée avant téléchargement (robots.txt, type, taille). */
  skippedReason: 'robots' | 'content-type' | 'too-large' | null;
}

/**
 * Examen du certificat TLS d'un hôte.
 *
 * Une connexion à part, volontairement : `fetch` échoue sans expliquer
 * pourquoi quand le certificat est refusé, et un certificat invalide est
 * précisément ce qu'on cherche à constater. On ouvre donc la connexion en
 * acceptant tout, puis on demande à la couche TLS ce qu'elle en aurait pensé.
 *
 * Aucune donnée n'est échangée : la poignée de main suffit, et la connexion
 * est refermée aussitôt.
 */
const first = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function inspectTls(
  host: string,
  timeoutMs = 8000,
): Promise<TlsInspection | null> {
  const { connect } = await import('node:tls');

  return new Promise((resolve) => {
    let settled = false;
    const done = (value: TlsInspection | null): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    const socket = connect({
      host,
      port: 443,
      servername: host,
      // On veut constater le refus, pas l'éviter : la vérification est faite
      // après coup, sur la connexion établie.
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const error = socket.authorizationError;
      done({
        valid: socket.authorized,
        reason: error ? String(error) : null,
        validTo: cert?.valid_to ? new Date(cert.valid_to).toISOString() : null,
        // Certains champs du sujet peuvent être multivalués.
        issuer: first(cert?.issuer?.O) ?? first(cert?.issuer?.CN),
      });
    });

    socket.once('timeout', () => done(null));
    // Un hôte qui n'ouvre pas 443 n'a pas de certificat à examiner : ce n'est
    // pas un défaut de certificat, c'est une absence de HTTPS.
    socket.once('error', () => done(null));
  });
}

export interface TlsInspection {
  /** Le certificat est-il accepté par une chaîne de confiance publique ? */
  valid: boolean;
  /** Motif du refus, tel que rapporté par la couche TLS. */
  reason: string | null;
  /** Fin de validité, qui date le défaut quand il y en a un. */
  validTo: string | null;
  issuer: string | null;
}

export interface FetcherOptions {
  userAgent?: string;
  timeoutMs?: number;
  /** Taille maximale téléchargée. Au-delà, le contenu utile est déjà passé. */
  maxBytes?: number;
  /* Les redirections sont suivies par fetch lui-même, qui les plafonne. */
  /** Délai minimal entre deux requêtes vers le même hôte. */
  perHostDelayMs?: number;
  respectRobots?: boolean;
}

const DEFAULT_USER_AGENT =
  'ProspectAIBot/0.1 (+prospection B2B ; respecte robots.txt ; contact via le dépôt du projet)';

export class WebsiteFetcher {
  readonly #userAgent: string;
  readonly #timeoutMs: number;
  readonly #maxBytes: number;
  readonly #perHostDelayMs: number;
  readonly #respectRobots: boolean;

  /** Dernier passage par hôte, pour espacer les requêtes. */
  readonly #lastVisit = new Map<string, number>();
  /** robots.txt déjà lus, pour ne pas le redemander à chaque page. */
  readonly #robotsCache = new Map<string, RobotsRules>();

  constructor(options: FetcherOptions = {}) {
    this.#userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
    this.#maxBytes = options.maxBytes ?? 2_000_000;
    this.#perHostDelayMs = options.perHostDelayMs ?? 1000;
    this.#respectRobots = options.respectRobots ?? true;
  }

  async #waitForHost(host: string, signal?: AbortSignal): Promise<void> {
    const last = this.#lastVisit.get(host) ?? 0;
    const wait = last + this.#perHostDelayMs - Date.now();
    this.#lastVisit.set(host, Math.max(Date.now(), last + this.#perHostDelayMs));

    if (wait > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, wait);
        signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
  }

  async #getRobots(origin: string, signal?: AbortSignal): Promise<RobotsRules> {
    const cached = this.#robotsCache.get(origin);
    if (cached) return cached;

    let rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      signal?.addEventListener('abort', () => controller.abort(), { once: true });

      const response = await fetch(`${origin}/robots.txt`, {
        signal: controller.signal,
        headers: { 'User-Agent': this.#userAgent },
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (response.ok) {
        const body = (await response.text()).slice(0, 100_000);
        rules = parseRobots(body);
      }
      // Un robots.txt absent ou en erreur vaut autorisation : c'est la
      // convention, et refuser par défaut nous priverait de presque tout.
    } catch {
      // Idem : inaccessible ne veut pas dire interdit.
    }

    this.#robotsCache.set(origin, rules);
    return rules;
  }

  /**
   * @param accept Types de contenu acceptés. Par défaut le HTML seul : on ne
   *   télécharge pas une archive ou une vidéo pour y chercher un SIREN. Les
   *   feuilles de style font exception, quand on cherche à savoir si un site
   *   s'adapte au mobile.
   */
  async fetchPage(
    url: string,
    signal?: AbortSignal,
    accept: RegExp = /text\/html|application\/xhtml/i,
  ): Promise<FetchResult> {
    const base: FetchResult = {
      url,
      finalUrl: url,
      status: null,
      redirectChain: [],
      html: null,
      contentType: null,
      bytes: 0,
      ttfbMs: null,
      hasSsl: url.startsWith('https://'),
      tls: null,
      error: null,
      skippedReason: null,
    };

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ...base, error: 'URL invalide' };
    }

    if (this.#respectRobots) {
      const rules = await this.#getRobots(parsed.origin, signal);
      if (!isAllowed(rules, parsed.pathname)) {
        return { ...base, skippedReason: 'robots', error: 'Exclu par robots.txt' };
      }
    }

    await this.#waitForHost(parsed.host, signal);
    if (signal?.aborted) return { ...base, error: 'Annulé' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': this.#userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      });

      const ttfbMs = Date.now() - startedAt;
      const contentType = response.headers.get('content-type');
      const finalUrl = response.url || url;

      const result: FetchResult = {
        ...base,
        status: response.status,
        finalUrl,
        hasSsl: finalUrl.startsWith('https://'),
        tls: null,
        contentType,
        ttfbMs,
        redirectChain: finalUrl !== url ? [url, finalUrl] : [],
      };

      if (!response.ok) {
        // Le statut est l'information : un 404 ou un 500 sont des signaux en
        // eux-mêmes, pas des échecs de collecte.
        await response.body?.cancel();
        return result;
      }

      if (contentType && !accept.test(contentType)) {
        await response.body?.cancel();
        return { ...result, skippedReason: 'content-type' };
      }

      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > this.#maxBytes) {
        await response.body?.cancel();
        return { ...result, bytes: declaredLength, skippedReason: 'too-large' };
      }

      const html = await readCapped(response, this.#maxBytes);
      return { ...result, html, bytes: html.length };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...base,
        ttfbMs: Date.now() - startedAt,
        error: message.includes('abort') ? `Délai dépassé (${this.#timeoutMs} ms)` : message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Essaie plusieurs formes d'une même adresse.
   *
   * Beaucoup de sites de TPE ne répondent que sur une variante : HTTPS sans
   * www, HTTP avec www… Abandonner à la première erreur ferait conclure à tort
   * qu'un site n'existe pas.
   */
  async probeDomain(domain: string, signal?: AbortSignal): Promise<FetchResult> {
    // Un domaine qui ne résout pas ne répondra sur aucune variante. Sans ce
    // contrôle, chaque domaine mort coûtait quatre tentatives arrivées au
    // bout de leur délai, soit près d'une minute pour n'apprendre rien — et
    // c'est ce qui plafonnait le débit du scan national bien plus que la
    // concurrence. La résolution échoue en quelques millisecondes.
    if (!(await resolves(domain))) {
      return {
        url: `https://${domain}`, finalUrl: `https://${domain}`, status: null,
        redirectChain: [], html: null, contentType: null, bytes: 0, ttfbMs: null,
        hasSsl: false, tls: null, error: 'Domaine non résolu', skippedReason: null,
      };
    }

    const variants = [
      `https://${domain}`,
      `https://www.${domain}`,
      `http://${domain}`,
    ];

    let last: FetchResult | null = null;
    for (const url of variants) {
      if (signal?.aborted) break;
      const result = await this.fetchPage(url, signal);
      if (result.html !== null || result.skippedReason === 'robots') return result;
      // Un statut HTTP est une réponse : inutile d'essayer les autres formes.
      if (result.status !== null && result.status >= 400) return result;
      last = result;
    }

    return last ?? { url: `https://${domain}`, finalUrl: `https://${domain}`, status: null,
      redirectChain: [], html: null, contentType: null, bytes: 0, ttfbMs: null,
      hasSsl: false, tls: null, error: 'Aucune variante joignable', skippedReason: null };
  }
}

/**
 * Le domaine a-t-il une adresse ?
 *
 * On interroge le DNS plutôt que d'attendre quatre délais HTTP. Une absence
 * d'enregistrement est une réponse aussi ferme qu'un refus de connexion, et
 * elle coûte mille fois moins cher. En cas de panne du résolveur, on répond
 * oui : mieux vaut un scan lent qu'un parc entier déclaré mort.
 */
async function resolves(domain: string): Promise<boolean> {
  const { promises: dns } = await import('node:dns');

  try {
    const addresses = await dns.resolve4(domain);
    if (addresses.length > 0) return true;
  } catch (cause: unknown) {
    const code = (cause as { code?: string }).code;
    if (code !== 'ENOTFOUND' && code !== 'ENODATA') return true;
  }

  try {
    return (await dns.resolve6(domain)).length > 0;
  } catch (cause: unknown) {
    const code = (cause as { code?: string }).code;
    return code !== 'ENOTFOUND' && code !== 'ENODATA';
  }
}

/** Lit le corps de la réponse en s'arrêtant au plafond. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.length;
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

// ─── robots.txt ──────────────────────────────────────────────────────────────

export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
}

/**
 * Analyse un robots.txt.
 *
 * Ne retient que les groupes qui nous concernent : `User-agent: *` et une
 * éventuelle mention explicite de notre robot, qui prime.
 */
export function parseRobots(body: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };
  const specific: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };

  let scope: 'none' | 'wildcard' | 'ours' = 'none';

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      scope = agent === '*' ? 'wildcard' : agent.includes('prospectai') ? 'ours' : 'none';
      continue;
    }

    if (scope === 'none') continue;
    const target = scope === 'ours' ? specific : rules;

    if (field === 'disallow' && value) target.disallow.push(value);
    else if (field === 'allow' && value) target.allow.push(value);
    else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) target.crawlDelayMs = seconds * 1000;
    }
  }

  // Une règle nous visant nommément l'emporte sur la règle générale.
  return specific.disallow.length > 0 || specific.allow.length > 0 ? specific : rules;
}

export function isAllowed(rules: RobotsRules, path: string): boolean {
  const matchLength = (patterns: string[]): number => {
    let best = -1;
    for (const pattern of patterns) {
      if (pattern === '/') {
        best = Math.max(best, 1);
        continue;
      }
      if (path.startsWith(pattern)) best = Math.max(best, pattern.length);
    }
    return best;
  };

  const disallowed = matchLength(rules.disallow);
  if (disallowed === -1) return true;

  // La règle la plus spécifique l'emporte, conformément à la convention.
  return matchLength(rules.allow) >= disallowed;
}
