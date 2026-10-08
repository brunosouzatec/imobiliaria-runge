const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicRoot = path.resolve(__dirname, '../../frontend/public');
const app = fs.readFileSync(path.join(publicRoot, 'vue-app.js'), 'utf8');
const chrome = fs.readFileSync(path.join(publicRoot, 'site-chrome.js'), 'utf8');
const icons = fs.readFileSync(path.join(publicRoot, 'material-icons.js'), 'utf8');
const styles = fs.readFileSync(path.join(publicRoot, 'react.css'), 'utf8');
const adminPage = fs.readFileSync(path.join(publicRoot, 'admin.html'), 'utf8');

test('anunciante tem botão flutuante de ajuda nas páginas Vue e no chrome público', () => {
  assert.match(app, /class="advertiser-help-contact" href="https:\/\/wa\.me\/5515998134885/);
  assert.match(app, /if \(!document\.querySelector\('\.advertiser-help-contact'\)/);
  assert.match(chrome, /function ensureAdvertiserHelp\(root = document\)/);
  assert.match(chrome, /ensureAdvertiserHelp\(root\)/);
  assert.match(chrome, /ensureAdvertiserHelp\(document\)/);
  assert.match(chrome, /Dúvidas para anunciar\? Fale com a equipe pelo WhatsApp/);
  assert.match(chrome, /<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"/);
  assert.match(app, /advertiserHelp\.innerHTML = '<svg class="listing-whatsapp-icon"/);
  assert.match(app, /class="listing-whatsapp-icon" viewBox="0 0 24 24"/);
});

test('botão de ajuda é acessível, responsivo e fica fora da administração', () => {
  assert.match(styles, /\.advertiser-help-contact \{[^}]*position:fixed/);
  assert.match(styles, /@media\(max-width:600px\) \{ \.advertiser-help-contact/);
  assert.match(app, /aria-label="Dúvidas para anunciar\? Fale com a equipe pelo WhatsApp"/);
  assert.match(app, /source\.slice\(Math\.max\(0, offset - 600\), offset\)\.includes\('advertiser-help-contact'\)/);
  assert.match(icons, /svg\.closest\('\.advertiser-help-contact/);
  assert.doesNotMatch(adminPage, /advertiser-help-contact|site-chrome\.js/);
});
