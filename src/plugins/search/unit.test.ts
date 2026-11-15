import { expect, test } from 'bun:test';
import { readPrice, withRange } from './price';
import { unitPrice } from './unit';

test('unit prices from Costco titles', () => {
  expect(unitPrice('Kirkland Signature Bath Tissue, 2-Ply, 380 Sheets, 30 Rolls', 24.99)).toEqual(['22¢', '100 sheets']);
  expect(unitPrice('Scott Bath Tissue, 1-Ply, 1100 Sheets, 36 Rolls', 31.49)).toEqual(['8.0¢', '100 sheets']);
  expect(unitPrice('Kleenex Boutique Tissue 2-Ply White 36/95ct', 87.99)).toEqual(['$2.44', 'box']);
  expect(unitPrice('Caboo Bamboo Facial Tissue, 3-Ply, 60 Sheets, 12-count', 24.99)).toEqual(['$3.47', '100 sheets']);
  expect(unitPrice('Marathon Jumbo Roll Bath Tissue, 2-Ply, 900 ft Rolls, 6-count', 27.99)).toEqual(['$4.67', 'each']);
  expect(unitPrice('BirdRock Home Metal Toilet Paper Holder', 20.99)).toBeNull();
});

test('price ranges in the refinement param', () => {
  expect(readPrice('price=(25,50),(50,100)')).toEqual([25, 100]);
  expect(readPrice('rating=(4,5)')).toBeNull();
  expect(withRange('price=(18,40)||rating=(4,5)', 'price', [20, 60])).toBe('rating=(4,5)||price=(20,60)');
  expect(withRange('price=(18,40)', 'price', null)).toBe('');
  expect(withRange('price=(18,40)||rating=(4,5)', 'rating', [2, 5])).toBe('price=(18,40)||rating=(2,5)');
});
