import { FilterExpression, toPredicate } from '@theredhead/lucid-kit';
import { OVERVIEW_FIELDS, OverviewKey } from '@fleet/filters';

export const emptyFilter = (): FilterExpression => ({junction: 'and', rules: []});

/** Use LucidKit's predicate compiler, restricted to this overview's declared fields. */
export function filterRows<T>(rows: T[], view: OverviewKey, expression: FilterExpression): T[] {
  const fields = OVERVIEW_FIELDS[view];
  const predicate = toPredicate(expression, fields);
  if (!predicate) return rows;
  return rows.filter(row => predicate(Object.fromEntries(fields.map(field => [field.key, row[field.key]]))));
}
