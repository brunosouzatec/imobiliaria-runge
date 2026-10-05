const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(root, 'apps/backend/src/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/frontend/public/vue-app.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'apps/frontend/public/admin.js'), 'utf8');
const publicTerms = fs.readFileSync(path.join(root, 'apps/frontend/public/termos-proprietario.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'apps/frontend/public/react-pages.css'), 'utf8');

test('proprietor terms are a separate public/admin content item and separate public page', () => {
  assert.match(server, /politica_privacidade\|termos_uso\|termos_proprietario\|termos_corretor_parceiro/);
  assert.match(server, /const publicContentRoute = url\.pathname\.match/);
  assert.match(server, /const contentRoute = url\.pathname\.match/);
  assert.match(server, /politica_privacidade\|termos_uso\|termos_proprietario\|termos_corretor_parceiro/);
  assert.match(admin, /button\.dataset\.tab = 'ownerTerms'/);
  assert.match(admin, /api\/admin\/conteudos\/termos_proprietario/);
  assert.match(publicTerms, /api\/conteudos\/termos_proprietario/);
  assert.match(publicTerms, /MINUTA|revisão jurídica/i);
});

test('administrator sidebar aligns every item and enhances both legal-term entries with icons', () => {
  const sidebarStyles = fs.readFileSync(path.join(root, 'apps/frontend/public/admin-ux.css'), 'utf8');
  assert.match(admin, /termos do proprietário\|termos do corretor parceiro/i);
  assert.match(admin, /enhanceAdminIcons\(\);\s*\};\s*const renderOriginalWithOwnerTerms/);
  assert.match(sidebarStyles, /\.admin-shell > aside > button\s*\{[^}]*align-items:\s*center;[^}]*display:\s*flex;[^}]*gap:\s*10px;/s);
  assert.match(sidebarStyles, /\.admin-shell > aside > button \.admin-context-icon\s*\{[^}]*flex:\s*0 0 20px;/s);
});

test('owner declaration is explicit, unchecked by default and linked next to property publishing', () => {
  assert.match(app, /v-model="aceiteTermosProprietario" type="checkbox" required/);
  assert.match(app, /Declaro que sou responsável pela regularidade da documentação do imóvel/);
  assert.match(app, /concordo com o pagamento de 6% de corretagem sobre o valor total da negociação/);
  assert.match(app, /termos-proprietario\.html/);
  assert.match(app, /aceiteTermosProprietario = ref\(false\)/);
  assert.match(app, /precisaAceiteTermosProprietario/);
  assert.match(styles, /\.owner-terms-consent/);
});

test('direct owner sees the exact declaration already during account registration and acceptance is stored per account', () => {
  assert.match(app, /v-if="precisaAceiteProprietarioCadastro" class="owner-terms-consent"/);
  assert.match(app, /aceito os <a href="termos-proprietario\.html"[^>]*>Termos de Uso e Intermediação<\/a> e concordo com o pagamento de 6% de corretagem sobre o valor total da negociação caso haja conversão da intermediação em negócio/);
  assert.match(server, /data\.aceite_termos_proprietario === true \|\| data\.aceite_termos_proprietario === 'true'/);
  assert.match(server, /'termos_proprietario', proprietorTerms\.versao, proprietorTerms\.conteudo/);
  assert.match(server, /AS termos_proprietario_versao/);
});

test('server requires the current owner-terms version and stores the full snapshot per property', () => {
  assert.match(server, /function isDirectPropertyOwner/);
  assert.match(server, /function ownerTermsFor/);
  assert.match(server, /data\?\.termos_proprietario_versao\).*Number\(terms\.versao\)/);
  assert.match(server, /INSERT IGNORE INTO imovel_termo_aceites \(imovel_id,usuario_id,versao_termos,conteudo_termos\)/);
  assert.match(server, /await ownerTermsFor\(owned\.userId, propertyId, d\)/);
  assert.match(server, /await insertPropertyWithOwnerTerms/);
  assert.match(server, /termos_proprietario_versao/);
});

test('only direct owners get the owner declaration so brokers are not misrepresented as property owners', () => {
  assert.match(app, /proprietario direto/);
  assert.match(server, /isDirectPropertyOwner\(user\.tipo_usuario\)/);
  assert.match(admin, /Termos do proprietário/);
});
