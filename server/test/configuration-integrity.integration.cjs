require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');
const {Module, ValidationPipe} = require('@nestjs/common');
const {NestFactory} = require('@nestjs/core');
const {ConfigModule} = require('@nestjs/config');
const {TypeOrmModule} = require('@nestjs/typeorm');
const {DataSource} = require('typeorm');
const {Customer, Device, DeviceCredential, ConfigProfile} = require('../dist-test/entities');
const {CommonModule} = require('../dist-test/common/common.module');
const {ConfigurationIntegrityModule} = require('../dist-test/configuration-integrity/configuration-integrity.module');

test('configuration endpoint reports independent issues and actual missing schema in an isolated database', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_integrity_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  const previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = '';
  let app;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    class TestModule {}
    Module({imports: [ConfigModule.forRoot({ignoreEnvFile: true, isGlobal: true}), CommonModule,
      TypeOrmModule.forRoot({type: 'postgres', autoLoadEntities: true, host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [Customer, Device, DeviceCredential, ConfigProfile]}),
      ConfigurationIntegrityModule,
    ]})(TestModule);
    app = await NestFactory.create(TestModule, {logger: false});
    app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));
    await app.listen(0, '127.0.0.1');
    const url = (await app.getUrl()) + '/configuration/issues';
    const initial = await fetch(url);
    assert.equal(initial.status, 200);
    assert.equal(initial.headers.get('cache-control'), 'no-store');
    const settingsUrl = (await app.getUrl()) + '/communication/settings';
    const global = await (await fetch(settingsUrl)).json();
    assert.equal(global.revision, 0);
    const reordered = [...global.methods].reverse();
    const saved = await fetch(settingsUrl, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({methods: reordered, revision: 0})});
    assert.equal(saved.status, 200);
    const reloaded = await (await fetch(settingsUrl)).json();
    assert.deepEqual(reloaded.methods, reordered); assert.equal(reloaded.revision, 1);
    const stale = await fetch(settingsUrl, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({methods: reordered, revision: 0})});
    assert.equal(stale.status, 409);
    const issues = await initial.json();
    assert.ok(issues.some(issue => issue.code === 'CREDENTIAL_STORAGE_NOT_CONFIGURED'));
    assert.ok(!issues.some(issue => issue.code.startsWith('CONFIGURATION_CHECK_FAILED')));
    assert.ok(!issues.some(issue => issue.code === 'DATABASE_SCHEMA_INCOMPLETE'));
    await app.get(DataSource).query('ALTER TABLE devices DROP COLUMN "initialBackup"');
    const incomplete = await (await fetch(url)).json();
    assert.ok(incomplete.some(issue => issue.code === 'CREDENTIAL_STORAGE_NOT_CONFIGURED'));
    assert.ok(incomplete.some(issue => issue.code === 'DATABASE_SCHEMA_INCOMPLETE' && issue.instructions.includes('initialBackup')));
  } finally {
    if (app) await app.close();
    if (previousKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = previousKey;
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
