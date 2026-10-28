import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { ConfigurationIssuesComponent } from './configuration-issues.component';
import { DisclosableComponent } from '../disclosable/disclosable.component';

describe('ConfigurationIssuesComponent', () => {
  it('renders each supplied issue separately and removes resolved issues', async () => {
    await TestBed.configureTestingModule({imports: [ConfigurationIssuesComponent]}).compileComponents();
    const fixture = TestBed.createComponent(ConfigurationIssuesComponent);
    fixture.componentRef.setInput('issues', [
      {code: 'KEY', message: 'Missing key', instructions: 'Set ENCRYPTION_KEY.', severity: 'warning'},
      {code: 'SCHEMA', message: 'Missing schema', instructions: 'Apply migrations.', severity: 'error'},
    ]); fixture.detectChanges();
    const disclosures = fixture.debugElement.queryAll(By.directive(DisclosableComponent));
    expect(disclosures.length).toBe(2);
    expect(disclosures[0].componentInstance.title()).toBe('Missing key');
    expect(disclosures[1].componentInstance.details()).toBe('Apply migrations.');
    expect(disclosures[1].componentInstance.state()).toBe('error');
    fixture.componentRef.setInput('issues', []); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });
});
