import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DevelopmentComponent } from './development.component';

describe('DevelopmentComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [DevelopmentComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
