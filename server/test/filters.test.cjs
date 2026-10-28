require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {filterError} = require('../dist-test/filters/filter-definition');
const expression = (field = 'name', operator = 'contains', value = 'Acme') => ({junction: 'and', rules: [{id: 1, field, operator, value}]});

test('saved overview filters validate their view, fields, operators, ranges and rule identities', () => {
  assert.equal(filterError('customers', expression()), undefined);
  assert.equal(filterError('devices', expression('customerName')), undefined);
  assert.equal(filterError('profiles', expression('__any__')), undefined);
  assert.equal(filterError('diagnostics-inventory', expression('count', 'greaterThan', '2')), undefined);
  const range = expression('count', 'between', '1'); range.rules[0].valueTo = '10';
  assert.equal(filterError('diagnostics-inventory', range), undefined);
  for (const [view, filter] of [
    ['unknown', expression()], ['profiles', expression('contactEmail')], ['customers', expression('name', 'greaterThan')],
    ['customers', {...expression(), rules: [...expression().rules, ...expression().rules]}],
    ['diagnostics-inventory', expression('count', 'greaterThan', 'NaN')],
    ['diagnostics-inventory', expression('count', 'between', '1')],
    ['customers', {junction: 'sql', rules: []}],
  ]) assert.ok(filterError(view, filter));
});
