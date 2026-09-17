import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';

/**
 * Performance : mesurer vite, auditer rarement.
 *
 * Le scan de nuit lit ce que la page d'accueil montre — temps de première
 * réponse, poids du HTML, nombre de scripts, scripts qui bloquent le rendu,
 * images. Ça suffit à désigner les sites suspects. Eux seuls reçoivent un
 * audit approfondi : on télécharge un échantillon de leurs ressources pour
 * peser les scripts, les styles et les images. Pas de PageSpeed, pas de
 * navigateur : un poids se mesure en octets, et c'est ce qu'un freelance
 * peut montrer.
 */

export interface PerformanceFacts {
  ttfbMs: number | null;
  htmlBytes: number | null;
  scriptCount: number;
  externalScriptCount: number;
  /** Scripts dans <head> sans async ni defer : le rendu attend chacun. */
  renderBlockingScripts: number;
  stylesheetCount: number;
  inlineStyleBytes: number;
  imageCount: number;
  lazyImages: number;
  iframeCount: number;
}

/** Ce que la page d'accueil dit sans télécharger ses ressources. */
export function readPerformanceFacts(source: string, fetch: { ttfbMs: number | null; bytes: number | null }): PerformanceFacts {
  const head = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const scripts = source.match(/<script\b[^>]*>/gi) ?? [];
  const external = scripts.filter((tag) => /\ssrc\s*=/i.test(tag));
  const headScripts = head.match(/<script\b[^>]*\ssrc\s*=[^>]*>/gi) ?? [];
  const blocking = headScripts.filter((tag) => !/\s(async|defer|type\s*=\s*["']module["'])/i.test(tag)).length;
  const stylesheets = (source.match(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi) ?? []).length;
  const inlineStyle = (source.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []).reduce((sum, block) => sum + block.length, 0);
  const images = source.match(/<img\b[^>]*>/gi) ?? [];
  const lazy = images.filter((tag) => /loading\s*=\s*["']lazy["']/i.test(tag)).length;
  const iframes = (source.match(/<iframe\b/gi) ?? []).length;
  return {
    ttfbMs: fetch.ttfbMs, htmlBytes: fetch.bytes,
    scriptCount: scripts.length, externalScriptCount: external.length, renderBlockingScripts: blocking,
    stylesheetCount: stylesheets, inlineStyleBytes: inlineStyle,
    imageCount: images.length, lazyImages: lazy, iframeCount: iframes,
  };
}

/** Les seuils qui désignent un site à auditer. Faits, pas notes. */
export const PERFORMANCE_SUSPECT_THRESHOLDS = {
  ttfbMs: 1200, htmlBytes: 600_000, renderBlockingScripts: 5, scriptCount: 20, imageCount: 40,
} as const;

export function isPerformanceSuspect(facts: PerformanceFacts): boolean {
  const t = PERFORMANCE_SUSPECT_THRESHOLDS;
  return (facts.ttfbMs ?? 0) >= t.ttfbMs
    || (facts.htmlBytes ?? 0) >= t.htmlBytes
    || facts.renderBlockingScripts >= t.renderBlockingScripts
    || facts.scriptCount >= t.scriptCount
    || facts.imageCount >= t.imageCount;
}

export interface PerformanceAudit {
  totalBytes: number;
  jsBytes: number;
  cssBytes: number;
  imageBytes: number;
  largestImageBytes: number;
  largestImageUrl: string | null;
  assetsSampled: number;
  assetsFailed: number;
  auditedAt: string;
}

export type AssetKind = 'js' | 'css' | 'image';
export interface AssetRef { url: string; kind: AssetKind }

const SRC = /<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi;
const CSS = /<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["']|<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']stylesheet["']/gi;
const IMG = /<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi;

/** Les ressources de la page, résolues, dédoublonnées, bornées par famille. */
export function extractAssetUrls(html: string, baseUrl: string, perKind = 8): AssetRef[] {
  const out: AssetRef[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined, kind: AssetKind) => {
    if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:')) return;
    let resolved: string;
    try { resolved = new URL(raw.trim(), baseUrl).toString(); } catch { return; }
    if (!/^https?:/.test(resolved) || seen.has(resolved)) return;
    if (out.filter((a) => a.kind === kind).length >= perKind) return;
    seen.add(resolved);
    out.push({ url: resolved, kind });
  };
  for (const m of html.matchAll(SRC)) push(m[1], 'js');
  for (const m of html.matchAll(CSS)) push(m[1] ?? m[2], 'css');
  for (const m of html.matchAll(IMG)) push(m[1], 'image');
  return out;
}

/** Les poids relevés, résumés. Pur : testable sans réseau. */
export function summarizeAssets(sizes: { asset: AssetRef; bytes: number | null }[], auditedAt = new Date().toISOString()): PerformanceAudit {
  const audit: PerformanceAudit = { totalBytes: 0, jsBytes: 0, cssBytes: 0, imageBytes: 0, largestImageBytes: 0, largestImageUrl: null, assetsSampled: 0, assetsFailed: 0, auditedAt };
  for (const { asset, bytes } of sizes) {
    if (bytes === null) { audit.assetsFailed += 1; continue; }
    audit.assetsSampled += 1;
    audit.totalBytes += bytes;
    if (asset.kind === 'js') audit.jsBytes += bytes;
    else if (asset.kind === 'css') audit.cssBytes += bytes;
    else {
      audit.imageBytes += bytes;
      if (bytes > audit.largestImageBytes) { audit.largestImageBytes = bytes; audit.largestImageUrl = asset.url; }
    }
  }
  return audit;
}

const MAX_BODY_BYTES = 4_000_000;
const USER_AGENT = 'ProspectAiBot/1.0 (+https://prospect-ai.fr/bot)';

/** Le poids d'une ressource : Content-Length si le serveur le donne, sinon le corps, borné. */
export async function measureAsset(url: string, signal?: AbortSignal): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': USER_AGENT } });
    const declared = Number(head.headers.get('content-length'));
    if (head.ok && Number.isFinite(declared) && declared > 0) return declared;
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': USER_AGENT } });
    if (!res.ok || !res.body) return null;
    const fromHeader = Number(res.headers.get('content-length'));
    if (Number.isFinite(fromHeader) && fromHeader > 0) { await res.body.cancel(); return fromHeader; }
    let total = 0;
    const reader = res.body.getReader();
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.byteLength ?? 0;
    }
    await reader.cancel().catch(() => undefined);
    return total;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface PerformanceAuditReport { examined: number; audited: number; failed: number }

export interface PerformanceAuditOptions {
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  /** Injectable : les tests ne téléchargent rien. */
  measure?: (url: string, signal?: AbortSignal) => Promise<number | null>;
  fetchPage?: (url: string, signal?: AbortSignal) => Promise<{ html: string; finalUrl: string } | null>;
}

async function defaultFetchPage(url: string, signal?: AbortSignal): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/html' } });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 1_000_000);
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Audite les sites présélectionnés, les plus récemment scannés d'abord. */
export async function auditPerformance(db: Db, options: PerformanceAuditOptions = {}): Promise<PerformanceAuditReport> {
  const report: PerformanceAuditReport = { examined: 0, audited: 0, failed: 0 };
  const log = options.logger;
  const measure = options.measure ?? measureAsset;
  const fetchPage = options.fetchPage ?? defaultFetchPage;
  const limit = Math.min(options.limit ?? 200, 1000);

  const { data: due, error } = await db
    .from('domains')
    .select('domain, final_url')
    .eq('performance_audit_status', 'pending')
    .eq('status', 'reachable')
    .order('last_checked_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`auditPerformance : ${error.message}`);

  for (const row of due ?? []) {
    if (options.signal?.aborted) break;
    report.examined += 1;
    const pageUrl = row.final_url ?? `https://${row.domain}/`;
    const page = await fetchPage(pageUrl, options.signal);
    if (!page) {
      report.failed += 1;
      await db.from('domains').update({ performance_audit_status: 'failed', last_performance_audit_at: new Date().toISOString() }).eq('domain', row.domain);
      continue;
    }
    const assets = extractAssetUrls(page.html, page.finalUrl);
    const sizes: { asset: AssetRef; bytes: number | null }[] = [];
    for (const asset of assets) {
      if (options.signal?.aborted) break;
      sizes.push({ asset, bytes: await measure(asset.url, options.signal) });
    }
    const audit = summarizeAssets(sizes);
    const { error: writeError } = await db.from('domains').update({
      performance_audit: audit as unknown as Json,
      performance_audit_status: 'done',
      last_performance_audit_at: audit.auditedAt,
    }).eq('domain', row.domain);
    if (writeError) { report.failed += 1; log?.warn('Audit de performance non enregistré', { domain: row.domain, error: writeError.message }); continue; }
    report.audited += 1;
  }

  log?.info('Audit de performance terminé', { ...report });
  return report;
}
