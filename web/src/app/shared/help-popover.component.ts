import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { PopoverRef, PopoverService } from '@theredhead/lucid-kit';
import { HelpContentComponent } from './help-content.component';

@Component({
  selector: 'app-help-popover',
  templateUrl: './help-popover.component.html',
  styleUrl: './help-popover.component.scss',
})
export class HelpPopoverComponent {
  readonly label = input.required<string>();
  readonly text = input.required<string>();
  readonly open = signal(false);
  private readonly popovers = inject(PopoverService);
  private ref?: PopoverRef;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.ref?.close());
  }

  toggle(event: MouseEvent): void {
    if (this.ref && !this.ref.isClosed) {
      this.ref.close();
      return;
    }
    this.ref = this.popovers.openPopover({
      component: HelpContentComponent,
      anchor: event.currentTarget as HTMLElement,
      inputs: { label: this.label(), text: this.text() },
      ariaLabel: this.label(),
      closeOnOutsideClick: true,
    });
    this.open.set(true);
    this.ref.closed.subscribe(() => this.open.set(false));
  }
}
