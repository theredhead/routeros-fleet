require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {plainToInstance} = require('class-transformer');
const {validate} = require('class-validator');
const {encodeWord, decodeWord} = require('../dist-test/communication/strategies/api-codec');
const {CommunicationService} = require('../dist-test/communication/communication.service');
const {RouterOsClientService} = require('../dist-test/routeros/router-os-client.service');
const {CommunicationSettingsService} = require('../dist-test/communication/communication-settings.service');
const {SaveCommunicationSettingsDto, DeviceCommunicationDto} = require('../dist-test/communication/communication.dto');
const {DEFAULT_METHODS} = require('../dist-test/communication/communication-types');
const {routerString} = require('../dist-test/communication/strategies/ssh.strategy');

test('API words survive fragmented frames and boundary lengths', () => {
  for (const length of [0, 1, 127, 128, 16383, 16384, 65536]) {
    const word = 'x'.repeat(length), encoded = encodeWord(word);
    assert.equal(decodeWord(encoded).word, word);
    assert.equal(decodeWord(encoded.subarray(0, encoded.length - 1)), undefined);
  }
  assert.throws(() => decodeWord(Buffer.from([0xff])));
  assert.match(routerString('"; :error $password\n'), /^"(?:\\[0-9a-f]{2})+"$/);
});

test('selection preserves configured order, closes failed sessions and never replays an uncertain write', async () => {
  const attempts = [];
  const methods = DEFAULT_METHODS.slice(0, 2);
  let closed = 0, mutations = 0;
  const session = {command: async path => {if (path.endsWith('/print')) return [{version: '7.26'}]; mutations++; throw new Error('uncertain result');}, close: () => closed++};
  const registry = [
    {id: 'https-rest', connect: async () => {attempts.push('https-rest'); throw new Error('password=secret');}},
    {id: 'ssh', connect: async () => {attempts.push('ssh'); return session;}},
  ];
  const service = new CommunicationService({resolve: async () => ({methods})}, registry);
  const selected = await service.select({}); assert.equal(selected.communication.selectedStrategy, 'ssh'); selected.session.close();
  assert.deepEqual(attempts, ['https-rest', 'ssh']);
  const client = new RouterOsClientService(service);
  await assert.rejects(client.set({}, 'ip/pool', '*1', {name: 'test'}));
  assert.equal(mutations, 1); assert.equal(closed, 2);
  const failed = new CommunicationService({resolve: async () => ({methods: [methods[0]]})}, registry);
  await assert.rejects(failed.select({}), error => !JSON.stringify(error.getResponse()).includes('password=secret'));
});

test('globally disabled methods are excluded and settings reject all-disabled and stale writes', async () => {
  const settings = new CommunicationSettingsService({findOneBy: async () => null, update: async () => ({affected: 0})});
  const resolved = await settings.resolve({methods: [...DEFAULT_METHODS].reverse().map(method => ({...method, enabled: true}))});
  assert.deepEqual(resolved.methods.map(method => method.id), ['api-tls', 'ssh', 'https-rest']);
  await assert.rejects(settings.save({methods: DEFAULT_METHODS.map(method => ({...method, enabled: false})), revision: 0}), error => error.getStatus() === 400);
  await assert.rejects(settings.save({methods: DEFAULT_METHODS, revision: 1}), error => error.getStatus() === 409);
});

test('settings validate strategy identities, duplicate methods, ports and explicit certificate trust', async () => {
  assert.deepEqual(await validate(plainToInstance(SaveCommunicationSettingsDto, {methods: DEFAULT_METHODS, revision: 0})), []);
  for (const methods of [[{...DEFAULT_METHODS[0], port: 0}], [{...DEFAULT_METHODS[0], id: 'unsupported'}], [DEFAULT_METHODS[0], DEFAULT_METHODS[0]], [{...DEFAULT_METHODS[0], acceptSelfSignedCertificates: 'true'}]]) {
    assert.ok((await validate(plainToInstance(DeviceCommunicationDto, {methods}))).length);
  }
});
