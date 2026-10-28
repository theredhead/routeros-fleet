import { DeviceNavigationService } from '../../core/device-navigation.service';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DeviceDetailComponent } from './device-detail.component';
import { ApiService } from '../../core/api.service';
import { NotificationsService } from '../../core/notifications.service';
import { LiveUpdatesService } from '../../core/live-updates.service';

describe('DeviceDetailComponent', () => {
  it('keeps stored data visible when the router is offline and follows route changes', async () => {
    const params = new BehaviorSubject(convertToParamMap({id: 'one'}));
    const api = {
      getDeviceDetails: vi.fn().mockImplementation(id => of({device: {id, hostname: id}})),
      inspectDevice: vi.fn().mockReturnValue(of({status: 'unavailable', message: 'Router offline'})),
    };
    await TestBed.configureTestingModule({imports: [DeviceDetailComponent], providers: [
      {provide: ActivatedRoute, useValue: {paramMap: params}}, {provide: ApiService, useValue: api},
      {provide: NotificationsService, useValue: {}}, {provide: LiveUpdatesService, useValue: {watch: () => {}}},
    ]}).compileComponents();
    const fixture = TestBed.createComponent(DeviceDetailComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance.stored()?.device.id).toBe('one');
    expect(TestBed.inject(DeviceNavigationService).current()?.name).toBe('one');
    expect(fixture.componentInstance.liveError()).toBe('Router offline');
    params.next(convertToParamMap({id: 'two'})); await fixture.whenStable();
    expect(fixture.componentInstance.snapshot().stored?.device.id).toBe('two');
    expect(api.inspectDevice).toHaveBeenCalledWith('two');
    expect(TestBed.inject(DeviceNavigationService).current()?.name).toBe('two');
    fixture.destroy(); expect(TestBed.inject(DeviceNavigationService).current()).toBeNull();
  });
});
