import type { Metadata } from 'next';
import { measureControlGroup } from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import { Section } from '@/components/admin/primitives';

export const metadata: Metadata = { title: 'Mesure du moteur' };

/**
 * Le moteur vaut-il mieux qu'un tirage au hasard ?
 *
 * Une opportunité sur cinq est tirée au hasard parmi les candidates éligibles,
 * et le freelance ne peut pas la distinguer des autres. Comparer ce qu'elles
 * donnent est la seule réponse honnête à cette question — tout le reste est
 * une intuition sur des chiffres qu'on a soi-même produits.
 *
 * Cette page affiche le verdict avant les nombres. Sur un échantillon
 * insuffisant, elle le dit et n'affiche aucun écart : un pourcentage a
 * l'apparence d'un résultat même quand il n'en est pas un, et on prendrait des
 * décisions produit sur du bruit.
 */
export default async function MesurePage() {
  const db = await getAdminDb();
  const report = await measureControlGroup(db);

  const lisible = report.lift !== null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mesure du moteur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une opportunité sur cinq est tirée au hasard. Ce qu&apos;elle donne, comparé aux
          quatre autres, dit si le moteur apporte quelque chose.
        </p>
      </div>

      <div
        className={`rounded-lg border p-5 ${
          lisible ? 'bg-card' : 'border-dashed bg-muted/30'
        }`}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Verdict
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{report.verdict}</p>

        {lisible ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {report.lift! > 0 ? '+' : ''}{report.lift} points de suites données,
            moteur comparé au hasard.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Il faut {report.minimumPerGroup} attributions closes dans chaque groupe avant de
            pouvoir dire quoi que ce soit. Actuellement {report.engine.completed} pour le moteur
            et {report.control.completed} pour le contrôle. Un écart mesuré en deçà
            s&apos;expliquerait entièrement par le hasard.
          </p>
        )}
      </div>

      <Section title="Détail par groupe" count={report.engine.completed + report.control.completed}>
        <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Groupe</th>
              <th className="py-2 text-right">Closes</th>
              <th className="py-2 text-right">Contactées</th>
              <th className="py-2 text-right">Suites</th>
              <th className="py-2 text-right">Clients</th>
              <th className="py-2 text-right">Taux de suite</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Choisies par le moteur" result={report.engine} />
            <Row label="Tirées au hasard" result={report.control} />
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Row({
  label,
  result,
}: {
  label: string;
  result: Awaited<ReturnType<typeof measureControlGroup>>['engine'];
}) {
  return (
    <tr className="border-t">
      <td className="py-2 font-medium">{label}</td>
      <td className="py-2 text-right tabular-nums">{result.completed}</td>
      <td className="py-2 text-right tabular-nums">{result.contacted}</td>
      <td className="py-2 text-right tabular-nums">{result.positive}</td>
      <td className="py-2 text-right tabular-nums">{result.clients}</td>
      <td className="py-2 text-right tabular-nums">
        {result.positiveRate === null ? '—' : `${result.positiveRate} %`}
      </td>
    </tr>
  );
}
