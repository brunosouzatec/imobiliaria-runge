const assert = require('node:assert/strict');
const test = require('node:test');
const offers = require('../../../packages/shared/property-offers');

test('normalizes multi-select transactions, removing duplicates and invalid values', () => {
  assert.deepEqual(offers.normalizeTypes('["Venda","Aluguel","Venda","Outro"]'), ['Venda', 'Aluguel']);
  assert.deepEqual(offers.normalizeTypes('Venda,Permuta'), ['Venda', 'Permuta']);
  assert.deepEqual(offers.normalizeTypes([], 'Permuta'), ['Permuta']);
});

test('builds a stable display title from property category and selected transactions', () => {
  assert.equal(offers.displayTitle({ categoria: 'Casa', tipos_transacao: ['Permuta', 'Aluguel', 'Venda'] }), 'Casa - Venda/Aluguel/Permuta');
  assert.equal(offers.displayTitle({ categoria: 'Apartamento', tipo: 'Venda' }), 'Apartamento - Venda');
  assert.equal(offers.displayTitle({ categoria: 'Casa', titulo: 'Título antigo' }), 'Título antigo');
  assert.equal(offers.displayTitle({ titulo: 'Título antigo' }), 'Título antigo');
});

test('parses and validates independent sale and rent prices and included utilities', () => {
  const offer = offers.parse({
    tipos_transacao: '["Venda","Aluguel"]', preco_venda: 'R$ 350.000,00', preco_aluguel: 'R$ 2.450,00',
    agua_inclusa: 'true', luz_inclusa: 'false', internet_inclusa: '1', condominio_incluso: '1',
    caracteristicas: '{"condominio":true}'
  });
  assert.deepEqual(offer, { types: ['Venda', 'Aluguel'], type: 'Venda', sale: 350000, rent: 2450, price: 350000, water: true, power: false, internet: true, condoClosed: true, condo: true, condoAmount: null });
  assert.equal(offers.isValid(offer), true);
  assert.equal(offers.describe({ tipos_transacao: offer.types, preco_venda: offer.sale, preco_aluguel: offer.rent }), 'Venda: R$ 350.000,00 · Aluguel: R$ 2.450,00/mês');
});

test('requires a positive price for every selected priced transaction, but not for barter', () => {
  assert.equal(offers.isValid(offers.parse({ tipos_transacao: '["Permuta"]' })), true);
  assert.equal(offers.isValid(offers.parse({ tipos_transacao: '["Venda","Aluguel"]', preco_venda: '500', preco_aluguel: '' })), false);
  assert.equal(offers.isValid(offers.parse({ tipos_transacao: '[]' })), false);
});

test('only exposes condominium inclusion when the closed-condominium feature is selected', () => {
  assert.equal(offers.parse({ tipos_transacao: '["Aluguel"]', preco_aluguel: 1800, condominio_incluso: true }).condo, false);
  assert.equal(offers.parse({ tipos_transacao: '["Aluguel"]', preco_aluguel: 1800, condominio_incluso: true, caracteristicas: { condominio: true } }).condo, true);
});

test('requires and displays a monthly condominium fee when it is not included', () => {
  const missing = offers.parse({ tipos_transacao: '["Aluguel"]', preco_aluguel: 1800, caracteristicas: { condominio: true } });
  assert.equal(missing.condoClosed, true);
  assert.equal(offers.isValid(missing), false);
  const offer = offers.parse({ tipos_transacao: '["Aluguel"]', preco_aluguel: 1800, condominio_valor: 'R$ 420,50', caracteristicas: { condominio: true } });
  assert.equal(offer.condoAmount, 420.5);
  assert.equal(offers.isValid(offer), true);
  assert.match(offers.describe({ tipos_transacao: ['Aluguel'], preco_aluguel: 1800, condominio_valor: 420.5, caracteristicas: { condominio: true } }), /Condomínio: R\$ 420,50\/mês/);
  const included = offers.parse({ tipos_transacao: '["Aluguel"]', preco_aluguel: 1800, condominio_incluso: true, caracteristicas: { condominio: true } });
  assert.equal(offers.isValid(included), true);
});

test('formats monthly rent with the monthly suffix and reports included utilities', () => {
  assert.equal(offers.describe({ tipos_transacao: ['Aluguel'], preco_aluguel: 1800 }), 'Aluguel: R$ 1.800,00/mês');
  assert.deepEqual(offers.summary({ tipos_transacao: ['Aluguel'], preco_aluguel: 1800, agua_inclusa: 1, internet_inclusa: true }).included, ['Água', 'Internet']);
});

test('sorts listings by recency and numeric price without mutating the source list', () => {
  const listings = [
    { id: 3, preco_venda: 280000, preco_aluguel: 1800, tipos_transacao: ['Venda', 'Aluguel'] },
    { id: 1, preco: 95000, tipo: 'Venda' },
    { id: 2, preco_aluguel: 1200, tipo: 'Aluguel' }
  ];
  assert.deepEqual(offers.sort(listings).map(item => item.id), [3, 2, 1]);
  assert.deepEqual(offers.sort(listings, 'antigos').map(item => item.id), [1, 2, 3]);
  assert.deepEqual(offers.sort(listings, 'menor-valor').map(item => item.id), [2, 1, 3]);
  assert.deepEqual(offers.sort(listings, 'maior-valor').map(item => item.id), [3, 1, 2]);
  assert.deepEqual(offers.sort(listings, 'menor-valor', 'Aluguel').map(item => item.id), [2, 3, 1]);
  assert.deepEqual(listings.map(item => item.id), [3, 1, 2]);
});
