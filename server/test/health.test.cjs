require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {HealthController} = require('../dist-test/health.controller');

test('health reports availability independently of configuration integrity checks', async () => {
  const controller = new HealthController({query: async () => []});
  assert.equal((await controller.check()).status, 'ok');
  const degraded = new HealthController({query: async () => {throw new Error('unavailable');}});
  await assert.rejects(degraded.check(), error => error.getStatus() === 503);
});
