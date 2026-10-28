import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ConfigurationIntegrityService } from '../../core/configuration-integrity.service';
import { ConfigurationIssuesComponent } from '../../shared/configuration-issues/configuration-issues.component';
import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { ApiService } from '../../core/api.service';
import { LiveUpdatesService } from '../../core/live-updates.service';

describe('DashboardComponent', () => {
  it('shows configuration instructions on the landing page and clears resolved issues', async () => {
    const issue = {code: 'CREDENTIAL_STORAGE_NOT_CONFIGURED', message: 'Credential storage is not configured.', instructions: 'Set ENCRYPTION_KEY and restart the API.', severity: 'warning'};
    const health = {status: 'ok', database: 'connected', uptime: 1, checkedAt: new Date().toISOString(), configurationIssues: [issue]};
    const api = {serverHealth: vi.fn().mockReturnValue(of(health))};
    const integrity = {check: vi.fn().mockResolvedValue([issue])};
    await TestBed.configureTestingModule({imports: [DashboardComponent], providers: [
      {provide: ApiService, useValue: api}, {provide: ConfigurationIntegrityService, useValue: integrity}, {provide: LiveUpdatesService, useValue: {watch: () => {}}},
    ]}).overrideComponent(DashboardComponent, {set: {imports: [ConfigurationIssuesComponent], schemas: [NO_ERRORS_SCHEMA]}}).compileComponents();
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    const disclosure = fixture.debugElement.query(By.directive(DisclosableComponent)).componentInstance as DisclosableComponent;
    expect(disclosure.title()).toBe(issue.message);
    expect(disclosure.details()).toBe(issue.instructions);
    expect(disclosure.state()).toBe('warning');
    integrity.check.mockResolvedValue([]);
    await fixture.componentInstance.refresh(); fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(DisclosableComponent))).toBeNull();
  });
});
