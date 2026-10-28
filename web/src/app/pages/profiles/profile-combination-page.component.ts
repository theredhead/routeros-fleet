import { NotificationsService } from '../../core/notifications.service';
import { firstValueFrom } from 'rxjs';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UIProgress } from '@theredhead/lucid-kit';
import type { FleetProfile } from '@fleet/configuration';
import { ApiService } from '../../core/api.service';
import { ProfileCombinerComponent } from './profile-combiner.component';
import { ProfileWorkspaceService } from './profile-workspace.service';

@Component({
  selector: 'app-profile-combination-page',
  imports: [UISurface, UIButton, UIProgress, ProfileCombinerComponent],
  templateUrl: './profile-combination-page.component.html',
})
export class ProfileCombinationPageComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly workspace = inject(ProfileWorkspaceService);
  readonly profiles = signal<FleetProfile[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    inject(LiveUpdatesService).watch(['profiles'], async () => {
      this.profiles.set(await firstValueFrom(this.api.listFleetProfiles()));
    }, () => this.loading() || this.saving());
    this.api.listFleetProfiles().subscribe({
      next: profiles => { this.profiles.set(profiles); this.loading.set(false); },
      error: error => { this.error.set(error?.error?.message || error.message); this.loading.set(false); },
    });
  }
  canLeave(): boolean { return !this.saving(); }
  back(): void { void this.router.navigateByUrl('/profiles'); }
  saved(profile: FleetProfile): void { this.notifications.success(`${profile.name} saved.`); this.back(); }
  keepTemporary(profile: FleetProfile): void {
    this.notifications.info(`${profile.name} kept temporarily.`);
    this.workspace.temporaryProfiles.update(profiles => [...profiles, profile]);
    void this.router.navigate(['/profiles', profile.id, 'edit']);
  }
}
