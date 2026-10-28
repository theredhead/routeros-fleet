const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { ProfilesService } = require('../dist-test/profiles/profiles.service');
const { FleetProfileEntity } = require('../dist-test/entities/fleet-profile.entity');
const { normalizeConfiguration } = require('../dist-test/configuration');

const config = hostname => normalizeConfiguration({identity:{settings:{hostname}}});
test('profiles seed, persist, compose, protect revisions, and preserve source snapshots in an isolated database', async () => {
  const connection={host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USERNAME||'fleet',password:process.env.DB_PASSWORD||'fleet'};
  const database='fleet_profiles_test_'+randomUUID().replaceAll('-','');
  const admin=new Client({...connection,database:process.env.DB_DATABASE||'fleet'});
  await admin.connect(); let db; let created=false;
  try {
    await admin.query(`CREATE DATABASE "${database}"`); created=true;
    db=new DataSource({type:'postgres',host:connection.host,port:connection.port,username:connection.user,password:connection.password,database,synchronize:true,entities:[FleetProfileEntity]});
    await db.initialize();
    const service=new ProfilesService(db);
    await service.onApplicationBootstrap();
    let profiles=await service.list();
    assert.deepEqual(profiles.map(profile=>profile.name),['Bronze','Silver','Gold']);
    assert.ok(profiles.every(profile=>Object.values(profile.configuration).every(group=>Object.keys(group.settings).length===0)));
    const bronze=await service.update(profiles[0].id,{name:'Bronze',description:'Edited baseline',configuration:config('bronze-router'),revision:1});
    await service.onApplicationBootstrap();
    assert.equal((await service.list()).find(profile=>profile.id===bronze.id).configuration.identity.settings.hostname,'bronze-router');
    await assert.rejects(service.remove(bronze.id,bronze.revision),error=>error.getStatus()===400);
    await assert.rejects(service.update(bronze.id,{name:'Renamed',configuration:config('x'),revision:bronze.revision}),error=>error.getStatus()===400);
    const a=await service.create({name:'A',description:'First',configuration:config('first')});
    const b=await service.create({name:'B',description:'Last',configuration:normalizeConfiguration({identity:{settings:{hostname:'last',time:{automaticTimezone:false}}},dhcp:{settings:{servers:[{name:'lan',enabled:false}]}}})});
    await assert.rejects(service.create({name:'a',configuration:{}}),error=>error.getStatus()===409);
    await assert.rejects(service.create({name:'Broken',configuration:{identity:{settings:{badKey:true}}}}),error=>error.getStatus()===400);
    const reopened=await db.getRepository(FleetProfileEntity).findOneBy({id:b.id});
    assert.equal(reopened.configuration.identity.settings.time.automaticTimezone,false);
    const request={sourceIds:[a.id,b.id],strategy:'user-selects',expectedRevisions:{[a.id]:a.revision,[b.id]:b.revision}};
    const pending=await service.combine(request);
    assert.equal(pending.unresolvedPaths.length,1); assert.equal(pending.configuration,undefined);
    await assert.rejects(service.combine({...request,saveAs:{name:'Unresolved'}}),error=>error.getStatus()===400);
    const resolutions={[pending.conflicts[0].path]:b.id};
    const result=await service.combine({...request,resolutions,saveAs:{name:'Combined',description:'Resolved snapshot'}});
    assert.ok(result.savedProfile.id); assert.equal(result.savedProfile.configuration.identity.settings.hostname,'last');
    assert.equal(result.savedProfile.configuration.dhcp.settings.servers[0].enabled,false);
    assert.equal(result.savedProfile.composition.resolutions[pending.conflicts[0].path],b.id);
    assert.equal(result.savedProfile.composition.sources[0].revision,a.revision);
    const renamed=await service.update(result.savedProfile.id,{name:'Combined renamed',description:'Metadata only',configuration:result.configuration,revision:result.savedProfile.revision});
    assert.deepEqual(renamed.composition,result.savedProfile.composition);
    const temporary={id:'temp:one',name:'Temporary',configuration:result.configuration};
    const tempCount=(await service.list()).length;
    const tempResult=await service.combine({sourceIds:[temporary.id,a.id],temporarySources:[temporary],strategy:'first-locks'});
    assert.equal(tempResult.configuration.identity.settings.hostname,'last');
    assert.equal((await service.list()).length,tempCount);
    const updated=await service.update(a.id,{name:'A',configuration:config('new'),revision:a.revision});
    await assert.rejects(service.update(a.id,{name:'A',configuration:config('stale'),revision:a.revision}),error=>error.getStatus()===409);
    await assert.rejects(service.combine({...request,resolutions,saveAs:{name:'Stale'}}),error=>error.getStatus()===409);
    const snapshot=await db.getRepository(FleetProfileEntity).findOneBy({id:result.savedProfile.id});
    assert.equal(snapshot.configuration.identity.settings.hostname,'last');
    assert.equal((await service.list()).find(profile=>profile.id===b.id).configuration.identity.settings.hostname,'last');
    await assert.rejects(service.remove(a.id,a.revision),error=>error.getStatus()===409);
    await service.remove(a.id,updated.revision);
    assert.equal(await db.getRepository(FleetProfileEntity).existsBy({id:a.id}),false);
    const concurrent=await Promise.allSettled([
      service.create({name:'Concurrent',configuration:{}}),service.create({name:'concurrent',configuration:{}}),
    ]);
    assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(concurrent.find(result=>result.status==='rejected').reason.getStatus(),409);
  } finally {
    if(db?.isInitialized) await db.destroy();
    if(created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
});
