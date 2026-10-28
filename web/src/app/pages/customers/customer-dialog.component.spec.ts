import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CustomerDialogComponent } from './customer-dialog.component';

describe('CustomerDialogComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerDialogComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
