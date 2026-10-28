const {test} = require('node:test');
const assert = require('node:assert/strict');
const {schemaError} = require('../dist-test/forms/form-schema-validation');
const schema = () => ({id: 'customer', groups: [{id: 'details', fields: [{id: 'name', title: 'Name', component: 'text', validation: [{type: 'required'}]}]}]});

test('form schema validation accepts layouts and rejects duplicate bindings and malformed rules', () => {
  assert.equal(schemaError(schema(), 'customer'), undefined);
  assert.match(schemaError(schema(), 'other'), /ID/);
  const duplicate = schema(); duplicate.groups[0].fields.push({...duplicate.groups[0].fields[0]});
  assert.match(schemaError(duplicate, 'customer'), /unique/);
  const malformed = schema(); malformed.groups[0].fields[0].validation = [{type: 'pattern', params: {pattern: '['}}];
  assert.match(schemaError(malformed, 'customer'), /regular expression/);
  assert.ok(schemaError({id: 'customer', groups: 'bad'}, 'customer'));
  assert.ok(schemaError({id: 'customer', groups: [{id: 'x', fields: [{id: 'name', component: 'text', options: {}}]}]}, 'customer'));
});
