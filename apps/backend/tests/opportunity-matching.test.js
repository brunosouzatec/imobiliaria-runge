const assert = require('node:assert/strict');
const test = require('node:test');
const { scoreOpportunityProperty, scoreOpportunityMatches } = require('../../../packages/shared/opportunity-matching');

const opportunity = {
  tipos_imovel: ['Casa'],
  transacoes: ['Venda'],
  estado: 'SP',
  cidade: 'Tatuí',
  bairros: ['Centro'],
  valor_minimo: 300000,
  valor_maximo: 500000,
  area_total_minima: 100,
  quartos_minimos: 3
};

const property = (id, overrides = {}) => ({
  id,
  categoria: 'Casa',
  transacoes: ['Venda'],
  estado: 'SP',
  cidade: 'Tatui',
  bairro: 'Centro',
  preco_venda: 400000,
  caracteristicas: { area_total: 140, quartos: 3 },
  ...overrides
});

test('compatibilidade exige tipo, localização e transação, comparando texto sem acentos', () => {
  assert.equal(scoreOpportunityProperty(opportunity, property(1)).eligible, true);
  assert.deepEqual(scoreOpportunityProperty(opportunity, property(2, { categoria: 'Apartamento' })), { eligible: false, rejection: 'type' });
  assert.deepEqual(scoreOpportunityProperty(opportunity, property(3, { cidade: 'Iperó' })), { eligible: false, rejection: 'location' });
  assert.deepEqual(scoreOpportunityProperty(opportunity, property(4, { transacoes: ['Aluguel'] })), { eligible: false, rejection: 'transaction' });
});

test('pontuação é explicável, usa apenas requisitos preenchidos e ordena melhores resultados primeiro', () => {
  const result = scoreOpportunityMatches(opportunity, [
    property(2, { bairro: 'Jardim Planalto', preco_venda: 600000, caracteristicas: { area_total: 80, quartos: 2 } }),
    property(1)
  ]);
  assert.equal(result.eligibleCount, 2);
  assert.equal(result.matches[0].id, 1);
  assert.equal(result.matches[0].score, 100);
  assert.ok(result.matches[0].reasons.some(reason => reason.criterio === 'Investimento' && reason.atende));
  assert.ok(result.matches[1].score < result.matches[0].score);
  assert.deepEqual(result.rejected, { location: 0, type: 0, transaction: 0 });
});

test('não inventa pontuação quando a oportunidade não tem critérios opcionais para comparar', () => {
  const minimal = { tipos_imovel: ['Casa'], transacoes: ['Venda'], estado: 'SP', cidade: 'Tatuí' };
  const result = scoreOpportunityProperty(minimal, property(1));
  assert.equal(result.result.score, null);
  assert.equal(result.result.comparedCriteria, 0);
});

test('faixas de valor e área não penalizam critérios que a oportunidade não informou', () => {
  const partial = { ...opportunity, bairros: [], valor_minimo: null, valor_maximo: 500000, area_total_minima: null, area_total_maxima: null, quartos_minimos: null };
  const result = scoreOpportunityProperty(partial, property(1, { preco_venda: 600000 }));
  assert.equal(result.result.score, 83);
  assert.deepEqual(result.result.reasons.map(reason => reason.criterio), ['Tipo', 'Localização', 'Transação', 'Investimento']);
});

test('características textuais são comparadas por termos e os resultados respeitam o limite', () => {
  const requested = { ...opportunity, bairros: [], valor_minimo: null, valor_maximo: null, area_total_minima: null, quartos_minimos: null, caracteristicas: ['piscina', 'área verde'] };
  const items = Array.from({ length: 10 }, (_, id) => property(id + 1, { descricao: 'Casa com piscina e área verde.' }));
  const result = scoreOpportunityMatches(requested, items);
  assert.equal(result.matches.length, 8);
  assert.equal(result.matches[0].score, 100);
  assert.ok(result.matches[0].reasons.some(reason => reason.criterio === 'Características' && reason.detalhe === '2 de 2 identificada(s)'));
});
