import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RefreshButtonComponent } from './refresh-button.component';

describe('RefreshButtonComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [RefreshButtonComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
