require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');
const {DataSource} = require('typeorm');
const {FormSchemaEntity} = require('../dist-test/forms/form-schema.entity');
const {FormsController} = require('../dist-test/forms/forms.controller');

test('form designs persist across reloads, reject stale writes, and restore defaults in an isolated database', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_forms_test_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    db = new DataSource({type: 'postgres', host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [FormSchemaEntity]});
    await db.initialize();
    const controller = new FormsController(db.getRepository(FormSchemaEntity));
    const schema = {id: 'customer', groups: [{id: 'details', fields: [{id: 'name', title: 'Company', component: 'text'}]}]};
    const first = await controller.save('customer', {schema, revision: 0});
    assert.equal(first.revision, 1);
    assert.equal((await new FormsController(db.getRepository(FormSchemaEntity)).list())[0].schema.groups[0].fields[0].title, 'Company');
    await assert.rejects(controller.save('customer', {schema, revision: 0}), error => error.getStatus() === 409);
    const next = await controller.save('customer', {schema: {...schema, title: 'Customers'}, revision: 1});
    assert.equal(next.revision, 2);
    await assert.rejects(controller.save('customer', {schema, revision: 1}), error => error.getStatus() === 409);
    await assert.rejects(controller.restore('customer', '1'), error => error.getStatus() === 409);
    await assert.rejects(controller.save('customer', {schema: {...schema, id: 'wrong'}, revision: 2}), error => error.getStatus() === 400);
    await controller.restore('customer', '2');
    assert.deepEqual(await controller.list(), []);
  } finally {
    if (db?.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
