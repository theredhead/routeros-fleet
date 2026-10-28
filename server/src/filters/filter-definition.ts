export interface OverviewField { key: string; label: string; type: 'string' | 'number'; }
const strings = (...fields: [string, string][]): OverviewField[] => fields.map(([key, label]) => ({key, label, type: 'string'}));
export const OVERVIEW_FIELDS = {
  customers: strings(['name', 'Name'], ['contactName', 'Contact'], ['contactEmail', 'Email'], ['plan', 'Plan']),
  devices: strings(['hostname', 'Name'], ['mgmtIp', 'IP address'], ['macAddress', 'MAC address'], ['model', 'Model'], ['routerosVersion', 'RouterOS'], ['customerName', 'Customer'], ['status', 'Status']),
  profiles: strings(['name', 'Name'], ['description', 'Description']),
  discovery: strings(['ip', 'IP address'], ['mac', 'MAC address'], ['hostname', 'Identity'], ['model', 'Model']),
  dashboard: strings(['label', 'Service'], ['value', 'Status']),
  'diagnostics-server': strings(['label', 'Diagnostic'], ['value', 'Value']),
  'diagnostics-inventory': [...strings(['label', 'Records']), {key: 'count', label: 'Count', type: 'number'}] as OverviewField[],
  'diagnostics-interfaces': strings(['name', 'Interface'], ['address', 'IPv4 address'], ['subnet', 'Subnet'], ['mac', 'MAC address']),
};
export type OverviewKey = keyof typeof OVERVIEW_FIELDS;
export interface OverviewFilter { junction: 'and' | 'or'; rules: {id: number; field: string; operator: string; value: string; valueTo?: string}[]; }
const STRING_OPS = ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
const NUMBER_OPS = ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'isEmpty', 'isNotEmpty'];

export function filterError(view: string, expression: any): string | undefined {
  if (!Object.hasOwn(OVERVIEW_FIELDS, view)) return 'Unknown overview.';
  if (!expression || !['and', 'or'].includes(expression.junction) || !Array.isArray(expression.rules) || expression.rules.length > 30) return 'Provide at most 30 filter rules.';
  const ids = new Set<number>();
  for (const rule of expression.rules) {
    if (!rule || !Number.isSafeInteger(rule.id) || rule.id < 0 || ids.has(rule.id)) return 'Filter rule IDs must be unique nonnegative integers.';
    ids.add(rule.id);
    const field = (OVERVIEW_FIELDS[view as OverviewKey] as OverviewField[]).find(field => field.key === rule.field);
    if (!field && rule.field !== '__any__') return 'Unsupported filter field.';
    const operators = field?.type === 'number' ? NUMBER_OPS : STRING_OPS;
    if (!operators.includes(rule.operator) || typeof rule.value !== 'string' || rule.value.length > 2000) return 'Unsupported filter operator or value.';
    if (rule.valueTo !== undefined && (typeof rule.valueTo !== 'string' || rule.valueTo.length > 2000)) return 'Invalid range value.';
    if (field?.type === 'number' && !['isEmpty', 'isNotEmpty'].includes(rule.operator)) {
      if (!rule.value.trim() || !Number.isFinite(Number(rule.value))) return 'Enter a numeric filter value.';
      if (rule.operator === 'between' && (!rule.valueTo?.trim() || !Number.isFinite(Number(rule.valueTo)) || Number(rule.valueTo) < Number(rule.value))) return 'Enter a valid numeric range.';
    }
  }
  return undefined;
}
