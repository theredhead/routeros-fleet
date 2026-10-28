const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { ProfilesService } = require('../dist-test/profiles/profiles.service');
const { FleetProfileEntity } = require('../dist-test/entities/fleet-profile.entity');
const { normalizeConfiguration } = require('../dist-test/configuration');

const rule = (field, operator, value = '', id = 1) => ({id, field, operator, value});
const request = (rules = [], junction = 'and', pageIndex = 0, pageSize = 25) => ({filter: {junction, rules}, pageIndex, pageSize});

test('profile fetch requests filter and paginate in SQL; duplication produces independent, uniquely named copies', async () => {
  const connection = {host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USERNAME||'fleet',password:process.env.DB_PASSWORD||'fleet'};
  const database = 'fleet_fetch_test_' + randomUUID().replaceAll('-', '');
  const admin = new Client({...connection, database:process.env.DB_DATABASE||'fleet'});
  await admin.connect(); let db; let created = false;
  try {
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    db = new DataSource({type:'postgres', host:connection.host, port:connection.port, username:connection.user, password:connection.password, database, synchronize:true, entities:[FleetProfileEntity]});
    await db.initialize(); const service = new ProfilesService(db); await service.onApplicationBootstrap();
    const first = await service.fetch(request([], 'and', 0, 2));
    assert.equal(first.totalNumberOfRows, 3); assert.deepEqual(first.rows.map(row => row.name), ['Bronze', 'Silver']);
    assert.deepEqual(Object.keys(first.rows[0]).sort(), ['builtinKey', 'description', 'id', 'name', 'revision']);
    assert.deepEqual((await service.fetch(request([], 'and', 1, 2))).rows.map(row => row.name), ['Gold']);
    assert.deepEqual((await service.fetch(request([rule('__any__', 'contains', 'sILv')]))).rows.map(row => row.name), ['Silver']);
    assert.equal((await service.fetch(request([rule('description', 'isEmpty')]))).totalNumberOfRows, 3);
    assert.equal((await service.fetch(request([rule('description', 'isNotEmpty')]))).totalNumberOfRows, 0);
    const source = await service.create({name:'Office 100%_safe\\name', description:'Primary Branch', configuration:normalizeConfiguration({identity:{settings:{hostname:'original'}},dhcp:{settings:{servers:[{name:'lan',enabled:false}]}}})});
    const filtered = await service.fetch(request([rule('name', 'contains', '100%_safe\\name')]));
    assert.deepEqual(filtered.rows.map(row => row.id), [source.id]);
    assert.equal((await service.fetch(request([rule('name', 'contains', "%' OR 1=1 --")]))).totalNumberOfRows, 0);
    assert.equal((await service.fetch(request([rule('name','startsWith','office'),rule('description','endsWith','BRANCH',2)]))).totalNumberOfRows, 1);
    assert.equal((await service.fetch(request([rule('name','equals','Bronze'),rule('name','equals','Silver',2)],'or'))).totalNumberOfRows, 2);
    assert.equal((await service.fetch(request([rule('name','equals','Bronze'),rule('name','equals','Silver',2)],'and'))).totalNumberOfRows, 0);
    assert.equal((await service.fetch(request([rule('name','notContains','Office')]))).totalNumberOfRows, 3);
    assert.equal((await service.fetch(request([rule('name','notEquals','bronze')]))).totalNumberOfRows, 3);
    await assert.rejects(service.fetch(request([rule('configuration','contains','x')])), error => error.getStatus() === 400);
    await assert.rejects(service.fetch(request([rule('name','executeSql','x')])), error => error.getStatus() === 400);
    await assert.rejects(service.fetch(request([], 'and', -1, 25)), error => error.getStatus() === 400);
    const bronze = (await service.list())[0];
    const baselineCopy = await service.duplicate(bronze.id, bronze.revision);
    assert.equal(baselineCopy.name,'Bronze copy'); assert.equal(baselineCopy.builtinKey,null);
    assert.ok(Object.values(baselineCopy.configuration).every(group => Object.keys(group.settings).length === 0));
    const copies = await Promise.all([service.duplicate(source.id,source.revision), service.duplicate(source.id,source.revision)]);
    assert.deepEqual(copies.map(copy => copy.name).sort(), [source.name + ' copy', source.name + ' copy 2'].sort());
    assert.ok(copies.every(copy => copy.description === source.description && copy.revision === 1 && copy.builtinKey === null));
    assert.deepEqual(copies[0].configuration,source.configuration);
    await service.update(copies[0].id,{name:copies[0].name,description:'Edited copy',configuration:normalizeConfiguration({identity:{settings:{hostname:'changed-copy'}}}),revision:1});
    assert.equal((await service.findOne(source.id)).configuration.identity.settings.hostname,'original');
    await assert.rejects(service.duplicate(copies[0].id,1),error=>error.getStatus()===409);
    assert.equal((await service.findOne(source.id)).configuration.dhcp.settings.servers[0].enabled,false);
    await service.onApplicationBootstrap();
    assert.equal((await service.findOne(source.id)).description,'Primary Branch');
  } finally {
    if(db?.isInitialized) await db.destroy();
    if(created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
});
