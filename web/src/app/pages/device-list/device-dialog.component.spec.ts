import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DeviceDialogComponent } from './device-dialog.component';

describe('DeviceDialogComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceDialogComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
