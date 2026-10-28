import { EntityManager } from 'typeorm';
import { emptyConfiguration } from '../configuration';
import { FleetProfileEntity } from '../entities/fleet-profile.entity';

export const REQUIRED_PROFILES = [
  { name: 'Bronze', builtinKey: 'bronze' }, { name: 'Silver', builtinKey: 'silver' }, { name: 'Gold', builtinKey: 'gold' },
] as const;

/** Idempotent: startup/reset must never overwrite an instance's edited baseline profiles. */
export async function seedRequiredProfiles(manager: EntityManager): Promise<void> {
  await manager.createQueryBuilder().insert().into(FleetProfileEntity).values(REQUIRED_PROFILES.map(profile => ({
    ...profile, description: '', configuration: emptyConfiguration(), revision: 1,
  }))).orIgnore().execute();
}
