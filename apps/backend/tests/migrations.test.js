const assert = require('node:assert/strict');
const test = require('node:test');
const removePropertyTitle = require('../migrations/002_remove_property_title');
const removeAdvertiserAddress = require('../migrations/004_remove_advertiser_address');
const privacyConsent = require('../migrations/004_privacy_consent');
const removeAdvertiserFields = require('../migrations/005_remove_advertiser_fields');
const passwordResetTokens = require('../migrations/008_password_reset_tokens');
const adminSettings = require('../migrations/009_admin_settings');
const propertyPerimeter = require('../migrations/010_property_perimeter');
const accountChangeTokens = require('../migrations/011_account_change_tokens');
const purchaseLocationCatalog = require('../migrations/013_purchase_location_catalog');
const removeNeighborhoodSearchCache = require('../migrations/014_remove_neighborhood_search_cache');
const seedTermsOfUse = require('../migrations/015_seed_terms_of_use');
const termsAcceptance = require('../migrations/016_terms_of_use_acceptance');
const proprietorTerms = require('../migrations/017_proprietor_intermediation_terms');
const partnerTerms = require('../migrations/018_partner_broker_terms');
const adminAuditAdminForeignKey = require('../migrations/020_admin_audit_admin_foreign_key');

test('admin audit migration moves actor references to admin accounts and clears only orphaned actor ids', async () => {
  const statements = [];
  const connection = {
    query: async sql => {
      statements.push(sql);
      if (/SELECT CONSTRAINT_NAME AS constraint_name/.test(sql)) {
        return [[{ constraint_name: 'admin_auditoria_ibfk_1', referenced_table_name: 'usuarios' }]];
      }
      return [[]];
    }
  };

  await adminAuditAdminForeignKey.up(connection);

  assert.match(statements[1], /DROP FOREIGN KEY `admin_auditoria_ibfk_1`/);
  assert.match(statements[2], /UPDATE admin_auditoria AS audit[\s\S]*SET audit\.usuario_id = NULL/);
  assert.match(statements[3], /FOREIGN KEY \(usuario_id\) REFERENCES admin_usuarios\(id\) ON DELETE SET NULL/);
});

test('admin audit migration is idempotent when the correct foreign key already exists', async () => {
  const statements = [];
  const connection = {
    query: async sql => {
      statements.push(sql);
      if (/SELECT CONSTRAINT_NAME AS constraint_name/.test(sql)) {
        return [[{ constraint_name: 'fk_admin_auditoria_admin', referenced_table_name: 'admin_usuarios' }]];
      }
      return [[]];
    }
  };

  await adminAuditAdminForeignKey.up(connection);

  assert.equal(statements.length, 1);
});

test('terms of use migration seeds its own editable content without overwriting existing content', async () => {
  const statements = [];
  const connection = { query: async (sql, values) => { statements.push({ sql, values }); } };
  await seedTermsOfUse.up(connection);
  assert.match(statements[0].sql, /INSERT IGNORE INTO site_conteudos/);
  assert.deepEqual(statements[0].values, ['termos_uso', 'Termos de Uso', seedTermsOfUse.INITIAL_TERMS]);
  assert.match(seedTermsOfUse.INITIAL_TERMS, /em elaboração/i);
});

test('terms acceptance migration adds version and timestamp fields idempotently', async () => {
  const statements = [];
  const connection = {
    execute: async (_sql, [_table, column]) => [[...(column === 'termos_uso_versao' ? [{ present: 1 }] : [])]],
    query: async sql => { statements.push(sql); }
  };
  await termsAcceptance.up(connection);
  assert.deepEqual(statements, ['ALTER TABLE `usuarios` ADD COLUMN `termos_uso_aceita_em` DATETIME NULL']);
});

test('proprietor intermediation terms seed separately and retain per-property acceptance snapshots', async () => {
  const statements = [];
  const connection = { query: async (sql, values) => { statements.push({ sql, values }); } };
  await proprietorTerms.up(connection);
  assert.match(statements[0].sql, /INSERT IGNORE INTO site_conteudos/);
  assert.deepEqual(statements[0].values, ['termos_proprietario', 'Termos de Intermediação do Proprietário', proprietorTerms.INITIAL_PROPRIETOR_TERMS]);
  assert.match(proprietorTerms.INITIAL_PROPRIETOR_TERMS, /6% \(seis por cento\)/);
  assert.match(proprietorTerms.INITIAL_PROPRIETOR_TERMS, /revisão jurídica/i);
  assert.match(statements[1].sql, /CREATE TABLE IF NOT EXISTS imovel_termo_aceites/);
  assert.match(statements[1].sql, /conteudo_termos LONGTEXT/);
  assert.match(statements[1].sql, /FOREIGN KEY \(imovel_id\).*ON DELETE CASCADE/);
});

test('partner broker terms seed separately and retain the accepted version and full text per account', async () => {
  const statements = [];
  const connection = { query: async (sql, values) => { statements.push({ sql, values }); } };
  await partnerTerms.up(connection);
  assert.match(statements[0].sql, /INSERT IGNORE INTO site_conteudos/);
  assert.deepEqual(statements[0].values, ['termos_corretor_parceiro', 'Termos do Corretor Parceiro', partnerTerms.INITIAL_PARTNER_TERMS]);
  assert.match(partnerTerms.INITIAL_PARTNER_TERMS, /4,15%/);
  assert.match(partnerTerms.INITIAL_PARTNER_TERMS, /1,85%/);
  assert.match(partnerTerms.INITIAL_PARTNER_TERMS, /revisão jurídica/i);
  assert.match(statements[1].sql, /CREATE TABLE IF NOT EXISTS usuario_termo_aceites/);
  assert.match(statements[1].sql, /conteudo_termos LONGTEXT/);
});

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

test('purchase location catalog persists only states and cities', async () => {
  const statements = [];
  const connection = { query: async sql => { statements.push(sql); } };
  await purchaseLocationCatalog.up(connection);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS localidades_estados/);
  assert.match(statements[1], /CREATE TABLE IF NOT EXISTS localidades_cidades/);
  assert.match(statements[1], /UNIQUE KEY uq_localidade_cidade \(estado_sigla, nome_normalizado\)/);
  assert.doesNotMatch(statements.join('\n'), /localidades_bairros|fonte_id/);
});

test('migration removes the persisted neighborhood search cache', async () => {
  const statements = [];
  await removeNeighborhoodSearchCache.up({ query: async sql => { statements.push(sql); } });
  assert.deepEqual(statements, ['DROP TABLE IF EXISTS localidades_bairros']);
});

test('account change migration creates separate one-time email and password token stores', async () => {
  const statements = [];
  await accountChangeTokens.up({ query: async sql => { statements.push(sql); } });
  assert.equal(statements.length, 2);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS alteracao_email_tokens/);
  assert.match(statements[0], /novo_email VARCHAR\(180\) NOT NULL/);
  assert.match(statements[0], /token_hash CHAR\(64\) NOT NULL UNIQUE/);
  assert.match(statements[1], /CREATE TABLE IF NOT EXISTS alteracao_senha_tokens/);
  assert.match(statements[1], /senha_hash TEXT NOT NULL/);
  assert.match(statements[1], /expires_at DATETIME NOT NULL/);
});
