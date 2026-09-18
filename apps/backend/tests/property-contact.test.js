const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const contact = require('../../../packages/shared/property-contact');
const projectRoot = path.resolve(__dirname, '../../..');

const property = {
  id: 42,
  titulo: 'Casa - Venda',
  endereco: 'Rua das Flores, 87, Centro, Tatuí - SP'
};

test('listing WhatsApp link targets the configured number and includes the absolute property URL', () => {
  const link = new URL(contact.listingLink(property, 'https://imoveis.example'));
  const message = link.searchParams.get('text');

  assert.equal(link.origin, 'https://wa.me');
  assert.equal(link.pathname, '/5515998134885');
  assert.match(message, /Casa - Venda/);
  assert.match(message, /Rua das Flores, 87/);
  assert.match(message, /https:\/\/imoveis\.example\/imovel\.html\?id=42/);
});

test('property contact form adds submitted contact fields to a reviewable WhatsApp message', () => {
  const link = new URL(contact.formLink(property, {
    nome: 'Ana Souza',
    telefone: '(15) 98888-7777',
    email: 'ana@example.com'
  }, 'http://localhost:3000'));
  const message = link.searchParams.get('text');

  assert.equal(link.pathname, '/5515998134885');
  assert.match(message, /Nome: Ana Souza/);
  assert.match(message, /Telefone: \(15\) 98888-7777/);
  assert.match(message, /E-mail: ana@example\.com/);
  assert.match(message, /http:\/\/localhost:3000\/imovel\.html\?id=42/);
});

test('form contact link omits empty personal fields and safely encodes text', () => {
  const link = new URL(contact.formLink({ ...property, titulo: 'Casa & jardim' }, { nome: '  ' }, 'https://imoveis.example'));
  const message = link.searchParams.get('text');

  assert.match(message, /Casa & jardim/);
  assert.doesNotMatch(message, /Nome:/);
  assert.equal(link.searchParams.has('text'), true);
});

test('mensagem do WhatsApp inclui link da primeira foto quando disponível', () => {
  const link = new URL(contact.listingLink({ ...property, fotos: [{ url: 'https://cdn.example/fachada.jpg' }] }, 'https://imoveis.example'));
  assert.match(link.searchParams.get('text'), /Foto principal: https:\/\/cdn\.example\/fachada\.jpg/);
});

test('listing keeps direct WhatsApp sharing and detail contact requires consent before WhatsApp', () => {
  const app = fs.readFileSync(path.join(projectRoot, 'apps/frontend/public/vue-app.js'), 'utf8');

  assert.match(app, /listing-whatsapp-link/);
  assert.match(app, /PropertyContact\.listingLink\(item, window\.location\.origin\)/);
  assert.match(app, /PropertyContact\.formLink\(item\.value, contactData, window\.location\.origin\)/);
  assert.match(app, /\/api\/imoveis\/\$\{item\.value\.id\}\/contatos/);
  assert.match(app, /name="aceite_privacidade" value="true" type="checkbox" required/);
});
