import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DhcpEditorComponent } from './dhcp-editor.component';

describe('DhcpEditorComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [DhcpEditorComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
