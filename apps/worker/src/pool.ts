/**
 * Exécution concurrente bornée.
 *
 * On ne veut ni un `Promise.all` sur tout un lot (pic de connexions, pic de
 * requêtes sortantes), ni un traitement séquentiel qui gaspille l'attente I/O.
 */
export class TaskPool {
  readonly #limit: number;
  readonly #running = new Set<Promise<void>>();

  constructor(limit: number) {
    if (limit < 1) throw new Error('La concurrence doit être au moins de 1');
    this.#limit = limit;
  }

  get inFlight(): number {
    return this.#running.size;
  }

  get available(): number {
    return this.#limit - this.#running.size;
  }

  /** Lance une tâche, en attendant qu'une place se libère si nécessaire. */
  async spawn(task: () => Promise<void>): Promise<void> {
    while (this.available <= 0) {
      await Promise.race(this.#running);
    }

    const promise = task().finally(() => {
      this.#running.delete(promise);
    });
    this.#running.add(promise);
  }

  /** Attend la fin de toutes les tâches en cours. */
  async drain(): Promise<void> {
    while (this.#running.size > 0) {
      await Promise.race(this.#running);
    }
  }
}
