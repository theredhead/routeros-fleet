import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { FormsDesignerComponent } from './forms-designer.component';

describe('FormsDesignerComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [FormsDesignerComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
