import { describe, expect, it } from 'vitest';
import { describeAvailability } from '../../packages/core/src/allocation/availability';

/**
 * Ce que l'écran de paramétrage annonce comme stock.
 *
 * Cocher une famille vide, c'est réserver une des cinq places de sa journée à
 * du néant. Mais annoncer « 47 opportunités » donnerait une fausse précision :
 * le stock aura changé demain matin, et l'exclusivité fait qu'une opportunité
 * prise ne revient pas.
 */

describe('comment le stock est annoncé', () => {
  it('dit franchement qu’il n’y a rien', () => {
    // Un « 0 » brut ferait croire à une panne. C'est une information utile.
    const { label, tone } = describeAvailability(0);
    expect(tone).toBe('none');
    expect(label).toMatch(/rien en stock/);
  });

  it('donne le compte exact quand il est faible', () => {
    // Sous la dizaine, le chiffre exact aide vraiment à décider.
    expect(describeAvailability(1).label).toBe('1 opportunité en stock');
    expect(describeAvailability(7).label).toBe('7 opportunités en stock');
    expect(describeAvailability(7).tone).toBe('thin');
  });

  it('arrondit dès que la précision n’aide plus', () => {
    expect(describeAvailability(47).label).toBe('plus de 40 opportunités en stock');
    expect(describeAvailability(340).label).toBe('plus de 300 opportunités en stock');
  });

  it('n’annonce jamais plus que ce qu’il y a', () => {
    // L'arrondi doit toujours minorer : promettre 50 quand il y en a 47 serait
    // une promesse que le stock ne tiendra pas.
    for (const count of [10, 11, 49, 99, 100, 149, 999]) {
      const digits = Number(/\d+/.exec(describeAvailability(count).label)?.[0]);
      expect(digits).toBeLessThanOrEqual(count);
    }
  });

  it('bascule au vert seulement quand le stock tient', () => {
    expect(describeAvailability(9).tone).toBe('thin');
    expect(describeAvailability(10).tone).toBe('healthy');
  });
});
