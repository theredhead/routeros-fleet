import { TestBed } from '@angular/core/testing';
import { PopoverRef, PopoverService } from '@theredhead/lucid-kit';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { HelpPopoverComponent } from './help-popover.component';

describe('HelpPopoverComponent', () => {
  it('creates and toggles its popover', async () => {
    const closed$ = new Subject<void>();
    const ref = {
      isClosed: false,
      close: vi.fn(() => closed$.next()),
      closed: closed$.asObservable(),
    } as unknown as PopoverRef;

    const popovers: Pick<PopoverService, 'openPopover'> = {
      openPopover: vi.fn(() => ref),
    };

    await TestBed.configureTestingModule({
      imports: [HelpPopoverComponent],
      providers: [{ provide: PopoverService, useValue: popovers }],
    }).compileComponents();

    const fixture = TestBed.createComponent(HelpPopoverComponent);
    fixture.componentRef.setInput('label', 'More info');
    fixture.componentRef.setInput('text', 'Details');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(popovers.openPopover).toHaveBeenCalled();

    button.click();
    expect(ref.close).toHaveBeenCalled();
  });
});
