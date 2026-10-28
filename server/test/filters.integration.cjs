require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {Client} = require('pg');
const {DataSource} = require('typeorm');
const {SavedFilterEntity} = require('../dist-test/filters/saved-filter.entity');
const {FiltersController} = require('../dist-test/filters/filters.controller');

test('named filters persist per overview, reload exactly, and reject stale updates and deletes', async () => {
  const connection = {host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || 'fleet', password: process.env.DB_PASSWORD || 'fleet'};
  const database = 'fleet_filters_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database: process.env.DB_DATABASE || 'fleet'});
  await admin.connect();
  let db;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    db = new DataSource({type: 'postgres', host: connection.host, port: connection.port, username: connection.user, password: connection.password, database, synchronize: true, entities: [SavedFilterEntity]});
    await db.initialize();
    const controller = new FiltersController(db.getRepository(SavedFilterEntity));
    const expression = {junction: 'or', rules: [{id: 1, field: 'name', operator: 'contains', value: 'Fixture'}, {id: 2, field: 'contactEmail', operator: 'isEmpty', value: ''}]};
    const first = await controller.create({view: 'customers', name: 'My filter', expression});
    const reloaded = await new FiltersController(db.getRepository(SavedFilterEntity)).get(first.id);
    assert.deepEqual(reloaded.expression, expression); assert.equal(reloaded.revision, 1);
    assert.equal((await controller.list('profiles')).length, 0);
    assert.equal((await controller.list('customers')).length, 1);
    await assert.rejects(controller.create({view: 'customers', name: 'My filter', expression}), error => error.getStatus() === 409);
    await assert.rejects(controller.create({view: 'profiles', name: 'Wrong fields', expression}), error => error.getStatus() === 400);
    await controller.create({view: 'profiles', name: 'My filter', expression: {junction: 'and', rules: []}});
    const updated = await controller.update(first.id, {view: 'customers', name: 'Renamed', expression: {junction: 'and', rules: []}, revision: 1});
    assert.equal(updated.revision, 2);
    await assert.rejects(controller.update(first.id, {view: 'customers', name: 'Stale', expression, revision: 1}), error => error.getStatus() === 409);
    await assert.rejects(controller.remove(first.id, 1), error => error.getStatus() === 409);
    await controller.remove(first.id, 2);
    assert.equal((await controller.list('customers')).length, 0);
    assert.equal((await controller.list('profiles')).length, 1);
  } finally {
    if (db?.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
