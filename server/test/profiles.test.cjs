const { test } = require('node:test');
const assert = require('node:assert/strict');
const { combineProfiles, normalizeConfiguration, emptyConfiguration, validateConfiguration, CONFIGURATION_SECTIONS, defaultSetting } = require('../dist-test/configuration');
const source = (id, settings) => ({id, name:id, revision:1, configuration: normalizeConfiguration(settings)});

test('all eleven sections have metadata and start unmanaged', () => {
  const configuration = emptyConfiguration();
  assert.equal(Object.keys(configuration).length, 11);
  assert.equal(CONFIGURATION_SECTIONS.length, 11);
  assert.deepEqual(validateConfiguration(configuration), []);
  for (const group of Object.values(configuration)) {
    assert.ok(group.sectionTitle); assert.ok(group.sectionContentSummary); assert.deepEqual(group.settings, {});
  }
});
test('profiles accept partial collection entries while requiring stable identity', () => {
  assert.deepEqual(validateConfiguration({dhcp:{settings:{servers:[{name:'lan', enabled:false}]}}}), []);
  assert.ok(validateConfiguration({dhcp:{settings:{servers:[{enabled:false}]}}}).length);
  assert.ok(validateConfiguration({dhcp:{settings:{servers:[{name:'lan'},{name:'lan'}]}}}).some(issue => issue.message.includes('Duplicate')));
  assert.ok(validateConfiguration({identity:{settings:{unknown:true}}}).length);
  assert.ok(validateConfiguration(JSON.parse('{"__proto__":{"polluted":true}}')).length);
  assert.ok(validateConfiguration({management:{settings:{services:[{name:'not-a-service'}]}}}).length);
  assert.ok(validateConfiguration({networking:{settings:{dns:{cacheSizeKiB:-1}}}}).length);
});
test('disjoint fields combine, false and zero survive, and inputs are immutable', () => {
  const sources = [
    source('Bronze', {identity:{settings:{time:{automaticTimezone:false}}}, networking:{settings:{dns:{cacheSizeKiB:0}}}}),
    source('Silver', {identity:{settings:{hostname:'router', time:{timezone:'Europe/Amsterdam'}}}}),
  ];
  const before = structuredClone(sources);
  const result = combineProfiles(sources, 'first-locks');
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.configuration.identity.settings.time.automaticTimezone, false);
  assert.equal(result.configuration.networking.settings.dns.cacheSizeKiB, 0);
  assert.equal(result.configuration.identity.settings.time.timezone, 'Europe/Amsterdam');
  assert.deepEqual(sources, before);
  result.configuration.identity.settings.hostname='changed';
  assert.deepEqual(sources, before);
});
test('first locks, last wins and user selects resolve each conflicting scalar', () => {
  const sources = [source('a', {identity:{settings:{hostname:'a', time:{timezone:'UTC'}}}}), source('b', {identity:{settings:{hostname:'b', time:{timezone:'Europe/Amsterdam'}}}})];
  assert.equal(combineProfiles(sources, 'first-locks').configuration.identity.settings.hostname, 'a');
  assert.equal(combineProfiles(sources, 'last-wins').configuration.identity.settings.hostname, 'b');
  assert.equal(combineProfiles([...sources].reverse(), 'first-locks').configuration.identity.settings.hostname, 'b');
  const pending=combineProfiles(sources,'user-selects');
  assert.equal(pending.configuration, undefined); assert.equal(pending.unresolvedPaths.length,2);
  const resolved=combineProfiles(sources,'user-selects',{'/identity/settings/hostname':'b','/identity/settings/time/timezone':'a'});
  assert.equal(resolved.configuration.identity.settings.hostname,'b'); assert.equal(resolved.configuration.identity.settings.time.timezone,'UTC');
  assert.equal(combineProfiles(sources,'user-selects',{'/identity/settings/hostname':'unknown'}).unresolvedPaths.length,2);
});
test('named entries merge by identity with field-level conflicts, never by array position', () => {
  const sources=[
    source('a',{dhcp:{settings:{servers:[{name:'lan',enabled:false,leaseTime:'1d'},{name:'guest',enabled:true}]}}}),
    source('b',{dhcp:{settings:{servers:[{name:'guest',interfaceName:'guest-bridge'},{name:'lan',interfaceName:'bridge',leaseTime:'10m'}]}}}),
  ];
  const result=combineProfiles(sources,'last-wins');
  assert.equal(result.conflicts.length,1); assert.match(result.conflicts[0].path,/leaseTime$/);
  assert.deepEqual(result.configuration.dhcp.settings.servers,[{name:'lan',interfaceName:'bridge',enabled:false,leaseTime:'10m'},{name:'guest',interfaceName:'guest-bridge',enabled:true}]);
  assert.deepEqual(validateConfiguration(result.configuration),[]);
});
test('primitive lists and explicit empty collections are deliberate whole-field conflicts', () => {
  const a=source('a',{networking:{settings:{dns:{servers:[]}}},dhcp:{settings:{servers:[]}}});
  const b=source('b',{networking:{settings:{dns:{servers:['1.1.1.1']}}},dhcp:{settings:{servers:[{name:'lan'}]}}});
  const first=combineProfiles([a,b],'first-locks');
  assert.equal(first.conflicts.length,2); assert.deepEqual(first.configuration.dhcp.settings.servers,[]);
  assert.deepEqual(first.configuration.networking.settings.dns.servers,[]);
  assert.equal(combineProfiles([a,b],'last-wins').configuration.dhcp.settings.servers.length,1);
});
test('incompatible discriminated variants resolve as a unit, avoiding mixed invalid objects', () => {
  const a=source('a',{firewall:{settings:{filterRules:[{key:'rule',action:{type:'drop'}}]}}});
  const b=source('b',{firewall:{settings:{filterRules:[{key:'rule',action:{type:'jump',targetChain:'custom'}}]}}});
  const result=combineProfiles([a,b],'first-locks');
  assert.deepEqual(result.configuration.firewall.settings.filterRules[0].action,{type:'drop'});
  assert.equal(result.conflicts.length,1);
  assert.deepEqual(validateConfiguration(result.configuration),[]);
});
test('equivalent values ignore object-key order and paths escape user-supplied names', () => {
  const a=source('a',{dhcp:{settings:{servers:[{name:'lan/~special',enabled:true}]}}});
  const b=source('b',{dhcp:{settings:{servers:[{enabled:false,name:'lan/~special'}]}}});
  const pending=combineProfiles([a,b],'user-selects');
  assert.ok(pending.conflicts[0].path.includes('~1~0special'));
  const result=combineProfiles([a,b],'user-selects',{[pending.conflicts[0].path]:'b'});
  assert.equal(result.configuration.dhcp.settings.servers[0].enabled,false);
});
test('temporary results can themselves be composed without persisting anything', () => {
  const a=source('a',{identity:{settings:{hostname:'base'}}});
  const b=source('b',{identity:{settings:{time:{timezone:'UTC'}}}});
  const temporary={id:'temp:one',name:'Temporary',configuration:combineProfiles([a,b],'first-locks').configuration};
  const c=source('c',{identity:{settings:{hostname:'override'}}});
  assert.equal(combineProfiles([temporary,c],'last-wins').configuration.identity.settings.hostname,'override');
  assert.throws(()=>combineProfiles([a,a],'first-locks'));
});
