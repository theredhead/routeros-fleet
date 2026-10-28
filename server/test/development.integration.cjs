const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { ConfigService } = require('@nestjs/config');
const { seedRequiredProfiles } = require('../dist-test/profiles/profile-defaults');
const { DevelopmentService } = require('../dist-test/development/development.service');
const { Customer, Device, DeviceCredential, ConfigProfile, Job, AuditLog, FleetProfileEntity } = require('../dist-test/entities');

test('reset guards, rollback, and complete reset run only in an isolated temporary database', async () => {
  const connection = {
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet',
  };
  const temporaryDatabase = 'fleet_reset_test_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${temporaryDatabase}"`); created = true;
    db = new DataSource({type:'postgres', host:connection.host, port:connection.port, username:connection.user,
      password:connection.password, database:temporaryDatabase, synchronize:true,
      entities:[Customer, Device, DeviceCredential, ConfigProfile, Job, AuditLog, FleetProfileEntity]});
    await db.initialize();
    assert.equal(db.options.database, temporaryDatabase);
    const service = new DevelopmentService(db, new ConfigService({NODE_ENV:'test', DEVELOPMENT_TOOLS_ENABLED:'true'}));
    await seedRequiredProfiles(db.manager);
    const customer = await db.getRepository(Customer).save({name:'Reset test'});
    const device = await db.getRepository(Device).save({hostname:'Reset fixture', mgmtIp:'192.0.2.1', customerId:customer.id});
    await db.getRepository(DeviceCredential).save({deviceId:device.id, username:'test', passwordEncrypted:'test-only-placeholder'});
    await db.getRepository(ConfigProfile).save({deviceId:device.id});
    const job = await db.getRepository(Job).save({deviceId:device.id, status:'running'});
    await db.getRepository(AuditLog).save({deviceId:device.id, action:'test'});
    await assert.rejects(service.reset('wrong'), error => error.getStatus() === 400);
    for (const config of [{NODE_ENV:'production'}, {NODE_ENV:'test', DEVELOPMENT_TOOLS_ENABLED:'false'}]) {
      await assert.rejects(new DevelopmentService(db, new ConfigService(config)).reset('RESET DATABASE'), error => error.getStatus() === 403);
    }
    await assert.rejects(service.reset('RESET DATABASE'), error => error.getStatus() === 409);
    assert.equal(await db.getRepository(Customer).count(), 1);
    await db.getRepository(Job).update(job.id, {status:'failed'});
    // Unexpected dependent tables must cause a rollback, never a cascading deletion.
    await db.query('CREATE TABLE reset_dependency (id int PRIMARY KEY, customer_id uuid REFERENCES customers(id))');
    await db.query('INSERT INTO reset_dependency VALUES (1, $1)', [customer.id]);
    await assert.rejects(service.reset('RESET DATABASE'));
    assert.equal(await db.getRepository(Customer).count(), 1);
    assert.equal(await db.getRepository(DeviceCredential).count(), 1);
    await db.query('DROP TABLE reset_dependency');
    const result = await service.reset('RESET DATABASE');
    assert.equal(result.removed.length, 7);
    assert.ok(result.removed.every(row => row.count === (row.label === 'Profiles' ? 3 : 1)));
    const diagnostics = await service.diagnostics();
    assert.ok(diagnostics.inventory.every(row => row.count === (row.label === 'Profiles' ? 3 : 0)));
    assert.equal(diagnostics.activeJobs, 0);
    assert.equal(JSON.stringify(diagnostics).includes('test-only-placeholder'), false);
    const firstAudit = await db.getRepository(AuditLog).save({action:'sequence-reset-check'});
    assert.equal(firstAudit.id, 1);
    await service.reset('RESET DATABASE');
    assert.ok((await service.reset('RESET DATABASE')).removed.every(row => row.count === (row.label === 'Profiles' ? 3 : 0)));
  } finally {
    if (db?.isInitialized) await db.destroy();
    if (created) await admin.query(`DROP DATABASE "${temporaryDatabase}"`);
    await admin.end();
  }
});
