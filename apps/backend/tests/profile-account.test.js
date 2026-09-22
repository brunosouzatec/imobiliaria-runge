const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/frontend/public');
const app = fs.readFileSync(path.join(frontend, 'vue-app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const styles = fs.readFileSync(path.join(frontend, 'react-pages.css'), 'utf8');

test('perfil separa dados, troca de e-mail e troca de senha sem listar imóveis', () => {
  const profile = app.slice(app.indexOf('const Profile ='), app.indexOf('const ConfirmarAlteracao ='));
  assert.match(profile, /Meus dados/);
  assert.match(profile, /Alterar e-mail/);
  assert.match(profile, /Alterar senha/);
  assert.match(profile, /E-mail de acesso/);
  assert.match(profile, /aria-selected/);
  assert.doesNotMatch(profile, /data\.imoveis|Seus imóveis/);
});

test('trocas de conta exigem sessão para solicitar e confirmam por rotas próprias', () => {
  assert.match(server, /\/api\/perfil\/alterar-email/);
  assert.match(server, /\/api\/perfil\/alterar-senha/);
  assert.match(server, /\/api\/perfil\/confirmar-alteracao/);
  assert.match(server, /verifyPassword\(data\.senha_atual, user\.senha_hash\)/);
  assert.match(server, /sessions\.delete\(sessionToken\)/);
});

test('link de confirmação tem página e rota com e sem extensão', () => {
  assert.ok(fs.existsSync(path.join(frontend, 'confirmar-alteracao.html')));
  assert.match(server, /\['\/confirmar-alteracao\.html', '\/confirmar-alteracao'\]/);
  assert.match(app, /path\.endsWith\('confirmar-alteracao\.html'\) \? ConfirmarAlteracao/);
});

test('perfil aproveita largura Full HD com menu lateral e mantém navegação compacta no mobile', () => {
  assert.match(styles, /\.profile-settings \{ display: grid; grid-template-columns: 270px minmax\(0, 1fr\); max-width: none/);
  assert.match(styles, /\.profile-tabs \{[^}]*flex-direction: column/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.profile-tabs \{[^}]*flex-direction: row/);
  assert.match(styles, /\.profile-panel \.react-profile-form > \.react-button \{ margin-top: 18px; \}/);
});

test('menu e login usam a tela Meus imóveis, que permite editar e excluir cada anúncio', () => {
  assert.match(app, /href="meus-imoveis\.html">Meus imóveis/);
  assert.match(app, /else location\.href = 'meus-imoveis\.html'/);
  const page = app.slice(app.indexOf('const MeusImoveis ='), app.indexOf('MeusImoveis.template ='));
  assert.match(page, /:show-edit="true"/);
  assert.match(page, /@delete="prepararExclusao"/);
  assert.match(page, /\/api\/imoveis\/\$\{imovelParaExcluir\.value\.id\}.*method: 'DELETE'/);
  assert.match(page, /role="alertdialog"/);
});

test('exclusão de anúncio autentica a conta e restringe a operação aos imóveis de seu proprietário', () => {
  assert.match(server, /detailFixed && req\.method === 'DELETE'.*authenticatedUser/);
  assert.match(server, /DELETE FROM imoveis WHERE id=\? AND usuario_id=\?/);
  assert.match(server, /SELECT id FROM imoveis WHERE id=\? AND usuario_id=\?/);
});
