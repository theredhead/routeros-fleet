require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const {generateKeyPairSync} = require('node:crypto');
const {mkdtempSync, readFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {execFileSync} = require('node:child_process');
const {Server: SshServer} = require('ssh2');
const {CommunicationService} = require('../dist-test/communication/communication.service');
const {RouterOsClientService} = require('../dist-test/routeros/router-os-client.service');
const {RestStrategy} = require('../dist-test/communication/strategies/rest.strategy');
const {ApiStrategy} = require('../dist-test/communication/strategies/api.strategy');
const {SshStrategy} = require('../dist-test/communication/strategies/ssh.strategy');
const {encodeWord, decodeWord} = require('../dist-test/communication/strategies/api-codec');

test('all five transports probe without passwords, verify login and download exact binary backups; TLS and SSH trust are enforced', {timeout: 30000}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fleet-transport-'));
  const servers = [];
  const bytes = Buffer.from(Array.from({length: 40000}, (_, index) => index % 256));
  let logins = 0;
  const script = value => {
    if (value.includes('/system/resource/print')) return JSON.stringify([{version: '7.26', 'board-name': 'fixture'}]);
    if (value.includes('/system/backup/save')) return '';
    if (value.includes(' size]')) return String(bytes.length);
    if (value.includes('/file remove')) return 'removed';
    const offset = Number(value.match(/offset=(\d+)/)?.[1]);
    const length = Number(value.match(/chunk-size=(\d+)/)?.[1]);
    if (Number.isFinite(offset) && Number.isFinite(length)) return bytes.subarray(offset, offset + length).toString('hex');
    throw new Error('Unexpected fixture script');
  };
  const command = (path, parameters) => {
    if (path === '/system/resource/print') return [{version: '7.26', 'board-name': 'fixture'}];
    if (path === '/system/backup/save') return [];
    if (path === '/execute') return [{ret: script(parameters.script)}];
    if (path.endsWith('/print')) return [{'.id': '*1', name: 'fixture'}];
    if (path.endsWith('/add')) return [{ret: '*2'}];
    return [];
  };
  async function listen(server) {
    servers.push(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return server.address().port;
  }
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], {stdio: 'ignore'});
    const certificate = {key: readFileSync(join(directory, 'key.pem')), cert: readFileSync(join(directory, 'cert.pem'))};
    const restHandler = async (request, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (!request.headers.authorization) {response.writeHead(401, {'WWW-Authenticate': 'Basic realm="RouterOS"'}); response.end('{}'); return;}
      logins++;
      if (request.headers.authorization !== 'Basic ' + Buffer.from('operator:secret').toString('base64')) {response.writeHead(401); response.end('{}'); return;}
      let body = ''; for await (const chunk of request) body += chunk;
      response.end(JSON.stringify(command(request.url.replace('/rest', ''), JSON.parse(body || '{}'))));
    };
    const httpPort = await listen(http.createServer(restHandler));
    const httpsPort = await listen(https.createServer(certificate, restHandler));
    const nativeHandler = socket => {
      socket.on('error', () => {});
      let buffer = Buffer.alloc(0), words = [], authenticated = false;
      const send = (kind, row = {}) => socket.write(Buffer.concat([kind, ...Object.entries(row).map(([key, value]) => `=${key}=${value}`), ''].map(encodeWord)));
      socket.on('data', data => {
        buffer = Buffer.concat([buffer, data]);
        let word;
        while ((word = decodeWord(buffer))) {
          buffer = buffer.subarray(word.bytes);
          if (word.word) {words.push(word.word); continue;}
          const path = words[0], parameters = {};
          for (const value of words.slice(1)) {const separator = value.indexOf('=', 1); parameters[value.slice(1, separator)] = value.slice(separator + 1);}
          words = [];
          if (path === '/login') {
            if (!Object.hasOwn(parameters, 'password')) {send('!done', {ret: 'challenge'}); continue;}
            logins++;
            authenticated = parameters.name === 'operator' && parameters.password === 'secret';
            if (!authenticated) send('!trap', {message: 'login rejected'});
            send('!done'); continue;
          }
          if (!authenticated) {send('!fatal', {message: 'not logged in'}); continue;}
          for (const row of command(path, parameters)) send('!re', row);
          send('!done');
        }
      });
    };
    const apiPort = await listen(net.createServer(nativeHandler));
    const apiTlsPort = await listen(tls.createServer(certificate, nativeHandler));
    const privateKey = generateKeyPairSync('rsa', {modulusLength: 2048}).privateKey.export({format: 'pem', type: 'pkcs1'});
    const ssh = new SshServer({hostKeys: [privateKey]}, connection => {
      connection.on('error', () => {});
      connection.on('authentication', context => {
        if (context.method === 'password') {logins++; if (context.username === 'operator' && context.password === 'secret') context.accept(); else context.reject();}
        else context.reject(['password']);
      });
      connection.on('ready', () => connection.on('session', accept => accept().on('exec', (acceptExec, _reject, info) => {
        const stream = acceptExec();
        const marker = info.command.match(/fleet_completed_[a-f0-9]+/)?.[0];
        stream.write(script(info.command) + '\r\n' + marker + '\r\n'); stream.exit(0); stream.end();
      })));
    });
    const sshPort = await listen(ssh);
    const strategies = [new RestStrategy('https-rest'), new SshStrategy(), new ApiStrategy('api-tls'), new RestStrategy('http-rest'), new ApiStrategy('api')];
    const ports = {'https-rest': httpsPort, ssh: sshPort, 'api-tls': apiTlsPort, 'http-rest': httpPort, api: apiPort};
    const credentials = {host: '127.0.0.1', username: 'operator', password: 'secret'};
    for (const strategy of strategies) {
      const method = {id: strategy.id, port: ports[strategy.id], enabled: true, acceptSelfSignedCertificates: false};
      const untrusted = await strategy.probe(credentials.host, method);
      if (['https-rest', 'api-tls'].includes(strategy.id)) assert.equal(untrusted.status, 'certificate-untrusted');
      method.acceptSelfSignedCertificates = true;
      const probe = await strategy.probe(credentials.host, method);
      assert.notEqual(probe.status, 'unavailable', strategy.id);
      assert.equal(logins, 0, 'pre-login probes must not send passwords');
    }
    for (const strategy of strategies) {
      const method = {id: strategy.id, port: ports[strategy.id], enabled: true, acceptSelfSignedCertificates: true};
      const probe = await strategy.probe(credentials.host, method);
      const policy = {methods: [method], sshHostKeyFingerprint: probe.sshHostKeyFingerprint};
      const service = new CommunicationService({resolve: async override => override}, strategies);
      const client = new RouterOsClientService(service);
      const login = await client.verifyLogin({...credentials, communication: policy});
      assert.equal(login.version, '7.26', strategy.id);
      assert.equal(login.communication.selectedStrategy, strategy.id);
      assert.deepEqual(await client.captureInitialBackup({...credentials, communication: policy}), bytes, strategy.id);
      if (strategy.id === 'ssh') {
        await assert.rejects(client.verifyLogin({...credentials, communication: {...policy, sshHostKeyFingerprint: 'SHA256:' + 'a'.repeat(43)}}));
      }
    }
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    rmSync(directory, {recursive: true, force: true});
  }
});
