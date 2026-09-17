/**
 * Client HTTP pour les sources externes.
 *
 * Ces sources sont des services publics gratuits (Overpass, data.gouv.fr,
 * BODACC). Les interroger poliment n'est pas une politesse : c'est la
 * condition pour continuer à y accéder. D'où le limiteur de débit, les
 * relances espacées et l'en-tête d'identification.
 */

export interface HttpClientOptions {
  /** Requêtes par seconde autorisées. */
  requestsPerSecond: number;
  /** Identifie l'appelant auprès du service. Exigé par Overpass et Nominatim. */
  userAgent: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Requêtes en vol au plus, toutes URL confondues. */
  concurrency?: number;
  /** Recul initial après un 429 ou un 5xx, doublé à chaque relance. */
  backoffMs?: number;
}

export class RateLimitedHttpClient {
  readonly #minIntervalMs: number;
  readonly #userAgent: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #concurrency: number;
  readonly #backoffMs: number;
  #nextSlot = 0;
  #inFlight = 0;
  readonly #waiters: (() => void)[] = [];

  constructor(options: HttpClientOptions) {
    this.#minIntervalMs = 1000 / options.requestsPerSecond;
    this.#userAgent = options.userAgent;
    this.#timeoutMs = options.timeoutMs ?? 60_000;
    this.#maxRetries = options.maxRetries ?? 3;
    this.#concurrency = Math.max(1, options.concurrency ?? 2);
    this.#backoffMs = options.backoffMs ?? 1000;
  }

  /** La politique effective, lisible par les tests et la console. */
  get policy(): { requestsPerSecond: number; concurrency: number; timeoutMs: number; maxRetries: number; backoffMs: number } {
    return { requestsPerSecond: 1000 / this.#minIntervalMs, concurrency: this.#concurrency, timeoutMs: this.#timeoutMs, maxRetries: this.#maxRetries, backoffMs: this.#backoffMs };
  }

  /** Une place parmi les requêtes en vol. */
  async #enter(): Promise<void> {
    if (this.#inFlight < this.#concurrency) { this.#inFlight += 1; return; }
    await new Promise<void>((resolve) => this.#waiters.push(resolve));
    this.#inFlight += 1;
  }

  #leave(): void {
    this.#inFlight -= 1;
    const next = this.#waiters.shift();
    if (next) next();
  }

  /** Le recul après un échec transitoire : doublé à chaque essai, borné à une minute. */
  backoffFor(attempt: number, retryAfterSeconds?: number | null): number {
    if (retryAfterSeconds && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) return retryAfterSeconds * 1000;
    return Math.min(60_000, this.#backoffMs * 2 ** attempt);
  }

  /**
   * Une réponse brute, avec le même débit, le même délai et les mêmes
   * relances que le JSON. Pour un fichier texte, un HEAD, un flux.
   */
  async fetchResponse(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      if (signal?.aborted) throw new Error('Requête annulée');
      await this.#acquireSlot(signal);
      await this.#enter();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
      signal?.addEventListener('abort', () => controller.abort(), { once: true });
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: { 'User-Agent': this.#userAgent, ...init.headers },
        });
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`HTTP ${response.status} sur ${url}`);
          this.#nextSlot = Date.now() + this.backoffFor(attempt, Number(response.headers.get('retry-after')));
          continue;
        }
        return response;
      } catch (error: unknown) {
        lastError = error;
        if (attempt === this.#maxRetries) break;
        this.#nextSlot = Date.now() + this.backoffFor(attempt);
      } finally {
        clearTimeout(timer);
        this.#leave();
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Échec de la requête vers ${url}`);
  }

  /** Un texte (liste AFNIC, robots.txt…) ; null pour un 404. */
  async fetchText(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<string | null> {
    const response = await this.fetchResponse(url, init, signal);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status} sur ${url}`);
    return response.text();
  }

  /** Attend son tour dans la file de débit. */
  async #acquireSlot(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.#nextSlot - now);
    this.#nextSlot = Math.max(now, this.#nextSlot) + this.#minIntervalMs;

    if (wait > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, wait);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }
  }

  async fetchJson<T>(
    url: string,
    init: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      if (signal?.aborted) throw new Error('Requête annulée');
      await this.#acquireSlot(signal);
      await this.#enter();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
      signal?.addEventListener('abort', () => controller.abort(), { once: true });

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            'User-Agent': this.#userAgent,
            Accept: 'application/json',
            ...init.headers,
          },
        });

        // 429 et 5xx sont transitoires : on réessaie en s'écartant davantage.
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`HTTP ${response.status} sur ${url}`);
          this.#nextSlot = Date.now() + this.backoffFor(attempt, Number(response.headers.get('retry-after')));
          continue;
        }

        if (!response.ok) {
          // 4xx autre que 429 : la requête est fautive, réessayer est inutile.
          const body = await response.text();
          throw new Error(`HTTP ${response.status} sur ${url} — ${body.slice(0, 200)}`);
        }

        return (await response.json()) as T;
      } catch (error: unknown) {
        lastError = error;
        if (error instanceof Error && error.message.startsWith('HTTP 4')) throw error;
        if (attempt === this.#maxRetries) break;
        this.#nextSlot = Date.now() + this.backoffFor(attempt);
      } finally {
        clearTimeout(timer);
        this.#leave();
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Échec de la requête vers ${url}`);
  }
}

/**
 * Identification par défaut.
 *
 * Overpass rejette les clients anonymes en période de charge, et une adresse
 * de contact permet à l'opérateur de nous prévenir plutôt que de nous bloquer.
 */
export const DEFAULT_USER_AGENT =
  'ProspectAI/0.1 (prospection B2B pour freelances ; contact via le dépôt du projet)';
