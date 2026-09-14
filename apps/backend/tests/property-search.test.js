const assert = require('node:assert/strict');
const test = require('node:test');
const search = require('../../../packages/shared/property-search');

const property = {
  titulo: 'Casa ampla e arejada',
  rua: 'Rua Emílio Moreno',
  numero: '87',
  bairro: 'Jardim Manoel de Abreu',
  cidade: 'Tatuí',
  estado: 'SP',
  cep: '18273-037'
};

test('pesquisa por logradouro, número e bairro sem diferenciar acentos ou caixa', () => {
  assert.equal(search.matches(property, 'rua emilio moreno'), true);
  assert.equal(search.matches(property, 'EMÍLIO MORENO 87'), true);
  assert.equal(search.matches(property, 'jardim manoel de abreu'), true);
});

test('pesquisa também por cidade, estado e CEP com ou sem pontuação', () => {
  assert.equal(search.matches(property, 'tatui sp'), true);
  assert.equal(search.matches(property, '18273-037'), true);
  assert.equal(search.matches(property, '18273037'), true);
});

test('preserva busca por título/endereço e trata dados ausentes com segurança', () => {
  assert.equal(search.matches({ endereco: 'Centro, Tatuí' }, 'centro tatui'), true);
  assert.equal(search.matches({}, ''), true);
  assert.equal(search.matches({}, 'bairro inexistente'), false);
});
