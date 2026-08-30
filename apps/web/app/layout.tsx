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

export const metadata: Metadata = {
  title: {
    default: 'Prospect AI',
    template: '%s · Prospect AI',
  },
  description: 'Chaque jour, les 5 opportunités commerciales qui valent ton temps.',
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
