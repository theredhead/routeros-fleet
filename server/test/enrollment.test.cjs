require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {plainToInstance} = require('class-transformer');
const {validate} = require('class-validator');
const {CreateDeviceDto} = require('../dist-test/devices/dto/create-device.dto');
const {captureInitialBackup} = require('../dist-test/communication/initial-backup');

test('enrollment requires a username and explicit password, allowing an empty password', async () => {
  const base = {hostname: 'router', mgmtIp: '192.0.2.1'};
  for (const login of [{}, {username: 'admin'}, {username: '', password: ''}, {username: 'admin', password: null}]) {
    assert.ok((await validate(plainToInstance(CreateDeviceDto, {...base, ...login}))).length);
  }
  assert.deepEqual(await validate(plainToInstance(CreateDeviceDto, {...base, username: 'admin', password: ''})), []);
});

test('binary backup preserves every byte across multiple chunks and removes temporary files', async () => {
  const bytes = Buffer.from(Array.from({length: 40000}, (_, index) => index % 256));
  const commands = [];
  const session = {command: async () => [], execute: async script => {
    commands.push(script);
    if (script.startsWith('/file remove')) return 'removed';
    if (script.includes(' size]')) return String(bytes.length);
    const offset = Number(script.match(/offset=(\d+)/)[1]);
    const length = Number(script.match(/chunk-size=(\d+)/)[1]);
    return bytes.subarray(offset, offset + length).toString('hex');
  }};
  assert.deepEqual(await captureInitialBackup(session), bytes);
  assert.equal(commands.filter(command => command.includes('chunk-size=')).length, 3);
  assert.ok(commands.at(-1).startsWith('/file remove'));
});

test('truncated backup or unsupported file reading fails backup and still attempts cleanup', async () => {
  for (const failure of ['truncated', 'unsupported', 'empty']) {
    let cleaned = false;
    const session = {command: async () => [], execute: async script => {
      if (script.startsWith('/file remove')) {cleaned = true; return 'removed';}
      if (script.includes(' size]')) return failure === 'empty' ? '0' : '100';
      if (failure === 'unsupported') throw new Error('unsupported command');
      return '00';
    }};
    await assert.rejects(captureInitialBackup(session));
    assert.ok(cleaned);
  }
});
