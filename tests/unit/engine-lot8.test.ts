import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimitedHttpClient } from '../../packages/core/src/sources/http/client';
import { SOURCE_POLICIES, httpClientFor, resetHttpClients } from '../../packages/core/src/sources/http/policy';
import { WebsiteFetcher } from '../../packages/core/src/enrichment/fetcher';

/**
 * Lot 8 : chaque source a sa politique, aucun appel externe ne part sans
 * délai ni relance, le scanner respecte le crawl-delay, et la console
 * voit le pipeline.
 */

afterEach(() => { vi.restoreAllMocks(); resetHttpClients(); });

describe('politique par source', () => {
  it('chaque source déclare débit, concurrence, délai, relances et recul', () => {
    for (const [name, policy] of Object.entries(SOURCE_POLICIES)) {
      expect(policy.requestsPerSecond, name).toBeGreaterThan(0);
      expect(policy.concurrency, name).toBeGreaterThanOrEqual(1);
      expect(policy.timeoutMs, name).toBeGreaterThan(0);
      expect(policy.maxRetries, name).toBeGreaterThanOrEqual(0);
      expect(policy.backoffMs, name).toBeGreaterThanOrEqual(0);
    }
    expect(SOURCE_POLICIES.google_places.maxRetries).toBeLessThanOrEqual(1);
    expect(SOURCE_POLICIES.sirene_api.requestsPerSecond).toBeLessThan(0.5);
  });
  it('un client par source, partagé, avec la politique déclarée', () => {
    const a = httpClientFor('boamp');
    const b = httpClientFor('boamp');
    expect(a).toBe(b);
    expect(a.policy.timeoutMs).toBe(SOURCE_POLICIES.boamp.timeoutMs);
    expect(httpClientFor('osm')).not.toBe(a);
  });
});

describe('client HTTP : relances, recul, concurrence', () => {
  it('recule après un 429 puis réussit, en respectant retry-after', async () => {
    const calls: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls.push(Date.now());
      if (calls.length === 1) return new Response('slow down', { status: 429, headers: { 'retry-after': '0' } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const client = new RateLimitedHttpClient({ requestsPerSecond: 1000, userAgent: 'test', maxRetries: 2, backoffMs: 1 });
    const out = await client.fetchJson<{ ok: boolean }>('https://example.test/x');
    expect(out.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(client.backoffFor(0, null)).toBe(1);
    expect(client.backoffFor(3, null)).toBe(8);
    expect(client.backoffFor(0, 7)).toBe(7000);
    expect(client.backoffFor(20, null)).toBe(60_000);
  });
  it('abandonne après le nombre de relances et remonte l’erreur', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('down', { status: 503 }));
    const client = new RateLimitedHttpClient({ requestsPerSecond: 1000, userAgent: 'test', maxRetries: 1, backoffMs: 1 });
    await expect(client.fetchJson('https://example.test/y')).rejects.toThrow(/HTTP 503/);
  });
  it('ne dépasse jamais la concurrence déclarée', async () => {
    let inFlight = 0; let peak = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      inFlight += 1; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return new Response('{}', { status: 200 });
    });
    const client = new RateLimitedHttpClient({ requestsPerSecond: 10_000, userAgent: 'test', concurrency: 2, maxRetries: 0 });
    await Promise.all(Array.from({ length: 6 }, (_, i) => client.fetchJson(`https://example.test/${i}`)));
    expect(peak).toBeLessThanOrEqual(2);
  });
  it('fetchText rend null sur 404 et le texte sinon', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).endsWith('missing') ? new Response('', { status: 404 }) : new Response('a.fr\nb.fr', { status: 200 }));
    const client = new RateLimitedHttpClient({ requestsPerSecond: 1000, userAgent: 'test', maxRetries: 0 });
    expect(await client.fetchText('https://example.test/missing')).toBeNull();
    expect(await client.fetchText('https://example.test/list')).toBe('a.fr\nb.fr');
  });
});

describe('scanner : crawl-delay respecté, borné', () => {
  it('prend le plus long des deux délais, jamais plus de dix secondes', () => {
    expect(WebsiteFetcher.hostDelayMs(1000, null)).toBe(1000);
    expect(WebsiteFetcher.hostDelayMs(1000, 500)).toBe(1000);
    expect(WebsiteFetcher.hostDelayMs(1000, 3000)).toBe(3000);
    expect(WebsiteFetcher.hostDelayMs(1000, 60_000)).toBe(10_000);
  });
});
