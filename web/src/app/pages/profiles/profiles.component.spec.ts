import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProfilesComponent } from './profiles.component';

describe('ProfilesComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilesComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
