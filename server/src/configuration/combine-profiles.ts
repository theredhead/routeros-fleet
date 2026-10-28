import type { DeviceConfiguration } from './device-configuration';
import type { ConfigurationConflict, ConflictStrategy, ProfileCombination, ProfileSource } from './profile';
import { CONFIGURATION_SECTIONS, SettingDefinition, emptyConfiguration, itemIdentity, settingLabel } from './configuration-schema';

/** Structural equality ignores object key order but preserves ordered list values. */
export function equalSetting(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => equalSetting(value, b[index]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equalSetting(a[key], b[key]));
}
const pointer = (value: string) => value.replace(/~/g, '~0').replace(/\//g, '~1');
interface Contribution { source: ProfileSource; value: any }

/** Pure snapshot composition. Never mutates sources; choices identify a source, not arbitrary input values. */
export function combineProfiles(sources: readonly ProfileSource[], strategy: ConflictStrategy, resolutions: Record<string, string> = {}): ProfileCombination {
  if (!['first-locks', 'last-wins', 'user-selects'].includes(strategy)) throw new Error('Unknown conflict strategy.');
  if (sources.length < 2) throw new Error('Select at least two profiles.');
  if (new Set(sources.map(source => source.id)).size !== sources.length) throw new Error('A profile can only appear once in a combination.');
  const conflicts: ConfigurationConflict[] = [];
  const unresolvedPaths: string[] = [];
  const configuration = emptyConfiguration();
  const choose = (values: Contribution[], path: string, label: string): unknown => {
    let selectedSourceId = strategy === 'first-locks' ? values[0].source.id : strategy === 'last-wins' ? values[values.length - 1].source.id : resolutions[path];
    if (!values.some(value => value.source.id === selectedSourceId)) selectedSourceId = undefined;
    conflicts.push({ path, label, candidates: values.map(({ source, value }) => ({ sourceId: source.id, sourceName: source.name, value: structuredClone(value) })), selectedSourceId });
    if (!selectedSourceId) unresolvedPaths.push(path);
    return structuredClone((values.find(value => value.source.id === selectedSourceId) || values[0]).value);
  };
  const merge = (definition: SettingDefinition, values: Contribution[], path: string, label: string): unknown => {
    const present = values.filter(value => value.value !== undefined);
    if (!present.length) return undefined;
    if (present.every(value => equalSetting(value.value, present[0].value))) return structuredClone(present[0].value);
    if (definition.kind === 'union') {
      const tag = definition.discriminator;
      if (!present.every(value => value.value[tag] === present[0].value[tag])) return choose(present, path, `${label} (variant)`);
      const variant = present[0].value[tag];
      const merged = merge(definition.variants[variant], present.map(({source, value}) => ({source, value: Object.fromEntries(Object.entries(value).filter(([key]) => key !== tag))})), path, label) as object;
      return { [tag]: variant, ...merged };
    }
    if (definition.kind === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(definition.fields)) {
        const value = merge(child, present.map(({source, value}) => ({source, value: value[key]})), `${path}/${pointer(key)}`, `${label} › ${child.label || settingLabel(key)}`);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (definition.kind === 'array' && definition.keyFields && present.every(({value}) => value.length > 0)) {
      const keys: string[] = [];
      const entries = present.map(({source, value}) => {
        const items = new Map<string, unknown>();
        for (const item of value) {
          const key = itemIdentity(item, definition.keyFields);
          if (!keys.includes(key)) keys.push(key);
          items.set(key, item);
        }
        return {source, items};
      });
      return keys.map(key => merge(definition.item, entries.filter(entry => entry.items.has(key)).map(entry => ({source: entry.source, value: entry.items.get(key)})), `${path}/${pointer(key)}`, `${label} [${key}]`));
    }
    // Primitive lists are atomic. Explicit [] versus configured entries is an intentional conflict.
    return choose(present, path, label);
  };
  for (const section of CONFIGURATION_SECTIONS) {
    (configuration[section.key] as { settings: unknown }).settings = merge(section.definition, sources.map(source => ({ source, value: source.configuration[section.key].settings })), `/${section.key}/settings`, section.sectionTitle);
  }
  return {
    ...(unresolvedPaths.length ? {} : { configuration: configuration as DeviceConfiguration }), conflicts, unresolvedPaths,
    composition: { strategy, sources: sources.map(({id, name, revision}) => ({id, name, ...(revision !== undefined ? {revision} : {})})),
      resolutions: Object.fromEntries(conflicts.filter(conflict => conflict.selectedSourceId).map(conflict => [conflict.path, conflict.selectedSourceId])),
    },
  };
}
