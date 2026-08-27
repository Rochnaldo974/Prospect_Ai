'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { decidePair, type DecisionState } from './actions';

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        name="decision"
        value="merge"
        disabled={pending}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? '…' : 'Fusionner'}
      </button>
      <button
        type="submit"
        name="decision"
        value="reject"
        disabled={pending}
        className="h-9 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        Entreprises distinctes
      </button>
    </div>
  );
}

export function DecisionForm({ pairId }: { pairId: string }) {
  const [state, formAction] = useActionState<DecisionState, FormData>(decidePair, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="pairId" value={pairId} />
      <Buttons />
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-xs text-success">{state.message}</p> : null}
    </form>
  );
}
