import type { DeviceConfiguration } from './device-configuration';
export type ConflictStrategy = 'first-locks' | 'last-wins' | 'user-selects';
export type BuiltInProfileKey = 'bronze' | 'silver' | 'gold';
export interface ProfileSource {
  id: string;
  name: string;
  revision?: number;
  configuration: DeviceConfiguration;
}

export interface ProfileComposition {
  strategy: ConflictStrategy;
  sources: {
    id: string;
    name: string;
    revision?: number;
  }[];
  resolutions: Record<string, string>;
}

export interface FleetProfile extends ProfileSource {
  description: string;
  builtinKey?: BuiltInProfileKey | null;
  composition?: ProfileComposition | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConfigurationConflict {
  path: string;
  label: string;
  candidates: {
    sourceId: string;
    sourceName: string;
    value: unknown;
  }[];
  selectedSourceId?: string;
}

export interface ProfileCombination {
  configuration?: DeviceConfiguration;
  conflicts: ConfigurationConflict[];
  unresolvedPaths: string[];
  composition: ProfileComposition;
  savedProfile?: FleetProfile;
}

export interface CombineProfilesRequest {
  sourceIds: string[];
  strategy: ConflictStrategy;
  resolutions?: Record<string, string>;
  expectedRevisions?: Record<string, number>;
  temporarySources?: ProfileSource[];
  saveAs?: {
    name: string;
    description?: string;
  };
}
