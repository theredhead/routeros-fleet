import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CustomersComponent } from './customers.component';

describe('CustomersComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
