require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {plainToInstance} = require('class-transformer');
const {validate} = require('class-validator');
const {UpdateDeviceDto} = require('../dist-test/devices/dto/update-device.dto');

test('device metadata edits validate names and addresses, allow unassignment, and exclude credentials', async () => {
  const valid = plainToInstance(UpdateDeviceDto, {hostname: '  Router  ', mgmtIp: '192.0.2.1', customerId: null, macAddress: null, username: 'ignored', password: 'ignored'});
  assert.deepEqual(await validate(valid, {whitelist: true}), []);
  assert.equal(valid.hostname, 'Router');
  assert.equal(valid.password, undefined); assert.equal(valid.username, undefined);
  for (const invalid of [{hostname: ''}, {hostname: '   '}, {hostname: null}, {mgmtIp: null}, {mgmtIp: 'invalid'}, {customerId: 'unknown'}, {macAddress: 'invalid'}]) {
    assert.ok((await validate(plainToInstance(UpdateDeviceDto, invalid))).length);
  }
});
