const assert = require('node:assert/strict');
const test = require('node:test');
const removePropertyTitle = require('../migrations/002_remove_property_title');
const removeAdvertiserAddress = require('../migrations/004_remove_advertiser_address');
const privacyConsent = require('../migrations/004_privacy_consent');
const removeAdvertiserFields = require('../migrations/005_remove_advertiser_fields');
const passwordResetTokens = require('../migrations/008_password_reset_tokens');
const adminSettings = require('../migrations/009_admin_settings');
const propertyPerimeter = require('../migrations/010_property_perimeter');

test('title removal migration drops the legacy column only when it exists', async () => {
  const statements = [];
  const existingColumn = {
    execute: async () => [[{ present: 1 }]],
    query: async sql => { statements.push(sql); }
  };
  await removePropertyTitle.up(existingColumn);
  assert.deepEqual(statements, ['ALTER TABLE imoveis DROP COLUMN titulo']);

  const alreadyRemoved = {
    execute: async () => [[]],
    query: async sql => { statements.push(sql); }
  };
  await removePropertyTitle.up(alreadyRemoved);
  assert.equal(statements.length, 1);
});

test('advertiser address migration removes only legacy user address columns', async () => {
  const statements = [];
  const connection = {
    execute: async (_sql, [_table, column]) => [[...(column === 'cep' || column === 'estado' ? [{ present: 1 }] : [])]],
    query: async sql => { statements.push(sql); }
  };
  await removeAdvertiserAddress.up(connection);
  assert.deepEqual(statements, ['ALTER TABLE usuarios DROP COLUMN `cep`', 'ALTER TABLE usuarios DROP COLUMN `estado`']);
});

test('privacy migration adds version and acceptance timestamps only when absent', async () => {
  const statements = [];
  const connection = {
    execute: async (_sql, [table, column]) => [[table === 'usuarios' && column === 'privacidade_versao' ? { present: 1 } : null].filter(Boolean)],
    query: async sql => { statements.push(sql); }
  };
  await privacyConsent.up(connection);
  assert.deepEqual(statements, [
    'ALTER TABLE `usuarios` ADD COLUMN `privacidade_aceita_em` DATETIME NULL',
    'ALTER TABLE `contatos` ADD COLUMN `privacidade_versao` VARCHAR(40) NULL',
    'ALTER TABLE `contatos` ADD COLUMN `privacidade_aceita_em` DATETIME NULL'
  ]);
});

test('advertiser fields migration removes address and professional identifiers only when present', async () => {
  const statements = [];
  const connection = {
    execute: async (_sql, [_table, column]) => [[['cep', 'creci'].includes(column) ? { present: 1 } : null].filter(Boolean)],
    query: async sql => { statements.push(sql); }
  };
  await removeAdvertiserFields.up(connection);
  assert.deepEqual(statements, [
    'ALTER TABLE `usuarios` DROP COLUMN `cep`',
    'ALTER TABLE `usuarios` DROP COLUMN `creci`'
  ]);
});

test('password recovery migrations create token and encrypted admin settings tables', async () => {
  const statements = [];
  const connection = { query: async sql => { statements.push(sql); } };
  await passwordResetTokens.up(connection);
  await adminSettings.up(connection);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS recuperacao_senha_tokens/);
  assert.match(statements[0], /token_hash CHAR\(64\) NOT NULL UNIQUE/);
  assert.match(statements[1], /CREATE TABLE IF NOT EXISTS admin_configuracoes/);
  assert.match(statements[1], /atualizado_por INT NULL/);
});

test('perimeter migration adds the optional GeoJSON column only once', async () => {
  const statements = [];
  const connection = {
    query: async sql => { statements.push(sql); return [[{ total: statements.length === 1 ? 0 : 1 }]]; }
  };
  await propertyPerimeter.up(connection);
  await propertyPerimeter.up(connection);
  assert.deepEqual(statements, [
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='imoveis' AND column_name='perimetro'",
    'ALTER TABLE imoveis ADD COLUMN perimetro JSON NULL AFTER longitude',
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='imoveis' AND column_name='perimetro'"
  ]);
});
