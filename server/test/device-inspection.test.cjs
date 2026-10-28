require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {inspectRouter, redactDeviceData} = require('../dist-test/devices/device-inspection');
const {DeviceInspectionService} = require('../dist-test/devices/device-inspection.service');

test('inspection uses only read commands, redacts sensitive fields, and keeps partial results without raw errors', async () => {
  const paths = []; let closed = false;
  const session = {close: () => {closed = true;}, command: async path => {
    paths.push(path);
    if (path.includes('/wireless/')) throw new Error('password=do-not-expose');
    return [{name: 'interface', 'private-key': 'private-data', password: 'do-not-expose', nested: {token: 'hidden', mtu: 1500}}];
  }};
  const snapshot = await inspectRouter({select: async () => ({session, resource: {version: '7.26'}, communication: {selectedStrategy: 'ssh'}})}, {});
  assert.ok(paths.length > 20); assert.ok(paths.every(path => path.endsWith('/print')));
  assert.equal(snapshot.menus['interface/wireless'].status, 'unavailable');
  assert.equal(snapshot.menus.interface.data[0]['private-key'], '[redacted]');
  assert.equal(snapshot.menus.interface.data[0].nested.mtu, 1500);
  assert.ok(!JSON.stringify(snapshot).includes('do-not-expose')); assert.equal(closed, true);
  assert.equal(redactDeviceData(new Date('2026-01-01')).slice(0, 10), '2026-01-01');
});

test('stored details redact history and remain available when no credentials or router connectivity exist', async () => {
  const devices = {findOne: async () => ({id: 'device', mgmtIp: '192.0.2.1', enrollmentTokenHash: 'private-token'})};
  const history = {findAndCount: async () => [[{result: {password: 'private-password'}}], 123]};
  const credentials = {findOneBy: async () => null};
  const service = new DeviceInspectionService(devices, {decrypt: () => 'secret'}, {select: async () => {throw new Error('secret');}}, credentials, history, history);
  const stored = await service.stored('device');
  assert.equal(stored.jobs.total, 123); assert.equal(stored.jobs.limit, 100);
  assert.ok(!JSON.stringify(stored).includes('private-password'));
  assert.equal((await service.live('device')).status, 'unavailable');
  credentials.findOneBy = async () => ({username: 'operator', passwordEncrypted: 'encrypted'});
  assert.ok(!JSON.stringify(await service.live('device')).includes('secret'));
});
