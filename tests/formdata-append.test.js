const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

test('FormData aceita campos de texto, características JSON e fotos Blob', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'vue-app.js'), 'utf8');
  const patch = source.match(/const appendOriginal = FormData\.prototype\.append;[\s\S]*?(?=\nconst MeusImoveis)/)?.[0];

  assert.ok(patch, 'o adaptador global de FormData deve estar presente');
  runInNewContext(patch, { FormData });

  const form = new FormData();
  form.append('titulo', 'Casa em Tatuí');
  form.append('caracteristicas', { quartos: 2 });
  form.append('fotos', new Blob(['imagem']), 'casa.png');

  assert.equal(form.get('titulo'), 'Casa em Tatuí');
  assert.equal(form.get('caracteristicas'), '{"quartos":2}');
  assert.equal(form.get('fotos').name, 'casa.png');
});
