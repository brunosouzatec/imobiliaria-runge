const assert = require('node:assert/strict');
const test = require('node:test');
const removePropertyTitle = require('../migrations/002_remove_property_title');
const privacyConsent = require('../migrations/004_privacy_consent');
const removeAdvertiserFields = require('../migrations/005_remove_advertiser_fields');

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
