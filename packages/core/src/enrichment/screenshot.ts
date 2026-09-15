import { existsSync } from 'node:fs';
import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { scoreSite, type SiteAudit, type SiteMeasures } from './audit';

/**
 * Capture d'écran d'un site, par notre propre navigateur.
 *
 * L'aperçu en iframe ne montrait presque jamais rien : les sites interdisent
 * l'intégration, et sans scripts un site moderne reste blanc. Le freelance
 * lisait « site figé en 2011 » sans pouvoir le voir. On ouvre donc le site
 * dans un Chromium sans tête, on photographie ce que verrait un visiteur,
 * et on range l'image à côté du domaine — datée, parce qu'elle est aussi la
 * preuve de ce que la fiche affirme ce jour-là.
 *
 * Un navigateur coûte cher : la capture ne se fait qu'au moment de la
 * vérification d'un dossier choisi, jamais dans le scan de masse.
 *
 * Deux façons de trouver Chromium : `CHROME_PATH` (ou le Chrome installé
 * sur une machine de développement), sinon le Chromium empaqueté pour les
 * environnements Linux sans navigateur.
 */

const BUCKET = 'site-shots';
const CANDIDATE_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export interface CaptureOptions {
  timeoutMs?: number;
  width?: number;
  height?: number;
  logger?: Logger;
}

async function resolveChromium(): Promise<{ executablePath: string; args: string[] }> {
  const configured = process.env['CHROME_PATH'];
  const local = configured && existsSync(configured)
    ? configured
    : CANDIDATE_CHROME_PATHS.find((p) => existsSync(p));
  if (local) return { executablePath: local, args: ['--no-sandbox', '--disable-gpu'] };

  const chromium = (await import('@sparticuz/chromium')).default;
  return { executablePath: await chromium.executablePath(), args: chromium.args };
}

type DesktopMeasures = Omit<SiteMeasures, 'url' | 'loadTimedOut' | 'mobileOverflow' | 'mobileBodyFontPx' | 'tlsValid'>;
interface MobileMeasures { overflow: boolean; bodyFontPx: number | null }

/** Relevé sur l'écran de bureau. Exécuté dans la page, jamais ici. */
const DESKTOP_MEASURES = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  const isHttps = location.protocol === 'https:';
  const transfer = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) + (nav ? nav.transferSize || 0 : 0);
  const images = resources.filter((r) => r.initiatorType === 'img' || /\\.(png|jpe?g|gif|webp|avif|svg)(\\?|$)/i.test(r.name));
  const imageBytes = images.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  const mixed = isHttps ? resources.filter((r) => r.name.startsWith('http://')).length : 0;
  const imgs = Array.from(document.images);
  const text = document.body ? document.body.innerText : '';
  const years = Array.from(text.matchAll(/(?:©|\\(c\\)|copyright)\\s*(?:\\d{4}\\s*[-–]\\s*)?(\\d{4})/gi))
    .map((m) => Number(m[1])).filter((y) => y >= 1995 && y <= 2100);
  const metaTag = document.querySelector('meta[name="description"]');
  return {
    https: isHttps,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadMs: nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
    requests: resources.length + 1,
    transferBytes: transfer,
    imageBytes,
    mixedContent: mixed,
    title: document.title || null,
    metaDescription: metaTag ? metaTag.getAttribute('content') : null,
    h1Count: document.querySelectorAll('h1').length,
    imagesTotal: imgs.length,
    imagesWithAlt: imgs.filter((i) => (i.getAttribute('alt') || '').trim().length > 0).length,
    lang: document.documentElement.lang || null,
    viewportMeta: document.querySelector('meta[name="viewport"]') !== null,
    hasTelLink: document.querySelector('a[href^="tel:"]') !== null,
    hasMailLink: document.querySelector('a[href^="mailto:"]') !== null,
    hasForm: document.querySelector('form textarea, form input[type="email"], form input[type="tel"]') !== null,
    copyrightYear: years.length > 0 ? Math.max(...years) : null,
  };
})()`;

/** Relevé sur l'écran d'un téléphone. */
const MOBILE_MEASURES = `(() => ({
  overflow: document.documentElement.scrollWidth > window.innerWidth + 8,
  bodyFontPx: document.body ? parseFloat(getComputedStyle(document.body).fontSize) : null,
}))()`;

export interface Capture {
  image: Buffer | null;
  measures: SiteMeasures | null;
}

/**
 * Photographie la page d'accueil et la mesure, dans une même session.
 *
 * Le navigateur est ouvert de toute façon pour la capture : on en profite
 * pour relever ce que voit un visiteur — temps de chargement, poids, tenue
 * sur téléphone, balises — plutôt que de l'ouvrir deux fois.
 */
export async function captureScreenshot(
  url: string,
  options: CaptureOptions & { tlsValid?: boolean | null } = {},
): Promise<Capture> {
  const puppeteer = (await import('puppeteer-core')).default;
  const { executablePath, args } = await resolveChromium();
  const browser = await puppeteer.launch({ executablePath, args, headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: options.width ?? 1280, height: options.height ?? 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    );

    // Chargement complet, borné : un site qui n'y arrive pas en 25 s est un
    // constat en soi, pas une raison d'abandonner la capture.
    let loadTimedOut = false;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: options.timeoutMs ?? 25_000 });
    } catch (cause: unknown) {
      if (cause instanceof Error && /timeout/i.test(cause.message)) loadTimedOut = true;
      else throw cause;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const image = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false }));

    let measures: SiteMeasures | null = null;
    try {
      // Le code exécuté dans la page est une chaîne : le paquet core n'a pas
      // les types du navigateur, et n'a pas à les avoir — ce script ne tourne
      // jamais ici, seulement dans la page ouverte.
      const desktop = (await page.evaluate(DESKTOP_MEASURES)) as DesktopMeasures;

      // Puis l'écran d'un téléphone : ce que voit l'essentiel des visiteurs
      // d'un commerce local.
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const mobile = (await page.evaluate(MOBILE_MEASURES)) as MobileMeasures;

      measures = {
        url,
        ...desktop,
        loadTimedOut,
        copyrightYear: typeof desktop.copyrightYear === 'number' && Number.isFinite(desktop.copyrightYear) ? desktop.copyrightYear : null,
        mobileOverflow: mobile.overflow,
        mobileBodyFontPx: typeof mobile.bodyFontPx === 'number' && Number.isFinite(mobile.bodyFontPx) ? mobile.bodyFontPx : null,
        tlsValid: options.tlsValid ?? null,
      };
    } catch (cause: unknown) {
      options.logger?.debug?.('Mesure impossible', {
        url, error: cause instanceof Error ? cause.message : String(cause),
      });
    }

    return { image, measures };
  } catch (cause: unknown) {
    options.logger?.debug?.('Capture impossible', {
      url, error: cause instanceof Error ? cause.message : String(cause),
    });
    return { image: null, measures: null };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Capture le site d'un domaine, le mesure, et enregistre les deux. Renvoie l'audit, ou null. */
export async function captureAndStore(
  db: Db,
  domain: string,
  options: CaptureOptions = {},
): Promise<{ path: string | null; audit: SiteAudit | null }> {
  const { data: row } = await db
    .from('domains')
    .select('domain, final_url, status, tls_valid')
    .eq('domain', domain)
    .maybeSingle();
  if (!row) return { path: null, audit: null };
  // Un site cassé ou injoignable se photographie aussi : l'erreur affichée
  // est le constat. Un domaine exclu par robots.txt, non : on respecte.
  if (row.status === 'excluded') return { path: null, audit: null };

  const url = row.final_url ?? `https://${domain}`;
  const capture = await captureScreenshot(url, { ...options, tlsValid: row.tls_valid });
  const audit = capture.measures ? scoreSite(capture.measures) : null;
  const now = new Date().toISOString();

  let path: string | null = null;
  if (capture.image) {
    const stamp = now.slice(0, 10).replace(/-/g, '');
    path = `${domain}/${stamp}.jpg`;
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, capture.image, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) {
      options.logger?.warn('Capture non enregistrée', { domain, error: uploadError.message });
      path = null;
    }
  }

  if (path || audit) {
    await db
      .from('domains')
      .update({
        ...(path ? { screenshot_path: path, screenshot_at: now } : {}),
        ...(audit ? {
          site_score: audit.score,
          site_scores: { scores: audit.scores, findings: audit.findings, measures: audit.measures } as unknown as Json,
          audited_at: now,
        } : {}),
      })
      .eq('domain', domain);
  }

  return { path, audit };
}

/** L'URL publique d'une capture, à partir de son chemin. */
export function screenshotUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`;
}
