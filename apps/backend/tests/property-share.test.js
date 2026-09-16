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

test('anexa a primeira foto quando o compartilhamento nativo aceita arquivos', async () => {
  let shared;
  const result = await PropertyShare.share({ ...property, fotos: [{ url: 'https://cdn.example/fachada.jpg' }] }, {
    location: { origin: 'https://imoveis.example' },
    fetch: async () => ({ ok: true, blob: async () => new Blob(['foto'], { type: 'image/jpeg' }) }),
    File: class TestFile { constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; } },
    navigator: { canShare: ({ files }) => files.length === 1, share: async payload => { shared = payload; } }
  });
  assert.equal(result, 'shared');
  assert.equal(shared.files.length, 1);
  assert.equal(shared.files[0].name, 'imovel-42.jpg');
});

test('abre o fallback quando não há compartilhamento nativo', async () => {
  let opened;
  const result = await PropertyShare.share(property, {
    location: { origin: 'https://imoveis.example' },
    open: (...args) => { opened = args; },
    navigator: {}
  }, { fallbackUrl: 'https://wa.me/5515998134885?text=imovel' });
  assert.equal(result, 'fallback');
  assert.equal(opened[0], 'https://wa.me/5515998134885?text=imovel');
});

test('usa o fallback quando a primeira foto não pode ser anexada', async () => {
  let opened;
  const result = await PropertyShare.share({ ...property, fotos: [{ url: 'https://cdn.example/fachada.jpg' }] }, {
    location: { origin: 'https://imoveis.example' },
    fetch: async () => { throw new Error('CORS'); },
    File: class TestFile {},
    open: (...args) => { opened = args; },
    navigator: { share: async () => { throw new Error('não deveria compartilhar sem foto'); } }
  }, { fallbackUrl: 'https://wa.me/5515998134885?text=imovel', requireFile: true });
  assert.equal(result, 'fallback');
  assert.equal(opened[0], 'https://wa.me/5515998134885?text=imovel');
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
