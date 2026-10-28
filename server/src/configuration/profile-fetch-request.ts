import type { BuiltInProfileKey } from './profile';
/** Serializable requests for server-side table filtering and pagination. */
export interface FetchRequest<TFilter> {
  filter: TFilter;
  pageIndex: number;
  pageSize: number;
}
export interface FetchResponse<T> {
  rows: T[];
  totalNumberOfRows: number;
}
export const PROFILE_FILTER_FIELDS = ['name', 'description', '__any__'] as const;
export const PROFILE_FILTER_OPERATORS = ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'] as const;
export interface ProfileFilterRule {
  id: number;
  field: typeof PROFILE_FILTER_FIELDS[number];
  operator: typeof PROFILE_FILTER_OPERATORS[number];
  value: string;
}
export interface ProfileFilter {
  junction: 'and' | 'or';
  rules: ProfileFilterRule[];
}
export type ProfileFetchRequest = FetchRequest<ProfileFilter>;
export interface ProfileSummary {
  builtinKey?: BuiltInProfileKey | null;
  id: string;
  name: string;
  description: string;
  revision: number;
}
