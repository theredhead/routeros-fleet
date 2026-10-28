import { CommonDialogService } from '@theredhead/lucid-blocks';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationSettingsComponent } from './communication-settings.component';
import { CommunicationSettingsService } from '../../core/communication-settings.service';
import { NotificationsService } from '../../core/notifications.service';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { DEFAULT_METHODS } from '../../core/communication.models';

describe('CommunicationSettingsComponent', () => {
  it('saves with the loaded revision and Cancel restores the saved draft', async () => {
    const methods = signal(structuredClone(DEFAULT_METHODS));
    const draft = () => ({methods, valid: computed(() => true)});
    const settings = {load: vi.fn().mockResolvedValue({methods: DEFAULT_METHODS, revision: 4}), draft: vi.fn().mockImplementation(draft), save: vi.fn().mockImplementation(async value => ({...value, revision: 5}))};
    const notifications = {success: vi.fn()};
    await TestBed.configureTestingModule({imports: [CommunicationSettingsComponent], providers: [
      {provide: CommonDialogService, useValue: {confirm: vi.fn().mockResolvedValue(true)}}, {provide: CommunicationSettingsService, useValue: settings}, {provide: NotificationsService, useValue: notifications}, {provide: LiveUpdatesService, useValue: {watch: () => {}}},
    ]}).compileComponents();
    const fixture = TestBed.createComponent(CommunicationSettingsComponent);
    await fixture.componentInstance.load();
    methods.update(values => [...values].reverse());
    await fixture.componentInstance.save();
    expect(settings.save).toHaveBeenCalledWith({methods: methods(), revision: 4});
    expect(notifications.success).toHaveBeenCalled();
    fixture.componentInstance.cancel(); expect(settings.draft).toHaveBeenCalled();
  });
});
