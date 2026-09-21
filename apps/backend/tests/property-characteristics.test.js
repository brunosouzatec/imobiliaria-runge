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

test('formata área total e área construída separadamente', () => {
  const features = characteristics.list({ area_total: 300, area_construida: 120 });
  assert.deepEqual(features.map(feature => ({ key: feature.key, label: feature.label, display: feature.display })), [
    { key: 'area_total', label: 'Área total', display: '300 m²' },
    { key: 'area_construida', label: 'Área construída', display: '120 m²' }
  ]);
  assert.deepEqual(characteristics.summary(features).map(feature => feature.key), ['area_total', 'area_construida']);
});

test('inclui suítes no resumo em ordem útil para leitura do card', () => {
  const features = characteristics.list({ vagas: 2, banheiros: 2, suite: 1, quartos: 3, area: 120 });
  assert.deepEqual(characteristics.summary(features).map(feature => feature.key), ['area', 'quartos', 'suite', 'banheiros', 'vagas']);
  assert.deepEqual(characteristics.summary(features).map(feature => feature.display), ['120 m²', '3 quartos', '1 suíte', '2 banheiros', '2 vagas']);
});

test('interpreta suíte como quantidade e pluraliza corretamente', () => {
  assert.equal(characteristics.list({ suite: 1 })[0].display, '1 suíte');
  assert.equal(characteristics.list({ suite: 2 })[0].display, '2 suítes');
});

test('fornece um ícone específico para cada característica exibida', () => {
  const data = {
    area: 80, quartos: 3, banheiros: 2, vagas: 2, suite: 1, quintal: true,
    piscina: true, churrasqueira: true, sacada: true, elevador: true,
    condominio: true, frente: 10, topografia: 'Plano', agua: true,
    energia: true, rua_asfaltada: true, area_verde: true, nascente: true,
    salas: 2, acessibilidade: true, estacionamento: true, ar_condicionado: true
  };
  const features = characteristics.list(data);
  const icons = features.map(feature => characteristics.icon(feature.key));

  assert.ok(icons.every(paths => Array.isArray(paths) && paths.length > 0));
  assert.equal(new Set(icons.map(paths => paths.join('|'))).size, features.length);
  assert.deepEqual(characteristics.icon('unknown'), characteristics.icon('default'));
});

test('oferece condomínio fechado em todo tipo exceto Comercial', () => {
  const categories = ['Casa', 'Apartamento', 'Terreno', 'Chácara / Sítio'];
  for (const category of categories) {
    assert.equal(characteristics.withCondoOption(category, [])[0].key, 'condominio');
  }
  assert.deepEqual(characteristics.withCondoOption('Comercial', [{ key: 'area' }, { key: 'condominio' }]), [{ key: 'area' }]);
});
