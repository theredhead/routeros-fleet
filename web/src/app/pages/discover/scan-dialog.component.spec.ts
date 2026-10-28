import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ScanDialogComponent } from './scan-dialog.component';

describe('ScanDialogComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ScanDialogComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
