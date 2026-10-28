import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ObjectActionsComponent } from './object-actions.component';

describe('ObjectActionsComponent', () => {
  it('creates', async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectActionsComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ObjectActionsComponent);
    fixture.componentRef.setInput('name', 'Example');
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });
});
