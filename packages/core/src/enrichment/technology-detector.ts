import { normalizeTechnology } from '../normalization/technology';
import type { DatedComponent } from './tech-vintage';

/**
 * Les technologies d'un site, avec leur version quand la page la révèle.
 *
 * Deux détecteurs derrière une même interface. Le détecteur rapide est
 * celui qui existait : des motifs sur la source, un nom par technologie.
 * Le détecteur approfondi lit en plus les versions — balise generator,
 * paramètres `?ver=`, chemins versionnés des bibliothèques — et reprend les
 * composants datés. Les deux écrivent la même forme : clé normalisée,
 * version, confiance, origine.
 *
 * Pourquoi pas une bibliothèque externe : les paquets de type Wappalyzer
 * embarquent plusieurs milliers d'empreintes et des règles d'exécution en
 * page (DOM, JavaScript, en-têtes) que le scanner ne charge pas ; leur coût
 * CPU par page et leur maintenance dépassent ce que trente technologies
 * bien lues apportent au produit. On garde un détecteur natif, évaluable
 * ligne par ligne, et on l'étend quand un cas réel le demande.
 */

export interface DetectedTechnology {
  /** Clé normalisée : wordpress, jquery, bootstrap… */
  technology: string;
  version: string | null;
  confidence: number;
  source: 'fast_scan' | 'deep_scan';
}

export interface TechnologyDetector {
  id: string;
  detect(source: string, context: { technologies: string[]; datedComponents: DatedComponent[] }): DetectedTechnology[];
}

/** Ce que les motifs existants ont nommé, sans version. */
export const currentDetector: TechnologyDetector = {
  id: 'current',
  detect(_source, context) {
    const out: DetectedTechnology[] = [];
    for (const name of context.technologies) {
      const key = normalizeTechnology(name);
      if (key) out.push({ technology: key, version: null, confidence: 0.8, source: 'fast_scan' });
    }
    return out;
  },
};

const GENERATOR = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']{1,80})["']/gi;
const GENERATOR_REVERSED = /<meta[^>]+content=["']([^"']{1,80})["'][^>]+name=["']generator["']/gi;
/** Une version lisible : 6.4, 3.6.0, 1.7.8.5. */
const VERSION = /(\d+\.\d+(?:\.\d+){0,2})/;

/** Bibliothèques dont le chemin porte la version : jquery-3.6.0.min.js, /bootstrap/4.6.2/… */
const VERSIONED_PATHS: { key: string; pattern: RegExp }[] = [
  { key: 'jquery', pattern: /jquery[-/.](\d+\.\d+(?:\.\d+)?)(?:[/.]|min)/i },
  { key: 'jquery', pattern: /jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i },
  { key: 'bootstrap', pattern: /bootstrap[-/@](\d+\.\d+(?:\.\d+)?)[/.]/i },
  { key: 'fontawesome', pattern: /font-?awesome[-/@](\d+\.\d+(?:\.\d+)?)[/.]/i },
  { key: 'react', pattern: /react(?:-dom)?[-@/](\d+\.\d+(?:\.\d+)?)[/.]/i },
  { key: 'vue', pattern: /vue(?:\.min|\.runtime)?[-@/](\d+\.\d+(?:\.\d+)?)[/.]/i },
  { key: 'elementor', pattern: /elementor\/assets\/[^"']*\?ver=(\d+\.\d+(?:\.\d+)?)/i },
  { key: 'woocommerce', pattern: /woocommerce\/assets\/[^"']*\?ver=(\d+\.\d+(?:\.\d+)?)/i },
];

/** Le cœur : les fichiers wp-includes portent la version de WordPress. */
const WORDPRESS_CORE = /\/wp-includes\/[^"'\s>]*\?ver=(\d+\.\d+(?:\.\d+)?)/i;

/** Versions lues dans la page, en plus des noms. */
export const deepDetector: TechnologyDetector = {
  id: 'deep',
  detect(source, context) {
    const found = new Map<string, DetectedTechnology>();
    const keep = (key: string | null, version: string | null, confidence: number) => {
      if (!key) return;
      const current = found.get(key);
      if (!current || (version && !current.version) || confidence > current.confidence) {
        found.set(key, { technology: key, version: version ?? current?.version ?? null, confidence: Math.max(confidence, current?.confidence ?? 0), source: 'deep_scan' });
      }
    };

    for (const re of [GENERATOR, GENERATOR_REVERSED]) {
      for (const m of source.matchAll(re)) {
        const content = m[1] ?? '';
        const at = content.search(VERSION);
        // « Divi v4.18.0 », « WordPress 6.4 », « PrestaShop » : le nom est ce
        // qui précède la version, sans le « v » qui l'annonce.
        const name = (at >= 0 ? content.slice(0, at) : content).replace(/\bv\.?\s*$/i, '').replace(/[-–—]/g, ' ').trim();
        const version = content.match(VERSION)?.[1] ?? null;
        keep(normalizeTechnology(name.split(/\s+/).slice(0, 2).join(' ')), version, 0.95);
      }
    }
    const core = source.match(WORDPRESS_CORE);
    if (core) keep('wordpress', core[1] ?? null, 0.95);
    for (const { key, pattern } of VERSIONED_PATHS) {
      const m = source.match(pattern);
      if (m) keep(key, m[1] ?? null, 0.9);
    }
    for (const component of context.datedComponents) {
      keep(normalizeTechnology(component.name), component.version, 0.9);
    }
    return [...found.values()];
  },
};

export const TECHNOLOGY_DETECTORS: TechnologyDetector[] = [currentDetector, deepDetector];

/** Les deux détecteurs fusionnés : la version et la meilleure confiance l'emportent. */
export function detectTechnologies(
  source: string,
  context: { technologies: string[]; datedComponents: DatedComponent[] },
  detectors: TechnologyDetector[] = TECHNOLOGY_DETECTORS,
): DetectedTechnology[] {
  const merged = new Map<string, DetectedTechnology>();
  for (const detector of detectors) {
    for (const tech of detector.detect(source, context)) {
      const current = merged.get(tech.technology);
      if (!current) { merged.set(tech.technology, tech); continue; }
      merged.set(tech.technology, {
        technology: tech.technology,
        version: tech.version ?? current.version,
        confidence: Math.max(tech.confidence, current.confidence),
        source: tech.version && !current.version ? tech.source : current.source,
      });
    }
  }
  return [...merged.values()].sort((a, b) => a.technology.localeCompare(b.technology));
}
