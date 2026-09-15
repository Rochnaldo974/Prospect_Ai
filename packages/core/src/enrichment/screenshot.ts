import { existsSync } from 'node:fs';
import type { Db } from '../db/client';
import type { Logger } from '../logger';

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

/** Photographie la page d'accueil, en JPEG. Null si le site ne se laisse pas capturer. */
export async function captureScreenshot(
  url: string,
  options: CaptureOptions = {},
): Promise<Buffer | null> {
  const puppeteer = (await import('puppeteer-core')).default;
  const { executablePath, args } = await resolveChromium();
  const browser = await puppeteer.launch({ executablePath, args, headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: options.width ?? 1280, height: options.height ?? 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    );
    // « domcontentloaded » puis un court répit : attendre le réseau au calme
    // fait échouer les sites qui chargent des traceurs sans fin, et c'est
    // l'écran après deux secondes que voit un visiteur.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs ?? 20_000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const image = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
    return Buffer.from(image);
  } catch (cause: unknown) {
    options.logger?.debug?.('Capture impossible', {
      url, error: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Capture le site d'un domaine et l'enregistre. Renvoie le chemin dans le bucket, ou null. */
export async function captureAndStore(
  db: Db,
  domain: string,
  options: CaptureOptions = {},
): Promise<string | null> {
  const { data: row } = await db
    .from('domains')
    .select('domain, final_url, status')
    .eq('domain', domain)
    .maybeSingle();
  if (!row) return null;
  // Un site cassé ou injoignable se photographie aussi : l'erreur affichée
  // est le constat. Un domaine exclu par robots.txt, non : on respecte.
  if (row.status === 'excluded') return null;

  const url = row.final_url ?? `https://${domain}`;
  const image = await captureScreenshot(url, options);
  if (!image) return null;

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const path = `${domain}/${stamp}.jpg`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, image, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    options.logger?.warn('Capture non enregistrée', { domain, error: uploadError.message });
    return null;
  }

  await db
    .from('domains')
    .update({ screenshot_path: path, screenshot_at: new Date().toISOString() })
    .eq('domain', domain);

  return path;
}

/** L'URL publique d'une capture, à partir de son chemin. */
export function screenshotUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`;
}
