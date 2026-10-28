require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');
const {Client} = require('pg');
const {DataSource} = require('typeorm');
const {Customer, Device, DeviceCredential, ConfigProfile} = require('../dist-test/entities');
const {DevicesService} = require('../dist-test/devices/devices.service');
const {CryptoService} = require('../dist-test/common/crypto.service');

test('enrollment verifies persisted credentials and commits without requiring an initial backup', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_enrollment_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db;
  const previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    db = new DataSource({type: 'postgres', host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [Customer, Device, DeviceCredential, ConfigProfile]});
    await db.initialize();
    const crypto = new CryptoService();
    const bytes = Buffer.from([0, 255, 128, 1, 2, 3]);
    let backupCalled = false;
    let loginCount = 0;
    let rejectStoredLogin = false;
    const router = {
      verifyLogin: async credentials => {
        loginCount++;
        assert.equal(credentials.username, 'admin'); assert.equal(credentials.password, 'test-secret');
        if (rejectStoredLogin && loginCount === 2) throw {response: {status: 401}};
        return {version: '7.26', model: 'fixture', communication: credentials.communication};
      },
      captureInitialBackup: async () => { backupCalled = true; throw new Error('Backup is unavailable and must not be required'); },
    };
    const service = new DevicesService(db.getRepository(Device), db.getRepository(DeviceCredential), db.getRepository(Customer), crypto, router);
    const input = {hostname: 'Fixture', mgmtIp: '192.0.2.1', username: 'admin', password: 'test-secret', communication: {methods: [{id: 'https-rest', enabled: true, port: 8443, acceptSelfSignedCertificates: true}], selectedStrategy: 'https-rest'}};
    await assert.rejects(service.create({...input, password: undefined}), error => error.getStatus() === 400);
    rejectStoredLogin = true; loginCount = 0;
    await assert.rejects(service.create(input), error => error.getStatus() === 401);
    assert.equal(await db.getRepository(Device).count(), 0);
    assert.equal(await db.getRepository(DeviceCredential).count(), 0);
    rejectStoredLogin = false; loginCount = 0;
    const enrolled = await service.create(input);
    assert.equal(loginCount, 2);
    assert.equal(enrolled.status, 'online');
    assert.deepEqual(enrolled.communication, input.communication);
    assert.equal(backupCalled, false);
    assert.equal(enrolled.initialBackup, null);
    assert.equal(enrolled.initialBackupEncrypted, undefined);
    assert.equal(enrolled.credential.passwordEncrypted, undefined);
    const stored = await db.getRepository(DeviceCredential).findOneByOrFail({deviceId: enrolled.id});
    assert.notEqual(stored.passwordEncrypted, input.password);
    assert.equal(crypto.decrypt(stored.passwordEncrypted), input.password);
    const reloaded = new DevicesService(db.getRepository(Device), db.getRepository(DeviceCredential), db.getRepository(Customer), new CryptoService(), router);
    assert.equal((await reloaded.verifyStoredLogin(enrolled.id)).verified, true);
    await assert.rejects(reloaded.downloadInitialBackup(enrolled.id), error => error.getStatus() === 404);
    // Backups captured before this requirement was removed remain downloadable.
    await db.getRepository(Device).update(enrolled.id, {initialBackupEncrypted: crypto.encrypt(bytes.toString('base64')), initialBackup: {capturedAt: new Date().toISOString(), size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), format: 'routeros-backup'}});
    assert.deepEqual(await reloaded.downloadInitialBackup(enrolled.id), bytes);
    assert.equal((await reloaded.findAll())[0].initialBackupEncrypted, undefined);
    await assert.rejects(service.create(input), error => error.getStatus() === 409);
    await db.getRepository(Device).update(enrolled.id, {initialBackupEncrypted: crypto.encrypt('corrupt')});
    await assert.rejects(service.downloadInitialBackup(enrolled.id), error => error.getStatus() === 503);
  } finally {
    if (previousKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = previousKey;
    if (db?.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
