const assert = require('node:assert/strict');
const test = require('node:test');
const address = require('../property-address');

test('formata CEP e monta endereço estruturado para consulta', () => {
  assert.equal(address.formatCep('18274558'), '18274-558');
  assert.equal(address.query({ cep: '18274-558', rua: 'Rua das Flores', numero: '87', bairro: 'Centro', cidade: 'Tatuí', estado: 'SP' }), 'Rua das Flores, 87, Centro, Tatuí, SP, 18274-558');
  assert.equal(address.display({ cep: '18274558', rua: 'Rua das Flores', numero: '87', bairro: 'Centro', cidade: 'Tatuí', estado: 'SP' }), 'Rua das Flores, nº 87, Centro, Tatuí, SP, CEP 18274-558');
});

test('converte geocodificação reversa em campos de endereço', () => {
  const result = address.fromMapFeature({
    place_type: ['address'],
    text: 'Rua das Flores',
    address: '87',
    context: [
      { id: 'postcode.1', text: '18274-558' },
      { id: 'neighborhood.1', text: 'Centro' },
      { id: 'place.1', text: 'Tatuí' },
      { id: 'region.1', text: 'São Paulo', short_code: 'BR-SP' }
    ]
  });
  assert.deepEqual(result, { cep: '18274-558', rua: 'Rua das Flores', numero: '87', bairro: 'Centro', cidade: 'Tatuí', estado: 'SP' });
});

test('recupera os campos de endereços antigos ao editar anúncio', () => {
  const result = address.fromStored({
    endereco: 'Rua Emílio Moreno, nº 87, Jardim Abreu, Tatuí, SP',
    cep: '18274-558'
  });
  assert.deepEqual(result, { cep: '18274-558', rua: 'Rua Emílio Moreno', numero: '87', bairro: 'Jardim Abreu', cidade: 'Tatuí', estado: 'SP' });
});
