import { notFound } from 'next/navigation';

/**
 * Les sites des entreprises de démonstration.
 *
 * Le jeu de démo anonymise les entreprises — domaines inventés, donc liens
 * morts. Or un dossier qui dit « illisible sur téléphone » avec un lien qui
 * ne charge rien casse la promesse centrale : vérifiable en une minute.
 * Chaque site de démo PRÉSENTE donc réellement le défaut de son dossier :
 * le 503 renvoie un vrai 503, le site « de 2011 » est une page d'époque,
 * le « pas responsive » n'a pas de viewport et une largeur fixe.
 *
 * Servis par l'application elle-même : même origine, donc l'aperçu en
 * iframe du dossier fonctionne aussi. noindex partout — ces pages n'ont
 * rien à faire dans un moteur de recherche.
 */

const page = (title: string, body: string, extraHead = ''): string => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
${extraHead}
</head>
<body>${body}</body>
</html>`;

const SITES: Record<string, () => Promise<Response> | Response> = {
  // ── Le Vieux Pressoir : le site ne répond plus ────────────────────────
  pressoir: () =>
    new Response(
      page('Erreur 503', `
<div style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 12vh auto; text-align: center; color: #333;">
  <h1 style="font-size: 4rem; margin: 0;">503</h1>
  <p style="font-size: 1.1rem;">Service Unavailable</p>
  <p style="color: #888; font-size: .9rem;">The server is temporarily unable to service your request.</p>
</div>`),
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } },
    ),

  // ── Menuiserie Hardouin : construit en 2011, jamais repris ────────────
  hardouin: () =>
    new Response(
      page('Menuiserie Hardouin - Rennes - Bienvenue sur notre site', `
<table width="960" align="center" cellpadding="8" style="font-family: Verdana, sans-serif;">
  <tr><td bgcolor="#8b5a2b" align="center">
    <font color="white" size="6"><b>MENUISERIE HARDOUIN</b></font><br>
    <font color="#f0e0c0" size="2">Artisan menuisier à Rennes depuis 1987</font>
  </td></tr>
  <tr><td bgcolor="#f5efe0">
    <marquee behavior="scroll" scrollamount="3"><font size="2" color="#8b5a2b">
      ★ Bienvenue sur le site de la Menuiserie Hardouin ★ Devis gratuit ★
    </font></marquee>
  </td></tr>
  <tr><td>
    <font face="Verdana" size="2">
    <p><b>Nos prestations :</b> fenêtres bois et PVC, portes, escaliers, agencement sur mesure, parquets.</p>
    <p>N'hésitez pas à nous contacter au 02 99 44 12 03 pour un devis gratuit.</p>
    </font>
  </td></tr>
  <tr><td bgcolor="#8b5a2b" align="center">
    <font color="white" size="1">© 2014 Menuiserie Hardouin - Tous droits réservés - Site réalisé avec jQuery</font>
  </td></tr>
</table>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>`),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } },
    ),

  // ── Atelier Beaumont : largeur fixe, pas de viewport, et il rame ──────
  beaumont: async () => {
    // Le dossier annonce un site lent : il l'est.
    await new Promise((resolve) => setTimeout(resolve, 1800));
    return new Response(
      page('Atelier d’Architecture Beaumont, Lefèvre et Associés', `
<div style="width: 1100px; margin: 0 auto; font-family: Georgia, serif; color: #222;">
  <div style="border-bottom: 3px double #999; padding: 28px 0;">
    <span style="font-size: 30px; letter-spacing: 6px;">BEAUMONT · LEFÈVRE &amp; ASSOCIÉS</span><br>
    <span style="font-size: 13px; color: #777; letter-spacing: 3px;">ARCHITECTURE — URBANISME — PATRIMOINE</span>
  </div>
  <table width="1100" cellpadding="14"><tr>
    <td width="360" valign="top" style="font-size: 14px; line-height: 1.7;">
      L'atelier accompagne depuis 1994 les collectivités et les particuliers dans leurs projets
      de construction et de réhabilitation. Agence à Angers.
    </td>
    <td width="360" valign="top" style="font-size: 14px; line-height: 1.7;">
      <b>Concours 2015</b> — Médiathèque intercommunale, lauréat.<br>
      <b>ZAC des Trois Ponts</b> — étude urbaine, tranche 2.
    </td>
    <td width="360" valign="top" style="font-size: 14px; line-height: 1.7;">
      02 41 77 88 12<br>12 rue du Cornet, 49000 Angers
    </td>
  </tr></table>
</div>`),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } },
    );
  },

  // ── Aux Fleurs de Loire : vitrine correcte, mais rien à acheter ───────
  fleurs: () =>
    new Response(
      page('Aux Fleurs de Loire — Artisan fleuriste', `
<div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #2a3328;">
  <h1 style="font-weight: 600;">Aux Fleurs de Loire</h1>
  <p style="color: #5c6b58;">Artisan fleuriste — bouquets, deuil, mariages.</p>
  <p>Boutique ouverte du mardi au dimanche matin. Nos compositions changent chaque semaine
  selon les arrivages du marché.</p>
  <p style="color: #5c6b58; font-size: .9em;">Pour toute commande, appelez-nous au 02 40 55 12 09 —
  nous ne prenons pas de commande en ligne.</p>
</div>`, '<meta name="viewport" content="width=device-width, initial-scale=1">'),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } },
    ),

  // ── Torréfaction du Ralliement : WordPress d'époque, figé en 2016 ─────
  ralliement: () =>
    new Response(
      page('Torréfaction du Ralliement | Just another WordPress site', `
<div style="max-width: 640px; margin: 0 auto; font-family: 'Open Sans', Arial, sans-serif; color: #444;">
  <div style="background: #3b2a20; color: #fff; padding: 26px; text-align: center;">
    <h1 style="margin: 0; font-weight: 400;">Torréfaction du Ralliement</h1>
    <p style="margin: 6px 0 0; color: #cbb59d; font-size: 13px;">Cafés d'origine torréfiés à Angers</p>
  </div>
  <div style="padding: 20px;">
    <h2 style="font-size: 17px;">Nouveaux arrivages d'Éthiopie</h2>
    <p style="font-size: 13px; color: #999;">Publié le 12 mars 2016 par admin</p>
    <p style="font-size: 14px; line-height: 1.7;">Nous venons de recevoir trois nouveaux lots…</p>
    <p style="font-size: 13px;"><a href="#" style="color: #21759b;">Lire la suite →</a></p>
  </div>
  <div style="border-top: 1px solid #ddd; padding: 14px; text-align: center; font-size: 12px; color: #999;">
    © 2016 — Fièrement propulsé par WordPress
  </div>
</div>
<link rel="stylesheet" href="/wp-content/themes/twentythirteen/style.css">`),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } },
    ),
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const site = SITES[slug];
  if (!site) notFound();
  return site();
}
