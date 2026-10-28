import { Injectable, signal } from '@angular/core';
import type { FleetProfile } from '@fleet/configuration';

@Injectable({providedIn: 'root'})
export class ProfileWorkspaceService {
  /** In-memory snapshots survive navigation, but intentionally not a browser reload. */
  readonly temporaryProfiles = signal<FleetProfile[]>([]);
}
