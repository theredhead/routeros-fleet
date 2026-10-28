import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ConflictChoiceComponent } from './conflict-choice.component';

describe('ConflictChoiceComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ConflictChoiceComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
