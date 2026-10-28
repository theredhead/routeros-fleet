require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');
const {DataSource} = require('typeorm');
const {Customer, Device, DeviceCredential, ConfigProfile, Job, AuditLog} = require('../dist-test/entities');
const {DeviceInspectionService} = require('../dist-test/devices/device-inspection.service');
const {DevicesService} = require('../dist-test/devices/devices.service');

test('device details update fleet metadata and confirmed deletion removes only local enrollment data', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_device_details_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    db = new DataSource({type: 'postgres', host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [Customer, Device, DeviceCredential, ConfigProfile, Job, AuditLog]});
    await db.initialize();
    const service = new DevicesService(db.getRepository(Device), db.getRepository(DeviceCredential), db.getRepository(Customer), {encrypt: () => {throw new Error('Metadata edits must not touch credentials');}});
    const customer = await db.getRepository(Customer).save({name: 'Fixture customer'});
    const device = await db.getRepository(Device).save({hostname: 'Original', mgmtIp: '192.0.2.1', status: 'enrolled'});
    await db.getRepository(Device).save({hostname: 'Other', mgmtIp: '192.0.2.2', status: 'enrolled'});
    await db.getRepository(DeviceCredential).save({deviceId: device.id, username: 'fixture', passwordEncrypted: 'encrypted-fixture'});
    await db.getRepository(ConfigProfile).save({deviceId: device.id});
    const updated = await service.update(device.id, {hostname: 'Updated', customerId: customer.id, macAddress: 'aa:bb:cc:dd:ee:ff'});
    assert.equal(updated.hostname, 'Updated'); assert.equal(updated.customerId, customer.id);
    assert.equal(updated.macAddress, 'AA:BB:CC:DD:EE:FF');
    assert.equal(updated.credential.passwordEncrypted, undefined);
    await db.getRepository(AuditLog).save({deviceId: device.id, action: 'fixture', after: {password: 'must-not-leak'}});
    const inspection = new DeviceInspectionService(service, {decrypt: () => 'fixture-password'}, {select: async () => {throw new Error('offline');}}, db.getRepository(DeviceCredential), db.getRepository(Job), db.getRepository(AuditLog));
    const details = await inspection.stored(device.id);
    assert.equal(details.device.hostname, 'Updated'); assert.equal(details.audit.total, 1);
    assert.ok(!JSON.stringify(details).includes('must-not-leak'));
    assert.equal((await inspection.live(device.id)).status, 'unavailable');

    await assert.rejects(service.update(device.id, {mgmtIp: '192.0.2.2'}), error => error.getStatus() === 409);
    const job = await db.getRepository(Job).save({deviceId: device.id, status: 'running'});
    await assert.rejects(service.remove(device.id), error => error.getStatus() === 409);
    await assert.rejects(service.update(device.id, {hostname: 'Blocked'}), error => error.getStatus() === 409);
    await db.getRepository(Job).update(job.id, {status: 'succeeded'});
    await service.update(device.id, {customerId: null, macAddress: null});
    assert.equal((await service.findOne(device.id)).customerId, null);
    await service.remove(device.id);
    assert.equal(await db.getRepository(DeviceCredential).countBy({deviceId: device.id}), 0);
    assert.equal(await db.getRepository(ConfigProfile).countBy({deviceId: device.id}), 0);
    assert.equal(await db.getRepository(Device).count(), 1);
    assert.equal(await db.getRepository(Job).count(), 1);
    assert.equal(await db.getRepository(Customer).count(), 1);
  } finally {
    if (db?.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
