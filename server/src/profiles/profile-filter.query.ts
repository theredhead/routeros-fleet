import { BadRequestException } from '@nestjs/common';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { PROFILE_FILTER_FIELDS, PROFILE_FILTER_OPERATORS, ProfileFilter, ProfileFilterRule } from '../configuration';
import { FleetProfileEntity } from '../entities/fleet-profile.entity';

/** Translate the public, allowlisted filter into parameterized PostgreSQL predicates. */
export function applyProfileFilter(query: SelectQueryBuilder<FleetProfileEntity>, filter: ProfileFilter): void {
  if (!filter || !['and', 'or'].includes(filter.junction) || !Array.isArray(filter.rules) || filter.rules.length > 30) {
    throw new BadRequestException('Invalid profile filter.');
  }
  for (const rule of filter.rules) {
    if (!PROFILE_FILTER_FIELDS.includes(rule.field) || !PROFILE_FILTER_OPERATORS.includes(rule.operator) || typeof rule.value !== 'string' || rule.value.length > 2000) {
      throw new BadRequestException('Unsupported profile filter field or operator.');
    }
  }
  if (!filter.rules.length) return;
  query.andWhere(new Brackets(group => {
    filter.rules.forEach((rule, index) => {
      const fields = rule.field === '__any__' ? ['name', 'description'] : [rule.field];
      const predicate = new Brackets(anyField => {
        fields.forEach(field => {
          const {sql, value} = comparison(`LOWER(COALESCE(profile."${field}", ''))`, rule, `filter${index}`);
          anyField.orWhere(sql, value === undefined ? {} : {[`filter${index}`]: value});
        });
      });
      if (filter.junction === 'and') group.andWhere(predicate); else group.orWhere(predicate);
    });
  }));
}
function comparison(column: string, rule: ProfileFilterRule, parameter: string): {sql: string; value?: string} {
  const value = rule.value.toLowerCase();
  // User-supplied %, _ and backslashes are text, not wildcard or escape instructions.
  const literal = value.replace(/[\\%_]/g, character => `\\${character}`);
  switch (rule.operator) {
    case 'isEmpty': return {sql: `${column} = ''`};
    case 'isNotEmpty': return {sql: `${column} != ''`};
    case 'equals': return {sql: `${column} = :${parameter}`, value};
    case 'notEquals': return {sql: `${column} != :${parameter}`, value};
    case 'contains': return {sql: `${column} LIKE :${parameter}`, value: `%${literal}%`};
    case 'notContains': return {sql: `${column} NOT LIKE :${parameter}`, value: `%${literal}%`};
    case 'startsWith': return {sql: `${column} LIKE :${parameter}`, value: `${literal}%`};
    case 'endsWith': return {sql: `${column} LIKE :${parameter}`, value: `%${literal}`};
  }
}
