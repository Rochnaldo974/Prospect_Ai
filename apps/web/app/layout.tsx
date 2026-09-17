import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * Deux polices, deux rôles.
 *
 *   Instrument Sans  l'interface. Grotesque contemporaine, resserrée, sans
 *                    maniérisme : elle ne cherche pas à se faire remarquer.
 *   JetBrains Mono   les preuves. Versions, dates, codes HTTP, SIREN — tout
 *                    ce qui se vérifie caractère par caractère, dans la
 *                    police que la cible a ouverte dans son éditeur.
 */
const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://127.0.0.1:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Prospect AI',
    template: '%s · Prospect AI',
  },
  description: 'Chaque matin, cinq entreprises à prospecter, vérifiées la nuit, réservées pour vous 72 h.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Prospect AI',
    title: 'Prospect AI — la prospection des freelances du web',
    description: 'Chaque matin, cinq entreprises à prospecter, vérifiées la nuit, réservées pour vous 72 h.',
  },
  twitter: { card: 'summary' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
