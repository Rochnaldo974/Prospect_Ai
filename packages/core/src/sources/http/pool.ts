/**
 * Petit pool de travail pour les appels réseau.
 *
 * Les services publics interrogés (répertoire, Base Adresse) répondent en
 * quelques centaines de millisecondes : les appeler un par un revient à payer
 * cette latence à chaque fois, et une nuit n'y suffit plus dès quelques
 * milliers d'entreprises. Le débit reste borné par le limiteur du client
 * HTTP ; la concurrence ne fait que remplir les temps morts.
 */
/** Exécute `work` sur chaque élément, au plus `width` à la fois, dans l'ordre d'arrivée. */
export async function runPool<T>(
  items: T[],
  width: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, width) }, async () => {
    while (next < items.length) {
      const item = items[next]!;
      next += 1;
      await work(item);
    }
  });
  await Promise.all(workers);
}

