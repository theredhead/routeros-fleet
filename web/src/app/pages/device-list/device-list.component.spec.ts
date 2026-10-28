import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DeviceListComponent } from './device-list.component';

describe('DeviceListComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceListComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
