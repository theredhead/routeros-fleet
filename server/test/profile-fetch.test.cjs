require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { FetchProfilesDto } = require('../dist-test/profiles/profile-fetch.dto');

test('fetch request defaults and nested filters are validated before querying', async () => {
  const defaults = plainToInstance(FetchProfilesDto, {});
  assert.equal(defaults.pageIndex,0); assert.equal(defaults.pageSize,25);
  assert.deepEqual(await validate(defaults),[]);
  const valid = {filter:{junction:'or',rules:[{id:1,field:'name',operator:'contains',value:'Bronze'}]},pageIndex:2,pageSize:10};
  assert.deepEqual(await validate(plainToInstance(FetchProfilesDto,valid)),[]);
  for(const invalid of [
    {...valid,pageSize:0}, {...valid,pageSize:101}, {...valid,pageIndex:-1},
    {...valid,filter:{junction:'sql',rules:[]}},
    {...valid,filter:{junction:'and',rules:[{id:1,field:'configuration',operator:'contains',value:'x'}]}},
    {...valid,filter:{junction:'and',rules:[{id:1,field:'name',operator:'runSql',value:'x'}]}},
  ]) assert.ok((await validate(plainToInstance(FetchProfilesDto,invalid))).length);
});
