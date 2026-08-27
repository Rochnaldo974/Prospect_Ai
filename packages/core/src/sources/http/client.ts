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
}

export class RateLimitedHttpClient {
  readonly #minIntervalMs: number;
  readonly #userAgent: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  #nextSlot = 0;

  constructor(options: HttpClientOptions) {
    this.#minIntervalMs = 1000 / options.requestsPerSecond;
    this.#userAgent = options.userAgent;
    this.#timeoutMs = options.timeoutMs ?? 60_000;
    this.#maxRetries = options.maxRetries ?? 3;
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
          const retryAfter = Number(response.headers.get('retry-after'));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : Math.min(60_000, 2 ** attempt * 1000);
          lastError = new Error(`HTTP ${response.status} sur ${url}`);
          this.#nextSlot = Date.now() + backoff;
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
        this.#nextSlot = Date.now() + Math.min(60_000, 2 ** attempt * 1000);
      } finally {
        clearTimeout(timer);
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
