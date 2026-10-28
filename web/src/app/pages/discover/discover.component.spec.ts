import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DiscoverComponent } from './discover.component';

describe('DiscoverComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
