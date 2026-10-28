import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProfileEditorComponent } from './profile-editor.component';

describe('ProfileEditorComponent', () => {
  it('compiles', async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileEditorComponent],
    }).compileComponents();

    expect(true).toBe(true);
  });
});
