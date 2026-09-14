const assert = require('node:assert/strict');
const test = require('node:test');
const characteristics = require('../../../packages/shared/property-characteristics');

test('formata atributos cadastrados e omite opções não selecionadas', () => {
  const result = characteristics.list(JSON.stringify({ area: '74', quartos: 2, vagas: 1, piscina: true, suite: false, campo_desconhecido: 'x' }));
  assert.deepEqual(result.map(({ key, label, display, boolean }) => ({ key, label, display, boolean })), [
    { key: 'area', label: 'Área', display: '74 m²', boolean: false },
    { key: 'quartos', label: 'Quartos', display: '2 quartos', boolean: false },
    { key: 'vagas', label: 'Vagas de garagem', display: '1 vaga', boolean: false },
    { key: 'piscina', label: 'Piscina', display: 'Sim', boolean: true }
  ]);
});

test('monta o resumo com área, quartos, banheiros e vagas disponíveis', () => {
  const features = characteristics.list({ area: 74, quartos: 2, banheiros: 1, topografia: 'Plano' });
  assert.deepEqual(characteristics.summary(features).map(feature => feature.key), ['area', 'quartos', 'banheiros']);
  assert.deepEqual(characteristics.list({}), []);
  assert.equal(characteristics.list({ area: 74.5 })[0].display, '74,5 m²');
});

test('interpreta suíte como quantidade e pluraliza corretamente', () => {
  assert.equal(characteristics.list({ suite: 1 })[0].display, '1 suíte');
  assert.equal(characteristics.list({ suite: 2 })[0].display, '2 suítes');
});

test('oferece condomínio fechado em todo tipo exceto Comercial', () => {
  const categories = ['Casa', 'Apartamento', 'Terreno', 'Chácara / Sítio'];
  for (const category of categories) {
    assert.equal(characteristics.withCondoOption(category, [])[0].key, 'condominio');
  }
  assert.deepEqual(characteristics.withCondoOption('Comercial', [{ key: 'area' }, { key: 'condominio' }]), [{ key: 'area' }]);
});
