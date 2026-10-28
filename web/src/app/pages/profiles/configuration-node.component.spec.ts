import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ConfigurationNodeComponent } from './configuration-node.component';

describe('ConfigurationNodeComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigurationNodeComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
