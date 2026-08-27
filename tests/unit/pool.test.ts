import { describe, expect, it } from 'vitest';
import { TaskPool } from '../../apps/worker/src/pool';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('TaskPool', () => {
  it('refuse une concurrence nulle ou négative', () => {
    expect(() => new TaskPool(0)).toThrow(/au moins de 1/);
  });

  it('ne dépasse jamais la limite de tâches simultanées', async () => {
    const pool = new TaskPool(3);
    let running = 0;
    let peak = 0;

    const tasks = Array.from({ length: 20 }, () => async () => {
      running += 1;
      peak = Math.max(peak, running);
      await tick();
      running -= 1;
    });

    for (const task of tasks) await pool.spawn(task);
    await pool.drain();

    expect(peak).toBe(3);
    expect(running).toBe(0);
  });

  it('exécute bien toutes les tâches', async () => {
    const pool = new TaskPool(4);
    const done: number[] = [];

    for (let i = 0; i < 12; i += 1) {
      await pool.spawn(async () => {
        await tick();
        done.push(i);
      });
    }
    await pool.drain();

    expect(done).toHaveLength(12);
    expect([...done].sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
  });

  it('libère la place même quand une tâche échoue', async () => {
    const pool = new TaskPool(2);
    const failing = async () => {
      await tick();
      throw new Error('échec attendu');
    };

    // spawn ne doit pas rejeter : c'est l'appelant qui décide quoi faire
    // des erreurs, la place doit être rendue dans tous les cas.
    await pool.spawn(() => failing().catch(() => undefined));
    await pool.spawn(() => failing().catch(() => undefined));
    await pool.spawn(() => failing().catch(() => undefined));
    await pool.drain();

    expect(pool.inFlight).toBe(0);
    expect(pool.available).toBe(2);
  });

  it('rend compte des places disponibles', async () => {
    const pool = new TaskPool(2);
    expect(pool.available).toBe(2);

    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    await pool.spawn(() => blocked);
    expect(pool.inFlight).toBe(1);
    expect(pool.available).toBe(1);

    release();
    await pool.drain();
    expect(pool.available).toBe(2);
  });
});
