const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DiscoveryService } = require('../dist-test/discovery/discovery.service');
const { parseNeighbor } = require('../dist-test/discovery/mndp');
const { DiscoverDto } = require('../dist-test/discovery/dto/discover.dto');
const { validate } = require('class-validator');

const tlv = (type, value) => {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(type); header.writeUInt16BE(data.length, 2);
  return Buffer.concat([header, data]);
};
test('MNDP decodes identity, MAC, model and IPv4; rejects malformed packets', () => {
  const packet = Buffer.concat([Buffer.alloc(4), tlv(1, Buffer.from('aabbcc001122', 'hex')), tlv(5, 'router'), tlv(8, 'MikroTik'), tlv(12, 'hAP'), tlv(17, Buffer.from([192,168,88,1]))]);
  assert.deepEqual(parseNeighbor(packet, '10.0.0.1'), {ip:'192.168.88.1', mac:'AA:BB:CC:00:11:22', hostname:'router', model:'hAP', routerosVersion:undefined, isRouterOs:true, source:'mndp'});
  assert.equal(parseNeighbor(packet.subarray(0, packet.length - 1), '10.0.0.1'), undefined);
  assert.equal(parseNeighbor(Buffer.alloc(4), '10.0.0.1'), undefined);
});
test('CIDR validation prevents invalid and excessively large sweeps', async () => {
  const service = new DiscoveryService();
  assert.deepEqual(service.expandCidr('192.168.88.99/30'), ['192.168.88.97','192.168.88.98']);
  assert.deepEqual(service.expandCidr('192.168.88.1/32'), ['192.168.88.1']);
  assert.deepEqual(service.expandCidr('192.168.88.0/31'), ['192.168.88.0','192.168.88.1']);
  for (const cidr of ['999.1.1.1/24', '10.0.0.0/8', '10.0.0.1/33']) assert.throws(() => service.expandCidr(cidr));
  await assert.rejects(service.discover('10.0.0.0/24', undefined, 0));
  const dto = Object.assign(new DiscoverDto(), {identifier: 'auto', concurrency: 0});
  assert.ok((await validate(dto)).length);
});
test('subnet probing does not depend on ICMP and stays within concurrency', async () => {
  const service = new DiscoveryService(); let active = 0, maximum = 0;
  service.pingSweep = () => { throw new Error('ICMP must not gate discovery'); };
  service.probeRouterOs = async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return {isRouterOs: true};
  };
  const results = await service.discover('192.168.88.0/29', undefined, 2);
  assert.equal(results.length, 6); assert.equal(maximum, 2);
});
test('generic HTTP 200/401 is not RouterOS; HTTP WebFig is discoverable without TLS', async () => {
  const service = new DiscoveryService();
  service.httpGet = async () => ({status:401, body:'Unauthorized', auth:'Basic realm="Private"'});
  assert.equal((await service.discover('192.168.88.1'))[0].isRouterOs, false);
  service.httpGet = async url => {
    if (url.startsWith('https')) throw new Error('TLS disabled');
    return url.endsWith('/') ? {status:200, body:'<title>RouterOS router configuration page</title>', auth:''} : {status:401,body:'Unauthorized',auth:''};
  };
  assert.equal((await service.discover('192.168.88.1'))[0].isRouterOs, true);
});
