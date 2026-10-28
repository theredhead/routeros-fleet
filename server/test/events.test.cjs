require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {FleetEventsSubscriber} = require('../dist-test/events/fleet-events.subscriber');
const {FleetEventsService} = require('../dist-test/events/fleet-events.service');

test('live invalidations publish only committed topics, preserve outer transactions, and contain no entity values', () => {
  const published = [];
  const subscriber = new FleetEventsSubscriber({subscribers: []}, {publish: topics => published.push(topics)});
  const queryRunner = {isTransactionActive: true};
  const transaction = {queryRunner};
  const event = tableName => ({queryRunner, metadata: {tableName}, entity: {password: 'secret'}});
  subscriber.afterTransactionStart(transaction);
  subscriber.afterInsert(event('customers'));
  subscriber.afterInsert(event('customers'));
  assert.deepEqual(published, []);
  subscriber.afterTransactionStart(transaction);
  subscriber.afterUpdate(event('profiles'));
  subscriber.afterTransactionRollback(transaction);
  queryRunner.isTransactionActive = false;
  subscriber.afterTransactionCommit(transaction);
  assert.deepEqual(published, [['customers', 'devices']]);
  queryRunner.isTransactionActive = true;
  subscriber.afterTransactionStart(transaction);
  subscriber.afterInsert(event('jobs'));
  subscriber.afterTransactionRollback(transaction);
  assert.equal(published.length, 1);
  queryRunner.isTransactionActive = false;
  subscriber.afterUpdate(event('jobs'));
  assert.deepEqual(published[1], ['jobs']);
});

test('SSE streams resynchronize on connection and broadcast only topic identifiers', () => {
  const service = new FleetEventsService();
  const received = [];
  const subscription = service.stream().subscribe(event => received.push(event));
  service.publish(['forms', 'forms']);
  assert.equal(received[0].type, 'ready');
  assert.deepEqual(received[1], {type: 'change', data: {topics: ['forms', 'diagnostics']}});
  subscription.unsubscribe(); service.onModuleDestroy();
});
