import type { Metadata } from 'next';
import { Familjen_Grotesk, IBM_Plex_Mono, Newsreader } from 'next/font/google';
import './globals.css';

/**
 * Trois voix, trois rôles.
 *
 *   Familjen Grotesk  l'interface. Grotesque serrée, terminaisons un peu
 *                     particulières : de la personnalité sans bavardage.
 *   Newsreader        ce que le moteur explique. Un serif de lecture, parce
 *                     qu'on lit un argument et qu'on ne le survole pas.
 *   IBM Plex Mono     les preuves. Dates, codes HTTP, SIREN, versions — tout
 *                     ce qui se vérifie caractère par caractère.
 */
const sans = Familjen_Grotesk({
  subsets: ['latin'],
  variable: '--font-familjen',
  display: 'swap',
});

const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  style: ['normal', 'italic'],
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
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
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
