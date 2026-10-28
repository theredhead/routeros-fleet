require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');
const {DataSource} = require('typeorm');
const {Module} = require('@nestjs/common');
const {NestFactory} = require('@nestjs/core');
const {FleetEventsModule} = require('../dist-test/events/fleet-events.module');
const {Customer} = require('../dist-test/entities/customer.entity');
const {Device} = require('../dist-test/entities/device.entity');
const {DeviceCredential} = require('../dist-test/entities/device-credential.entity');
const {ConfigProfile} = require('../dist-test/entities/config-profile.entity');
const {FleetEventsService} = require('../dist-test/events/fleet-events.service');

test('HTTP SSE broadcasts a committed database update and ignores rolled-back changes', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_events_test_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db, app, reader;
  const abort = new AbortController();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    db = new DataSource({type: 'postgres', host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [Customer, Device, DeviceCredential, ConfigProfile]});
    await db.initialize();
    class TestDatabaseModule {}
    Module({providers: [{provide: DataSource, useValue: db}], exports: [DataSource]})(TestDatabaseModule);
    const {Global} = require('@nestjs/common'); Global()(TestDatabaseModule);
    class TestAppModule {}
    Module({imports: [TestDatabaseModule, FleetEventsModule]})(TestAppModule);
    app = await NestFactory.create(TestAppModule, {logger: false});
    await app.listen(0, '127.0.0.1');
    const response = await fetch((await app.getUrl()) + '/events', {signal: abort.signal});
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const waitFor = async pattern => {
      const timeout = AbortSignal.timeout(3000);
      while (!pattern.test(text)) {
        const result = await Promise.race([reader.read(), new Promise((_, reject) => timeout.addEventListener('abort', () => reject(new Error('SSE timed out')), {once: true}))]);
        if (result.done) throw new Error('Stream ended');
        text += decoder.decode(result.value);
      }
    };
    await waitFor(/event: ready/);
    const observed = [];
    const subscription = app.get(FleetEventsService).stream().subscribe(event => { if (event.type === 'change') observed.push(event); });
    await assert.rejects(db.transaction(async manager => {
      await manager.save(Customer, manager.create(Customer, {name: 'Rolled back'}));
      throw new Error('Rollback fixture');
    }));
    assert.deepEqual(observed, []);
    await db.transaction(async manager => {
      await manager.save(Customer, manager.create(Customer, {name: 'Committed fixture'}));
      assert.deepEqual(observed, []);
    });
    await waitFor(/event: change/);
    assert.match(text, /customers/);
    assert.doesNotMatch(text, /Committed fixture|Rolled back/);
    subscription.unsubscribe();
  } finally {
    abort.abort(); if (reader) await reader.cancel().catch(() => {});
    if (app) await app.close();
    if (db?.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
