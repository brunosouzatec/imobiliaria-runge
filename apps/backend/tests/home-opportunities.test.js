const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..', '..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'apps/frontend/public/home-opportunities.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'apps/frontend/public/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'apps/frontend/public/react.css'), 'utf8');

test('home shows up to three current public purchase opportunities in a dedicated responsive section', () => {
  assert.match(server, /url\.pathname === '\/api\/oportunidades' && req\.method === 'GET'/);
  assert.match(server, /const limit = Number\.isFinite\(requestedLimit\).*Math\.min\(Math\.max\(requestedLimit, 1\), 100\)/);
  assert.match(server, /WHERE \$\{filters\.join\(' AND '\)\} ORDER BY publicada_em DESC, id DESC LIMIT \$\{limit\}/);
  assert.match(home, /fetch\('\/api\/oportunidades\?limit=3'\)/);
  assert.match(home, /items\.slice\(0, 3\)/);
  assert.match(home, /OpportunityShare\?\.share\(item\)/);
  assert.match(index, /\/shared\/opportunity-share\.js/);
  assert.match(home, /home-opportunities-section/);
  assert.match(home, /\.site-footer, \.home-footer/);
  assert.match(fs.readFileSync(path.join(root, 'apps/frontend/public/home-highlights.js'), 'utf8'), /\.site-footer, \.home-footer/);
  assert.match(index, /home-opportunities\.js/);
  assert.match(styles, /\.home-opportunities-grid \{[^}]*gap:20px; grid-auto-rows:1fr; grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.home-highlights-grid \{ display:grid; gap:20px; grid-auto-rows:1fr; grid-template-columns:repeat\(4,minmax\(0,1fr\)\); \}/);
  assert.match(styles, /@media\(max-width:1100px\)[\s\S]*\.home-opportunities-grid \{ gap:20px; grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.doesNotMatch(styles, /home-opportunities-grid\[data-count=/);
  assert.match(styles, /\.home-opportunity-card \{[^}]*box-sizing:border-box;[^}]*display:flex; flex-direction:column; height:100%;[^}]*min-height:320px;[^}]*padding:18px/);
  assert.match(styles, /\.home-opportunity-card h3 \{[^}]*-webkit-line-clamp:3[^}]*height:3\.66em[^}]*margin:0 0 10px/);
  assert.match(styles, /@media\(max-width:560px\)[\s\S]*\.home-opportunities-grid \{ grid-template-columns:1fr; \}/);
});

test('home opportunity cards present a concise location, key requirement and investment with safe text nodes', () => {
  assert.match(home, /fact\(area\(item\), 'ruler'\)/);
  assert.match(home, /fact\(investment\(item\), 'currency-circle-dollar'\)/);
  assert.match(home, /fact\(`\$\{number\.format\(rooms\)\} \$\{rooms === 1 \? 'quarto' : 'quartos'\}`, 'bed'\)/);
  assert.match(home, /monthly \? '\/mês' : ''/);
  assert.match(home, /Tenho imóvel compatível/);
  assert.match(home, /Compartilhar oportunidade/);
  assert.match(home, /title\.textContent = clean\(item\.titulo\)/);
  assert.match(home, /detail\.textContent = value/);
  assert.doesNotMatch(home, /Oportunidade de compra/);
  assert.doesNotMatch(home, /innerHTML/);
});
