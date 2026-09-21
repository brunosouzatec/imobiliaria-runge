const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/vue-app.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../../frontend/public/cadastro.css'), 'utf8');

test('cadastro mantém as três etapas na mesma tela com navegação progressiva', () => {
  assert.match(source, /const subetapa = ref\(1\)/);
  assert.match(source, /Continuar para localização/);
  assert.match(source, /Continuar para fotos/);
  assert.match(source, /cadastro-step-panel/);
  assert.match(source, /v-show="subetapa === 1"/);
  assert.match(source, /v-show="subetapa === 2"/);
  assert.match(source, /v-show="subetapa === 3"/);
  assert.match(styles, /cadastro-step-slide-left/);
  assert.match(styles, /cadastro-step-slide-right/);
});

test('cadastro valida informações e localização antes de permitir o próximo passo ou publicar', () => {
  assert.match(source, /const validarEtapa = etapa =>/);
  assert.match(source, /Selecione ao menos uma modalidade: Venda, Aluguel ou Permuta/);
  assert.match(source, /Informe um preço de venda maior que zero/);
  assert.match(source, /Informe o valor mensal do condomínio ou marque que ele está incluso/);
  assert.match(source, /Preencha o campo \$\{faltante\[1\]\} para continuar/);
  assert.match(source, /Localize o endereço no mapa ou clique no mapa para criar o marcador/);
  assert.match(source, /salvar: salvarValidado/);
  assert.match(source, /property-form" @submit="salvar" novalidate/);
  assert.match(source, /step-validation-message/);
});
