const operators = ['equals', 'notEquals', 'contains', 'notContains', 'empty', 'notEmpty', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'in', 'notIn'];

function validCondition(condition: any): boolean {
  if (condition == null) return true;
  if (typeof condition !== 'object' || Array.isArray(condition)) return false;
  if ('conditions' in condition) return Array.isArray(condition.conditions) && [undefined, 'every', 'some'].includes(condition.mode) && condition.conditions.every((item: any) => item && typeof item.field === 'string' && operators.includes(item.operator));
  return typeof condition.field === 'string' && operators.includes(condition.operator);
}

/** Checks the JSON boundary without depending on Angular's forms package. */
export function schemaError(schema: any, id: string): string | undefined {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || schema.id !== id) return 'Form ID must match the selected form.';
  if (!Array.isArray(schema.groups) || schema.groups.length > 100) return 'Provide at most 100 form groups.';
  const groups = new Set<string>();
  const fields = new Set<string>();
  for (const group of schema.groups) {
    if (!group || typeof group.id !== 'string' || !group.id || groups.has(group.id)) return 'Group IDs must be unique and nonempty.';
    groups.add(group.id);
    if (!validCondition(group.visibleWhen) || !validCondition(group.enabledWhen)) return 'Invalid group condition.';
    if (!Array.isArray(group.fields) || group.fields.length > 200) return 'Provide at most 200 fields per group.';
    for (const field of group.fields) {
      if (!field || typeof field.id !== 'string' || !field.id || fields.has(field.id)) return 'Field IDs must be unique and nonempty.';
      fields.add(field.id);
      if (fields.size > 2000) return 'Too many form fields.';
      if (field.config !== undefined && (!field.config || typeof field.config !== 'object' || Array.isArray(field.config))) return 'Field configuration must be an object.';
      if (!validCondition(field.visibleWhen) || !validCondition(field.enabledWhen)) return 'Invalid field condition.';
      if (typeof field.component !== 'string' || !field.component) return 'Every field needs a component.';
      if (field.options !== undefined && (!Array.isArray(field.options) || field.options.some((option: any) => !option || !['string', 'number', 'boolean'].includes(typeof option.value) || typeof option.label !== 'string'))) return 'Invalid field options.';
      if (field.validation !== undefined && !Array.isArray(field.validation)) return 'Invalid field validation.';
      for (const rule of field.validation || []) {
        if (!rule || !['required', 'minLength', 'maxLength', 'min', 'max', 'pattern', 'email'].includes(rule.type)) return 'Unsupported validation rule.';
        if (rule.type === 'pattern') {
          if (typeof rule.params?.pattern !== 'string') return 'Pattern validation needs a regular expression.';
          try { new RegExp(rule.params.pattern); } catch { return 'Invalid validation regular expression.'; }
        }
      }
    }
  }
  return undefined;
}
