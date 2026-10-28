import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProfileCombinerComponent } from './profile-combiner.component';

describe('ProfileCombinerComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileCombinerComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
