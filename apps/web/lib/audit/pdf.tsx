import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { AuditSnapshot } from '@prospect/core';

/**
 * L'audit en PDF : le même contenu que la page en ligne, dans un fichier
 * qu'on joint, qu'on télécharge, qu'on imprime.
 *
 * Le fichier parle au nom du freelance, pas au nôtre : son nom en tête,
 * ses coordonnées en pied. La capture, la note, les constats numérotés,
 * la proposition. Rien de plus que ce que la page montre — c'est le même
 * instantané, figé au moment où l'audit a été préparé.
 */
const ink = '#0b0d14';
const ink2 = '#5b6274';
const line = '#e7e9f2';
const brand = '#2c4bff';
const wash = '#eef1ff';
const mist = '#f6f7fb';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 118, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10.5, lineHeight: 1.5, color: ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: line, paddingBottom: 14 },
  author: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  muted: { color: ink2 },
  small: { fontSize: 9, color: ink2 },
  eyebrow: { fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase', color: ink2, fontFamily: 'Helvetica-Bold' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 6, lineHeight: 1.25 },
  shot: { marginTop: 16, borderWidth: 1, borderColor: line, borderRadius: 8, overflow: 'hidden' },
  shotImg: { width: '100%', height: 220, objectFit: 'cover', objectPosition: 'top' },
  caption: { fontSize: 8.5, color: ink2, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: line },
  cols: { flexDirection: 'row', gap: 18, marginTop: 18 },
  scoreBox: { width: 190, borderWidth: 1, borderColor: line, borderRadius: 8, padding: 12 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  score: { fontSize: 24, fontFamily: 'Helvetica-Bold' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  barLabel: { width: 62, fontSize: 8.5, color: ink2 },
  barTrack: { flex: 1, height: 5, backgroundColor: mist, borderRadius: 3 },
  barFill: { height: 5, borderRadius: 3 },
  barValue: { width: 20, textAlign: 'right', fontSize: 8.5 },
  finding: { flexDirection: 'row', gap: 8, marginTop: 7 },
  num: { width: 16, height: 16, borderRadius: 8, backgroundColor: mist, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { fontSize: 8, lineHeight: 1, color: ink2 },
  proposal: { marginTop: 18, backgroundColor: wash, borderRadius: 8, padding: 12 },
  proposalText: { color: brand, marginTop: 4 },
  footer: { position: 'absolute', left: 44, right: 44, bottom: 22, borderTopWidth: 1, borderTopColor: line, paddingTop: 10 },
  contact: { flexDirection: 'row', gap: 14, marginTop: 4, fontSize: 9.5, color: brand },
});

const tone = (v: number) => (v < 40 ? '#c0392b' : v < 70 ? '#b7791f' : brand);

function AuditDocument({ snapshot }: { snapshot: AuditSnapshot }) {
  const measured = snapshot.measuredAt
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(snapshot.measuredAt))
    : null;
  const bars = snapshot.scores
    ? [['Vitesse', snapshot.scores.speed], ['Sur téléphone', snapshot.scores.mobile], ['Référencement', snapshot.scores.seo], ['Confiance', snapshot.scores.trust]] as const
    : [];
  const a = snapshot.author;

  return (
    <Document title={`Audit — ${snapshot.company.name}`} author={a.name} language="fr">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- image de PDF, pas de DOM */}
            {a.logoUrl ? <Image src={a.logoUrl} style={{ width: 34, height: 34, objectFit: 'contain' }} /> : null}
            <View>
              <Text style={s.author}>{a.name}</Text>
              <Text style={s.small}>{[a.title, a.company].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <Text style={s.small}>Audit préparé pour {snapshot.company.name}</Text>
        </View>

        {snapshot.google ? (
          <View style={{ marginTop: 14, backgroundColor: mist, borderRadius: 8, padding: 10 }}>
            <Text>
              Vos clients vous notent <Text style={{ fontFamily: 'Helvetica-Bold' }}>{snapshot.google.rating.toFixed(1).replace('.', ',')} sur 5</Text> sur Google, sur {snapshot.google.reviewCount} avis. Votre site est la première chose qu’ils voient ensuite.
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <Text style={s.eyebrow}>Ce que votre site montre à vos clients</Text>
          <Text style={s.h1}>{snapshot.headline}</Text>
          {snapshot.company.websiteUrl ? <Text style={s.small}>{snapshot.company.websiteUrl.replace(/^https?:\/\//, '')}</Text> : null}
        </View>

        {snapshot.screenshotUrl ? (
          <View style={s.shot} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- image de PDF, pas de DOM */}
            <Image src={snapshot.screenshotUrl} style={s.shotImg} />
            {measured ? <Text style={s.caption}>Votre site tel qu’il s’affiche le {measured}, sur un ordinateur.</Text> : null}
          </View>
        ) : null}

        <View style={s.cols}>
          {snapshot.score !== null ? (
            <View style={s.scoreBox} wrap={false}>
              <View style={s.scoreRow}>
                <Text style={s.eyebrow}>Note globale</Text>
                <Text style={[s.score, { color: tone(snapshot.score) }]}>{snapshot.score}<Text style={{ fontSize: 9, color: ink2 }}>/100</Text></Text>
              </View>
              {bars.map(([label, value]) => (
                <View key={label} style={s.bar}>
                  <Text style={s.barLabel}>{label}</Text>
                  <View style={s.barTrack}><View style={[s.barFill, { width: `${value}%`, backgroundColor: tone(value) }]} /></View>
                  <Text style={s.barValue}>{value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Ce que nous avons constaté</Text>
            {snapshot.findings.map((finding, index) => (
              <View key={finding} style={s.finding} wrap={false}>
                <View style={s.num}><Text style={s.numText}>{index + 1}</Text></View>
                <Text style={{ flex: 1 }}>{finding}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.proposal} wrap={false}>
          <Text style={[s.eyebrow, { color: brand }]}>Ce que je vous propose</Text>
          <Text style={s.proposalText}>{snapshot.proposal}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{a.name}</Text>
          <Text style={s.small}>{[a.title, a.company].filter(Boolean).join(' · ')}</Text>
          <View style={s.contact}>
            {a.phone ? <Text>{a.phone}</Text> : null}
            {a.email ? <Text>{a.email}</Text> : null}
            {a.website ? <Text>{a.website.replace(/^https?:\/\//, '')}</Text> : null}
          </View>
          <Text style={{ fontSize: 7.5, color: '#8a90a3', marginTop: 6 }}>
            Les constats sont des mesures faites en ouvrant votre site comme le ferait un visiteur ; vous pouvez les vérifier vous-même. Rien dans cet audit ne présume de vos intentions.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Le PDF, en mémoire : à joindre à un e-mail ou à rendre en téléchargement. */
export async function renderAuditPdf(snapshot: AuditSnapshot): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<AuditDocument snapshot={snapshot} />));
}

/** « Audit - Boulangerie Martin.pdf » : lisible dans une boîte de réception. */
export function auditFilename(companyName: string): string {
  const safe = companyName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().slice(0, 60);
  return `Audit - ${safe || 'site'}.pdf`;
}
