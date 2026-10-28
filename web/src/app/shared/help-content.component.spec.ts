import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { HelpContentComponent } from './help-content.component';

describe('HelpContentComponent', () => {
  it('renders its label and text', async () => {
    await TestBed.configureTestingModule({
      imports: [HelpContentComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(HelpContentComponent);
    fixture.componentRef.setInput('label', 'Help title');
    fixture.componentRef.setInput('text', 'Helpful text');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Help title');
    expect(fixture.nativeElement.textContent).toContain('Helpful text');
  });
});
