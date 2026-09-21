const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(projectRoot, 'apps/frontend/public/vue-app.js'), 'utf8');
const detailStyles = fs.readFileSync(path.join(projectRoot, 'apps/frontend/public/react-pages.css'), 'utf8');
const detail = source.match(/const Detail = \{([\s\S]*?)\n\};\s*const Login/);

test('property detail groups gallery and description beside a single value/contact panel', () => {
  assert.ok(detail, 'Detail component exists');
  assert.match(detail[1], /property-detail-gallery/);
  assert.match(detail[1], /property-description-title/);
  assert.match(detail[1], /property-detail-sidebar/);
  assert.match(detail[1], /property-detail-prices/);
  assert.match(detail[1], /property-detail-actions/);
  assert.equal((detail[1].match(/property-detail-address/g) || []).length, 1);
  assert.equal((detail[1].match(/property-detail-summary/g) || []).length, 1);
  assert.doesNotMatch(detail[1], /item\.titulo/);
});

test('headline metrics are excluded from the detailed characteristics list', () => {
  assert.match(detail[1], /caracteristicasDetalhadas = computed\(\(\) => caracteristicas\.value\.filter\(feature => !\['area', 'area_total', 'area_construida', 'quartos', 'banheiros', 'vagas'\]\.includes\(feature\.key\)\)\)/);
  assert.match(detail[1], /v-for="feature in caracteristicasDetalhadas"/);
  assert.match(detail[1], /v-for="fact in resumoCaracteristicas"/);
});

test('inclusões usam o contrato de resumo do PropertyOffers e não uma propriedade inexistente', () => {
  assert.match(detail[1], /ofertaResumo = computed\(\(\) => PropertyOffers\.summary\(item\.value \|\| \{\}\)\)/);
  assert.match(detail[1], /ofertaResumo\.included\.length/);
  assert.doesNotMatch(detail[1], /oferta\.included/);
});

test('valor do condomínio usa o campo que PropertyOffers.parse realmente fornece', () => {
  assert.match(detail[1], /current\.condoAmount !== null/);
  assert.match(detail[1], /PropertyOffers\.format\(current\.condoAmount\)/);
  assert.doesNotMatch(detail[1], /current\.condoFee/);
});

test('detalhes distinguem imóvel inexistente de erro de carregamento', () => {
  assert.match(detail[1], /fetch\(`\/api\/imoveis\/\$\{id\}`\)/);
  assert.match(detail[1], /role="alert"/);
  assert.match(detail[1], /item\.value = false/);
});

test('erros de renderização Vue deixam uma mensagem visível em vez de uma tela branca', () => {
  const errorHandler = source.match(/app\.config\.errorHandler = \(error, instance, info\) => \{([\s\S]*?)\r?\n\};\r?\napp\.mount/);
  assert.ok(errorHandler, 'Vue render error handler is configured before mount');
  assert.match(errorHandler[1], /console\.error/);
  assert.match(errorHandler[1], /role="alert"/);
  assert.match(errorHandler[1], /Voltar para a lista/);
});

test('lightbox usa popup central, fecha pelo X e não exibe controles ausentes do modelo', () => {
  assert.match(detail[1], /class="property-lightbox" role="presentation" @click\.self="fecharGaleria"/);
  assert.match(detail[1], /class="lightbox-dialog" role="dialog" aria-modal="true"[^>]*@click\.stop/);
  assert.match(detail[1], /class="lightbox-close"[^>]*@click="fecharGaleria"/);
  assert.match(detail[1], /class="lightbox-caption">\{\{ lightboxIndex \+ 1 \}\} de \{\{ item\.fotos\.length \}\}<\/p>/);
  assert.doesNotMatch(detail[1], /class="lightbox-thumbnails"/);
  assert.match(detailStyles, /\.lightbox-caption\s*\{[^}]*bottom:\s*14px;[^}]*left:\s*50%;[^}]*position:\s*fixed/);
  assert.match(detailStyles, /\.lightbox-dialog\s*\{[^}]*height:\s*min\(77vh, 800px\)[^}]*width:\s*min\(82vw, 1160px\)/);
});

test('setas ficam nas extremidades da tela e X no canto superior direito', () => {
  assert.match(detailStyles, /\.lightbox-nav\s*\{[^}]*position:\s*fixed;[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\)/);
  assert.match(detailStyles, /\.lightbox-prev\s*\{[^}]*left:\s*16px/);
  assert.match(detailStyles, /\.lightbox-next\s*\{[^}]*right:\s*16px/);
  assert.match(detailStyles, /\.lightbox-close\s*\{[^}]*position:\s*fixed;[^}]*right:\s*14px;[^}]*top:\s*8px/);
  assert.match(detail[1], /class="lightbox-nav lightbox-prev"[^>]*><span aria-hidden="true">‹<\/span><\/button>/);
  assert.match(detail[1], /class="lightbox-nav lightbox-next"[^>]*><span aria-hidden="true">›<\/span><\/button>/);
  assert.match(detailStyles, /\.lightbox-nav\s*\{[^}]*align-items:\s*center;[^}]*display:\s*flex;[^}]*justify-content:\s*center/);
  assert.match(detailStyles, /\.lightbox-nav span\s*\{[^}]*font-size:\s*2\.8rem;[^}]*line-height:\s*1/);
  assert.match(detailStyles, /\.lightbox-photo\s*\{[^}]*object-fit:\s*contain/);
});

test('fundo da modal cobre toda a tela e fica acima do cabeçalho', () => {
  assert.match(detailStyles, /\.property-lightbox\s*\{[^}]*z-index:\s*1100/);
  assert.match(detailStyles, /\.property-lightbox\s*\{[^}]*inset:\s*0/);
  assert.match(detailStyles, /\.property-lightbox\s*\{[^}]*background:\s*#0b0b0bf2/);
});
