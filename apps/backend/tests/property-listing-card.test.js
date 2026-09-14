const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'apps/frontend/public/react.css'), 'utf8');
const pageStyles = fs.readFileSync(path.join(root, 'apps/frontend/public/react-pages.css'), 'utf8');
const contactStyles = fs.readFileSync(path.join(root, 'apps/frontend/public/property-contact.css'), 'utf8');
const card = app.match(/const PropertyCard = ([\s\S]*?)\nPropertyCard\.methods/);

test('card mostra título conciso, endereço, resumo com ícones e descrição truncada', () => {
  assert.ok(card, 'PropertyCard component exists');
  assert.match(card[1], /PropertyCharacteristics\.summary\(PropertyCharacteristics\.list\(props\.item\?\.caracteristicas\)\)/);
  assert.match(card[1], /v-for="feature in caracteristicasResumo"/);
  assert.match(card[1], /const featureIcon = key => PropertyCharacteristics\.icon\(key\)/);
  assert.match(card[1], /v-for="\(path, index\) in featureIcon\(feature\.key\)"/);
  assert.doesNotMatch(card[1], /PropertyCharacteristics\.icon\(feature\.key\)/);
  assert.match(card[1], /\{\{ feature\.display \}\}/);
  assert.match(card[1], /class="listing-property-description"/);
  assert.doesNotMatch(card[1], /listing-property-type|Publicado no Tatuí Imóveis/);
  assert.match(styles, /\.listing-property-description\s*\{[^}]*-webkit-line-clamp:\s*2/);
});

test('card usa o SVG da marca WhatsApp e preserva os links de contato e detalhes', () => {
  assert.match(card[1], /class="listing-whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true"/);
  assert.match(card[1], /Pedir informações deste imóvel pelo WhatsApp/);
  assert.match(app, /PropertyCard\.methods\.whatsappLink = item => PropertyContact\.listingLink\(item, window\.location\.origin\)/);
  assert.match(card[1], /Ver detalhes →/);
  assert.match(contactStyles, /\.listing-whatsapp-icon\s*\{[^}]*height:\s*18px;[^}]*width:\s*18px/);
});

test('busca da listagem usa o módulo que procura em todos os campos do endereço', () => {
  assert.match(app, /if \(q && !PropertySearch\.matches\(item, q\)\) return false/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/imoveis.html'), 'utf8'), /shared\/property-search\.js/);
});

test('estado vazio reserva a altura de um card para manter o layout estável', () => {
  assert.match(pageStyles, /\.listing-results \.react-property-grid\s*\{[^}]*min-height:\s*300px/);
  assert.match(pageStyles, /\.listing-results \.listing-empty\s*\{[^}]*min-height:\s*300px/);
  assert.match(pageStyles, /@media\s*\(max-width:\s*700px\)[^{]*\{[^}]*\.listing-results \.react-property-grid,\.listing-results \.listing-empty\s*\{min-height:480px\}/);
});

test('página da listagem mantém largura estável em grid independentemente do conteúdo', () => {
  assert.match(pageStyles, /\.react-page\s*\{\s*box-sizing:\s*border-box;\s*width:\s*100%;\s*\}/);
});
