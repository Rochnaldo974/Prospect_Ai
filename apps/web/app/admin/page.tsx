import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
        <p className="text-sm text-muted-foreground">
          Les compteurs du moteur apparaîtront ici à partir de la phase 2.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 0 — fondations</CardTitle>
          <CardDescription>
            Monorepo, base de données, authentification et contrôle d&apos;accès admin en place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Prochaine étape : le schéma métier complet (phase 1), puis cette console
            d&apos;administration des entreprises (phase 2).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
