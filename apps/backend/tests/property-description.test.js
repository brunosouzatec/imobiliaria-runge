const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const description = require('../../../packages/shared/property-description');

test('colagem de texto preserva cada tópico em um parágrafo e mantém os emojis', () => {
  const html = description.textoParaHtml('✅ Terreno cercado\r\n📍 Boa localização\n🏠 Documentação em ordem');

  assert.equal(html, '<p>✅ Terreno cercado</p><p>📍 Boa localização</p><p>🏠 Documentação em ordem</p>');
});

test('texto colado é escapado para não inserir marcação ou atributos executáveis', () => {
  assert.equal(description.textoParaHtml('<img src=x onerror=alert(1)>'), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
});

test('sanitização mantém linhas do contenteditable convertendo DIV em parágrafos', () => {
  assert.equal(description.sanitizar('<div>✅ Item um</div><div>📍 Item dois</div>'), '<p>✅ Item um</p><p>📍 Item dois</p>');
});

test('sanitização conserva listas e remove conteúdo ativo e atributos perigosos', () => {
  const html = description.sanitizar('<ul><li onclick="alert(1)">✅ Item</li></ul><script>alert(2)</script><p style="color:red">Texto</p>');

  assert.equal(html, '<ul><li>✅ Item</li></ul><p>Texto</p>');
});

test('resumo para cards remove tags, decodifica entidades e mantém emojis e separação entre blocos', () => {
  const resumo = description.resumo('<p>✅ Primeira linha</p><p>📍 Segunda&nbsp;linha &amp; bairro</p><ul><li>🏠 Casa</li></ul>');

  assert.equal(resumo, '✅ Primeira linha 📍 Segunda linha & bairro 🏠 Casa');
  assert.doesNotMatch(resumo, /<\/?(?:p|ul|li)>/i);
});

test('editor do anúncio vincula a colagem ao conversor de texto com quebras de linha', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/public/vue-app.js'), 'utf8');

  assert.match(source, /@paste="colarDescricao"/);
  assert.match(source, /PropertyDescription\.textoParaHtml\(texto\)/);
  assert.match(source, /state\.imovel\.value\.descricao = event\.currentTarget\.innerHTML/);
});
