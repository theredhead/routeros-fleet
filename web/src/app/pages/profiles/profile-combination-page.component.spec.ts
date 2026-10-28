import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProfileCombinationPageComponent } from './profile-combination-page.component';

describe('ProfileCombinationPageComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileCombinationPageComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
