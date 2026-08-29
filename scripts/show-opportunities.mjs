/**
 * Affiche les opportunités en stock, telles qu'un freelance les recevra.
 *
 *   pnpm show:opportunities [nombre]
 *
 * Sert à juger la qualité des explications sur des entreprises réelles.
 * Une liste d'entreprises ne vaut rien : ce qui se vérifie ici, c'est que
 * chaque ligne dise POURQUOI cette entreprise, et pourquoi maintenant.
 *
 * L'explication est reconstruite à la lecture : ce script montre donc l'état
 * courant du générateur, pas ce qui aurait été figé au moment du scoring.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('='); if (eq === -1) continue;
  const k = t.slice(0, eq).trim(); if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
}
const { presentOpportunities, getServiceClient } = await import('@prospect/core');
const db = getServiceClient();
const wrap = (s, w = 92) => {
  const out = []; let line = '';
  for (const word of s.split(' ')) {
    if ((line + ' ' + word).trim().length > w) { out.push(line.trim()); line = word; }
    else line += ' ' + word;
  }
  if (line.trim()) out.push(line.trim());
  return out.map((l) => '   ' + l).join('\n');
};
const opps = await presentOpportunities(db, { limit: Number(process.argv[2] ?? 5) });
for (const o of opps) {
  const e = o.explanation;
  console.log(`\n${'═'.repeat(96)}`);
  console.log(`${o.company.name}  —  ${o.type}  —  score ${o.baseScore}  (confiance ${(o.confidenceScore*100).toFixed(0)} %)`);
  console.log(`${o.company.city ?? '?'} · ${o.company.phone ?? o.company.contactFormUrl ?? 'sans contact'} · ${o.company.domain ?? 'sans site'}`);
  console.log(`${'─'.repeat(96)}`);
  console.log(' POURQUOI CETTE ENTREPRISE');
  console.log(wrap(e.why));
  if (e.whyNow) { console.log('\n POURQUOI MAINTENANT'); console.log(wrap(e.whyNow)); }
  console.log('\n ANGLE SUGGÉRÉ');
  console.log(wrap(e.angle));
  if (e.signals.length) { console.log('\n CE QUI A ÉTÉ CONSTATÉ');
    for (const s of e.signals) console.log(`   • ${s}`); }
  if (e.caveats.length) { console.log('\n À SAVOIR');
    for (const c of e.caveats) console.log(`   ⚠ ${c}`); }
}
console.log(`\n${'═'.repeat(96)}`);
