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
  assert.match(app, /descricaoResumo: computed\(\(\) => PropertyDescription\.resumo\(props\.item\?\.descricao\)/);
  assert.match(app, /PropertyCard\.template = PropertyCard\.template\.replace\("\{\{ item\.descricao \|\| 'Confira todos os detalhes deste imóvel\.' \}\}", '\{\{ descricaoResumo \}\}'\)/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/imoveis.html'), 'utf8'), /shared\/property-description\.js/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/meus-imoveis.html'), 'utf8'), /shared\/property-description\.js/);
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

test('listagem e detalhes oferecem compartilhar com estado acessível', () => {
  assert.match(app, /class="listing-share-button"[^>]*@click="compartilhar"/);
  assert.match(app, /property-share-detail-button[^>]*@click="compartilhar"/);
  assert.match(app, /class="property-share-status" role="status" aria-live="polite"/);
  assert.match(app, /PropertyShare\.share\(props\.item\)/);
  assert.match(app, /PropertyShare\.share\(item\.value\)/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/imoveis.html'), 'utf8'), /shared\/property-share\.js/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/imovel.html'), 'utf8'), /shared\/property-share\.js/);
});

test('busca da listagem usa o módulo que procura em todos os campos do endereço', () => {
  assert.match(app, /if \(q && !PropertySearch\.matches\(item, q\)\) return false/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/imoveis.html'), 'utf8'), /shared\/property-search\.js/);
});

test('listagem oferece ordenação por recência e preço, aplicada aos resultados filtrados', () => {
  assert.match(app, /PropertyOffers\.sort\(filtered\.value, sortOrder\.value, state\.filters\.value\.tipo\)/);
  assert.match(app, /value="menor-valor">Menor valor/);
  assert.match(app, /value="maior-valor">Maior valor/);
  assert.match(app, /value="antigos">Mais antigos/);
  assert.match(app, /v-for="item in ordered"/);
});

test('filtros avançados acompanham as características cadastráveis por categoria', () => {
  assert.match(app, /Casa: \{ dimensions: \['quartos', 'banheiros', 'vagas'\], features: \[\['piscina', 'Piscina'\]/);
  assert.match(app, /Terreno: \{ dimensions: \[\], features: \[\['agua', 'Água encanada'\]/);
  assert.match(app, /Comercial: \{ dimensions: \['banheiros', 'vagas', 'salas'\]/);
  assert.match(app, /PropertyCharacteristics\.list\(item\.caracteristicas\)/);
  assert.match(app, /PropertyOffers\.isChecked\(features\[key\]\)/);
  assert.match(app, /Área mínima \(m²\)/);
  assert.match(app, /Aplicar filtros/);
  assert.match(app, /filters\.tipo === \\'Aluguel\\' \? \\'Até R\$ 2\.500\/mês\\'/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/react.css'), 'utf8'), /\.listing-filter-panel\[open\]>summary::after/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/react.css'), 'utf8'), /\.listing-filters \.listing-feature-filter\s*\{[^}]*display:flex/);
  assert.match(app, /listing-feature-filter-select.*is-selected/);
});

test('estado vazio reserva a altura de um card para manter o layout estável', () => {
  assert.match(pageStyles, /\.listing-results \.react-property-grid\s*\{[^}]*min-height:\s*300px/);
  assert.match(pageStyles, /\.listing-results \.listing-empty\s*\{[^}]*min-height:\s*300px/);
  assert.match(pageStyles, /@media\s*\(max-width:\s*700px\)[^{]*\{[^}]*\.listing-results \.react-property-grid,\.listing-results \.listing-empty\s*\{min-height:480px\}/);
});

test('página da listagem mantém largura estável em grid independentemente do conteúdo', () => {
  assert.match(pageStyles, /\.react-page\s*\{\s*box-sizing:\s*border-box;\s*width:\s*100%;\s*\}/);
});
