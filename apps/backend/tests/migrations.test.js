const assert = require('node:assert/strict');
const test = require('node:test');
const removePropertyTitle = require('../migrations/002_remove_property_title');

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
