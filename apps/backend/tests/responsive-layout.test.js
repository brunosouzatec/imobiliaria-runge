const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicRoot = path.resolve(__dirname, '../../frontend/public');
const reactPages = fs.readFileSync(path.join(publicRoot, 'react-pages.css'), 'utf8');
const react = fs.readFileSync(path.join(publicRoot, 'react.css'), 'utf8');
const cadastro = fs.readFileSync(path.join(publicRoot, 'cadastro.css'), 'utf8');
const admin = fs.readFileSync(path.join(publicRoot, 'admin.css'), 'utf8');

test('layout desktop usa contêineres amplos sem perder limites de leitura', () => {
  assert.match(reactPages, /@media \(min-width: 1101px\)/);
  assert.match(reactPages, /\.react-page \{[^}]*max-width: 1680px/);
  assert.match(reactPages, /\.listing-property-card \{[^}]*height: 320px/);
  assert.match(reactPages, /\.property-detail-layout \{[^}]*grid-template-columns: minmax\(0, 1fr\) 400px/);
  assert.match(reactPages, /\.property-detail-gallery \{ max-width: none; width: 100%; \}/);
  assert.match(cadastro, /@media \(min-width:1101px\) \{ \.form-page \{ max-width:1320px/);
  assert.match(admin, /@media\(min-width:1101px\)\{\.admin-shell\{max-width:1640px/);
});

test('navegação principal continua acessível em telas estreitas', () => {
  assert.match(react, /@media \(max-width:700px\) \{\s*\.react-nav \{ gap:16px; justify-content:flex-start; \}\s*\.react-nav > a:not\(\.react-action\) \{ display:inline-flex !important; \}/);
});
