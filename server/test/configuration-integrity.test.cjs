require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {CryptoService} = require('../dist-test/common/crypto.service');
const {ConfigurationIntegrityService} = require('../dist-test/configuration-integrity/configuration-integrity.service');
const {EncryptionConfigurationCheck} = require('../dist-test/configuration-integrity/encryption-configuration.check');
const {EnvironmentConfigurationCheck} = require('../dist-test/configuration-integrity/environment-configuration.check');
const {DatabaseSchemaCheck} = require('../dist-test/configuration-integrity/database-schema.check');

test('integrity aggregates independent findings and reports failed checks without exposing exception details', async () => {
  const service = new ConfigurationIntegrityService([
    {name: 'one', check: () => [{code: 'ONE'}]},
    {name: 'two', check: async () => [{code: 'TWO'}]},
    {name: 'failed', check: () => {throw new Error('SECRET');}},
  ]);
  const issues = await service.check();
  assert.deepEqual(issues.map(issue => issue.code), ['ONE', 'TWO', 'CONFIGURATION_CHECK_FAILED_failed']);
  assert.ok(!JSON.stringify(issues).includes('SECRET'));
});

test('environment checks report all invalid settings and production schema synchronization', () => {
  const values = {PORT: '0', DB_PORT: '5432junk', ROUTEROS_TIMEOUT_MS: 'NaN', DB_SYNCHRONIZE: 'maybe', DEVELOPMENT_TOOLS_ENABLED: 'yes', DB_HOST: '', CORS_ORIGIN: 'https://example.test/path'};
  const check = new EnvironmentConfigurationCheck({get: (key, fallback) => values[key] ?? fallback});
  assert.equal(check.check().length, 7);
  const valid = new EnvironmentConfigurationCheck({get: (_key, fallback) => fallback});
  assert.deepEqual(valid.check(), []);
  const production = new EnvironmentConfigurationCheck({get: (key, fallback) => key === 'NODE_ENV' ? 'production' : fallback});
  assert.ok(production.check().some(issue => issue.code === 'PRODUCTION_SCHEMA_SYNCHRONIZATION'));
});

test('schema checks identify missing columns, clear provisioned schemas and report database failures', async () => {
  const database = {options: {}, entityMetadatas: [{tableName: 'devices', columns: [{databaseName: 'initialBackup'}]}], query: async () => []};
  const check = new DatabaseSchemaCheck(database);
  assert.match((await check.check())[0].instructions, /public.devices.initialBackup/);
  database.query = async () => [{table_schema: 'public', table_name: 'devices', column_name: 'initialBackup'}];
  assert.deepEqual(await check.check(), []);
  database.query = async () => {throw new Error('database password must not be returned');};
  assert.equal((await check.check())[0].code, 'DATABASE_CONFIGURATION_UNAVAILABLE');
});

test('encryption checks reject missing or malformed keys and detect a changed key against stored credentials', async () => {
  const original = process.env.ENCRYPTION_KEY;
  let credentials = [];
  const check = new EncryptionConfigurationCheck(new CryptoService(), {getRepository: () => ({find: async () => credentials})});
  try {
    for (const key of ['', 'invalid']) {
      process.env.ENCRYPTION_KEY = key;
      assert.equal((await check.check())[0].code, 'CREDENTIAL_STORAGE_NOT_CONFIGURED');
    }
    process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
    credentials = [{passwordEncrypted: new CryptoService().encrypt('secret')}];
    assert.deepEqual(await check.check(), []);
    process.env.ENCRYPTION_KEY = 'cd'.repeat(32);
    const issues = await check.check();
    assert.equal(issues[0].code, 'STORED_CREDENTIALS_UNREADABLE');
    assert.ok(!JSON.stringify(issues).includes(process.env.ENCRYPTION_KEY));
  } finally {
    if (original === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = original;
  }
});
