const assert = require('node:assert/strict');
const test = require('node:test');
const PropertyShare = require('../../../packages/shared/property-share');

const property = { id: 42, titulo: 'Casa - Venda', endereco: 'Rua das Flores, 87, Centro, Tatuí - SP' };

test('compartilhamento cria link absoluto direto para o imóvel', () => {
  assert.equal(PropertyShare.urlFor(property, 'https://imoveis.example'), 'https://imoveis.example/imovel.html?id=42');
  assert.equal(PropertyShare.urlFor({}, 'https://imoveis.example'), '');
});

test('usa compartilhamento nativo com título, endereço e URL direta', async () => {
  let shared;
  const result = await PropertyShare.share(property, {
    location: { origin: 'https://imoveis.example' },
    navigator: { share: async payload => { shared = payload; } }
  });
  assert.equal(result, 'shared');
  assert.equal(shared.title, property.titulo);
  assert.match(shared.text, /Rua das Flores, 87/);
  assert.equal(shared.url, 'https://imoveis.example/imovel.html?id=42');
});

test('copia o link quando compartilhamento nativo não está disponível', async () => {
  let copied;
  const result = await PropertyShare.share(property, {
    location: { origin: 'https://imoveis.example' },
    navigator: { clipboard: { writeText: async value => { copied = value; } } }
  });
  assert.equal(result, 'copied');
  assert.equal(copied, 'https://imoveis.example/imovel.html?id=42');
});

test('não copia link quando usuário fecha a janela de compartilhamento nativo', async () => {
  let copied = false;
  const result = await PropertyShare.share(property, {
    location: { origin: 'https://imoveis.example' },
    navigator: {
      share: async () => { const error = new Error('cancelado'); error.name = 'AbortError'; throw error; },
      clipboard: { writeText: async () => { copied = true; } }
    }
  });
  assert.equal(result, 'cancelled');
  assert.equal(copied, false);
});
