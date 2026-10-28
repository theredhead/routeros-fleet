require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');
const {DataSource} = require('typeorm');
const {Customer, Device, DeviceCredential, ConfigProfile} = require('../dist-test/entities');
const {CustomersService} = require('../dist-test/customers/customers.service');

test('customer edits can clear contact fields and deletion leaves enrolled devices unassigned', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_customers_test_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    db = new DataSource({type: 'postgres', host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [Customer, Device, DeviceCredential, ConfigProfile]});
    await db.initialize();
    const service = new CustomersService(db.getRepository(Customer));
    const customer = await service.create({name: 'Original', contactName: 'Contact', contactEmail: 'fixture@example.test'});
    const device = await db.getRepository(Device).save({hostname: 'Fixture router', mgmtIp: '192.0.2.1', status: 'enrolled', customerId: customer.id});
    const updated = await service.update(customer.id, {name: 'Updated', contactName: null, contactEmail: null});
    assert.equal(updated.name, 'Updated');
    const stored = await service.findOne(customer.id);
    assert.equal(stored.contactName, null); assert.equal(stored.contactEmail, null);
    assert.equal(stored.devices[0].id, device.id);
    await service.remove(customer.id);
    assert.deepEqual(await service.findAll(), []);
    const retained = await db.getRepository(Device).findOneByOrFail({id: device.id});
    assert.equal(retained.customerId, null); assert.equal(retained.status, 'enrolled');
  } finally {
    if (db?.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
