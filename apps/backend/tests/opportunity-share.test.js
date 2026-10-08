const assert = require('node:assert/strict');
const test = require('node:test');
const OpportunityShare = require('../../../packages/shared/opportunity-share');

test('gera link público canônico da oportunidade e valida identificador', () => {
  assert.equal(OpportunityShare.urlFor({ id: 27 }, 'https://tatuiimoveis.com.br'), 'https://tatuiimoveis.com.br/oportunidade?id=27');
  assert.equal(OpportunityShare.urlFor({ id: '27x' }, 'https://tatuiimoveis.com.br'), '');
  assert.equal(OpportunityShare.urlFor(null, 'https://tatuiimoveis.com.br'), '');
});

test('compartilha oportunidade com título, contexto e link no compartilhamento nativo', async () => {
  let payload;
  const environment = {
    location: { origin: 'https://tatuiimoveis.com.br' },
    navigator: { share: async value => { payload = value; } }
  };
  assert.equal(await OpportunityShare.share({ id: 8, titulo: 'Casa no Centro' }, environment), 'shared');
  assert.deepEqual(payload, {
    title: 'Casa no Centro',
    text: 'Confira esta oportunidade de compra no Tatuí Imóveis: Casa no Centro',
    url: 'https://tatuiimoveis.com.br/oportunidade?id=8'
  });
});

test('copia o link quando compartilhamento nativo não está disponível', async () => {
  let copied;
  const environment = {
    location: { origin: 'https://tatuiimoveis.com.br' },
    navigator: { clipboard: { writeText: async value => { copied = value; } } }
  };
  assert.equal(await OpportunityShare.share({ id: 14, titulo: 'Terreno' }, environment), 'copied');
  assert.equal(copied, 'https://tatuiimoveis.com.br/oportunidade?id=14');
  assert.equal(OpportunityShare.messageFor('copied'), 'Link copiado.');
});

test('não copia o link quando a pessoa fecha o compartilhamento nativo', async () => {
  let clipboardUsed = false;
  const environment = {
    location: { origin: 'https://tatuiimoveis.com.br' },
    navigator: {
      share: async () => { const error = new Error('Fechado'); error.name = 'AbortError'; throw error; },
      clipboard: { writeText: async () => { clipboardUsed = true; } }
    }
  };
  assert.equal(await OpportunityShare.share({ id: 5 }, environment), 'cancelled');
  assert.equal(clipboardUsed, false);
});
