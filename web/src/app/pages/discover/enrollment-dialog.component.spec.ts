import { signal } from '@angular/core';
import { EnrollmentCommunicationService } from './enrollment-communication.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { EnrollmentDialogComponent } from './enrollment-dialog.component';
import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { By } from '@angular/platform-browser';
import { ApiService } from '../../core/api.service';

describe('EnrollmentDialogComponent', () => {
  async function setup() {
    const communication = {valid: () => true, checking: () => false, sshEnabled: signal(false), fingerprint: signal<string | undefined>(undefined), initialize: vi.fn(), draft: () => null, error: () => '', policy: () => ({methods: [{id: 'https-rest', enabled: true, port: 443, acceptSelfSignedCertificates: false}]})};
    const api = {enrollDevice: vi.fn().mockReturnValue(of({id: 'saved'}))};
    await TestBed.configureTestingModule({imports: [EnrollmentDialogComponent], providers: [
      {provide: ApiService, useValue: api},
    ]}).overrideComponent(EnrollmentDialogComponent, {set: {providers: [{provide: EnrollmentCommunicationService, useValue: communication}], imports: [DisclosableComponent], schemas: [NO_ERRORS_SCHEMA]}}).compileComponents();
    const fixture = TestBed.createComponent(EnrollmentDialogComponent);
    fixture.componentRef.setInput('device', {ip: '192.0.2.1', hostname: 'Router', isRouterOs: true});
    return {fixture, component: fixture.componentInstance, api, communication};
  }

  it('submits the login and clears the password only after successful enrollment', async () => {
    const {component, api} = await setup();
    component.username.set('operator'); component.password.set('secret');
    const emit = vi.spyOn(component.enrolled, 'emit');
    await component.enroll();
    expect(api.enrollDevice).toHaveBeenCalledWith(expect.objectContaining({mgmtIp: '192.0.2.1', username: 'operator', password: 'secret'}));
    expect(emit).toHaveBeenCalledWith({id: 'saved'});
    expect(component.password()).toBe('');
  });

  it('renders server instructions in a warning disclosure with its message always visible', async () => {
    const {fixture, component, api} = await setup();
    api.enrollDevice.mockReturnValue(throwError(() => ({error: {
      details: ['First problem', 'Second problem'], message: 'Credential storage is not configured.', instructions: 'Set ENCRYPTION_KEY and restart the API.', severity: 'warning',
    }})));
    await component.enroll(); fixture.detectChanges();
    const disclosure = fixture.debugElement.query(By.directive(DisclosableComponent)).componentInstance as DisclosableComponent;
    expect(disclosure.title()).toBe('Credential storage is not configured.');
    expect(disclosure.details()).toBe('Set ENCRYPTION_KEY and restart the API.');
    expect(disclosure.state()).toBe('warning');
    expect(Array.from(fixture.nativeElement.querySelectorAll('.disclosable-items li'), (item: unknown) => (item as HTMLElement).textContent)).toEqual(['First problem', 'Second problem']);
  });

  it('shows the fingerprint beside the checkbox and clears trust when the fingerprint changes', async () => {
    const {fixture, component, communication} = await setup();
    communication.sshEnabled.set(true); communication.fingerprint.set('SHA256:first'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.enrollment-fingerprint code').textContent).toBe('SHA256:first');
    component.trustSshHostKey.set(true); fixture.detectChanges();
    expect(component.ready()).toBe(true);
    communication.fingerprint.set('SHA256:changed'); fixture.detectChanges();
    expect(component.trustSshHostKey()).toBe(false);
    expect(component.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('.enrollment-fingerprint code').textContent).toBe('SHA256:changed');
  });

  it('keeps the dialog draft and reports a failed backup without emitting success', async () => {
    const {component, api} = await setup();
    component.password.set('secret');
    api.enrollDevice.mockReturnValue(throwError(() => ({error: {message: 'Initial backup failed'}})));
    const emit = vi.spyOn(component.enrolled, 'emit');
    await component.enroll();
    expect(emit).not.toHaveBeenCalled();
    expect(component.error()).toBe('Initial backup failed');
    expect(component.password()).toBe('secret');
    expect(component.saving()).toBe(false);
  });
});
