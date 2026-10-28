import { FormFieldDefinition, FormSchema } from '@theredhead/lucid-forms';
import { CONFIGURATION_SECTIONS, SettingDefinition, settingLabel } from '@fleet/configuration';

export interface AppFormDefinition { id: string; label: string; schema: FormSchema; }
const textField = (id: string, title: string, defaultValue = '', required = false): FormFieldDefinition => ({
  id, title, component: 'text', defaultValue,
  validation: required ? [{type: 'required'}, {type: 'pattern', params: {pattern: '\\S'}, message: 'Enter a value.'}] : [],
});
const schema = (id: string, fields: FormFieldDefinition[]): FormSchema => ({id, groups: [{id: 'details', fields}]});
const customerSchema: FormSchema = {
  id: 'customer',
  groups: [{id: 'details', fields: [
    {id: 'name', title: 'Customer name', component: 'text', defaultValue: '', validation: [
      {type: 'required'}, {type: 'pattern', params: {pattern: '\\S'}, message: 'Enter a customer name.'},
    ]},
    {id: 'contactName', title: 'Contact name (optional)', component: 'text', defaultValue: ''},
    {id: 'contactEmail', title: 'Contact email (optional)', component: 'text', defaultValue: '', config: {type: 'email'}, validation: [{type: 'email'}]},
  ]}],
};

const combinationSchema: FormSchema = {id: 'combination', groups: [{id: 'details', fields: [
    {id: 'name', title: 'Combined profile name', component: 'text', defaultValue: 'Combined profile', validation: [{type: 'required'}, {type: 'pattern', params: {pattern: '\\S'}, message: 'Enter a profile name.'}, {type: 'maxLength', params: {max: 100}}]},
    {id: 'description', title: 'Description', component: 'text', config: {multiline: true}, defaultValue: ''},
    {id: 'strategy', title: 'Conflict resolution', component: 'select', defaultValue: 'first-locks', options: [
      {value: 'first-locks', label: 'First locks'}, {value: 'last-wins', label: 'Last wins'}, {value: 'user-selects', label: 'User selects'},
    ]},
  ]} ]};

export const APP_FORMS: AppFormDefinition[] = [
  {id: 'saved-filter', label: 'Overviews · Save filter', schema: schema('saved-filter', [
    {...textField('name', 'Filter name', '', true), validation: [{type: 'required'}, {type: 'pattern', params: {pattern: '\\S'}}, {type: 'maxLength', params: {max: 100}}]},
  ])},
  {id: 'customer', label: 'Customers · Add customer', schema: customerSchema},
  {id: 'device', label: 'Devices · Device details', schema: schema('device', [
    textField('hostname', 'Name', '', true),
    {...textField('mgmtIp', 'Management IP address', '', true), config: {placeholder: '192.168.1.1'}},
    {id: 'customerId', title: 'Customer', component: 'select', defaultValue: '', options: [{value: '', label: 'Unassigned'}]},
    textField('model', 'Model'), textField('macAddress', 'MAC address (optional)'),
  ])},
  {id: 'profile', label: 'Profiles · Details', schema: schema('profile', [
    {...textField('name', 'Profile name', '', true), validation: [{type: 'required'}, {type: 'pattern', params: {pattern: '\\S'}}, {type: 'maxLength', params: {max: 100}}]},
    {...textField('description', 'Description'), config: {multiline: true}, validation: [{type: 'maxLength', params: {max: 2000}}]},
  ])},
  {id: 'combination', label: 'Profiles · Combine profiles', schema: combinationSchema},
  {id: 'conflict', label: 'Profiles · Conflict choice', schema: schema('conflict', [
    {id: 'source', title: 'Source profile', component: 'radio', defaultValue: '', options: [{value: 'example', label: 'Example source'}], validation: [{type: 'required', message: 'Choose a source for this field.'}]},
  ])},
  {id: 'discovery', label: 'Devices · Discovery', schema: schema('discovery', [
    {...textField('query', 'MAC address, IP, or CIDR'), config: {placeholder: 'MAC address, IP, or CIDR (blank = auto)'}},
    {...textField('subnet', 'Subnet for MAC lookup (optional)'), config: {placeholder: '192.168.1.0/24'}},
  ])},
  {id: 'reset', label: 'Development · Reset confirmation', schema: schema('reset', [
    {...textField('confirmation', 'Reset confirmation'), config: {placeholder: 'RESET DATABASE'}, validation: [{type: 'required'}, {type: 'pattern', params: {pattern: '^RESET DATABASE$'}}]},
  ])},
  {id: 'dhcp', label: 'Devices · DHCP desired state', schema: schema('dhcp', [
    {id: 'dhcpEnabled', title: 'DHCP enabled', component: 'checkbox', defaultValue: true},
    {...textField('dhcpInterface', 'Interface', '', true), config: {placeholder: 'bridge1'}},
    {...textField('subnetCidr', 'Subnet (CIDR)', '', true), config: {placeholder: '192.168.1.0/24'}},
    {...textField('gatewayIp', 'Gateway', '', true), validation: [{type: 'required'}, {type: 'pattern', params: {pattern: '^(\\d{1,3}\\.){3}\\d{1,3}$'}}]},
    textField('dnsServer', 'DNS server'), textField('poolName', 'Pool name', 'dhcp_pool'),
    {...textField('poolStart', 'Pool start', '', true), config: {placeholder: '192.168.1.2'}},
    {...textField('poolEnd', 'Pool end', '', true), config: {placeholder: '192.168.1.254'}},
    {id: 'prune', title: 'Prune unmanaged records on apply', component: 'checkbox', defaultValue: false},
  ])},
];

export function settingField(definition: SettingDefinition, title: string, required = false, value?: unknown): FormFieldDefinition {
  if (definition.kind === 'object' || definition.kind === 'array') throw new Error('Container settings do not have a field schema.');
  if (definition.kind === 'union') return {
    id: 'value', title: `${title} type`, component: 'select', defaultValue: value,
    options: Object.keys(definition.variants).map(value => ({value, label: value})),
  };
  return {
    id: 'value', title,
    component: definition.kind === 'boolean' ? 'checkbox' : definition.options ? 'select' : 'text',
    config: definition.kind === 'number' ? {type: 'number'} : {},
    options: definition.options?.map(value => ({value, label: value})), defaultValue: value,
    validation: [
      ...((required || definition.minLength > 0) && definition.kind === 'string' ? [{type: 'required' as const}] : []),
      ...(definition.min !== undefined ? [{type: 'min' as const, params: {min: definition.min}}] : []),
      ...(definition.max !== undefined ? [{type: 'max' as const, params: {max: definition.max}}] : []),
    ],
  };
}

function collectSettings(definition: SettingDefinition, path: string, label: string, required = false): void {
  if (definition.kind === 'object') {
    for (const [key, child] of Object.entries(definition.fields)) {
      collectSettings(child, `${path}.${key}`, `${label} › ${child.label || settingLabel(key)}`, definition.required?.includes(key));
    }
  } else if (definition.kind === 'array') {
    collectSettings(definition.item, `${path}.item`, `${label} › Item`, true);
  } else {
    APP_FORMS.push({id: path, label: `Configuration · ${label}`, schema: schema(path, [settingField(definition, label.split(' › ').at(-1)!, required)])});
    if (definition.kind === 'union') {
      for (const [variant, child] of Object.entries(definition.variants)) collectSettings(child, `${path}.${variant}`, `${label} › ${variant}`);
    }
  }
}
for (const section of CONFIGURATION_SECTIONS) collectSettings(section.definition, `setting.${section.key}`, section.sectionTitle, true);
