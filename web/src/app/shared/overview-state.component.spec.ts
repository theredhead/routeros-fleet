import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OverviewStateComponent } from './overview-state.component';

describe('OverviewStateComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewStateComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
