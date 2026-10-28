import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OverviewFilterComponent } from './overview-filter.component';

describe('OverviewFilterComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewFilterComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
