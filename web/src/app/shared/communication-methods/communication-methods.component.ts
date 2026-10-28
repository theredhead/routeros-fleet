import { HelpPopoverComponent } from '../help-popover.component';
import { CdkDrag, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, output, signal } from '@angular/core';
import { UICheckbox, UIInput, UIIcon, UIIcons, UITooltip } from '@theredhead/lucid-kit';
import { CommunicationMethodRow, CommunicationMethodChange } from '../../core/communication-draft';
import { CommunicationProbe, StrategyId } from '../../core/communication.models';
@Component({
  selector: 'app-communication-methods',
  imports: [HelpPopoverComponent, CdkDrag, CdkDragHandle, CdkDropList, UICheckbox, UIInput, UIIcon, UITooltip],
  templateUrl: './communication-methods.component.html',
  styleUrl: './communication-methods.component.scss',
})
export class CommunicationMethodsComponent {
  readonly rows = input.required<CommunicationMethodRow[]>();
  readonly probes = input<CommunicationProbe[]>([]);
  readonly disabled = input(false);
  readonly methodChange = output<CommunicationMethodChange>();
  readonly move = output<{id: StrategyId; offset: number}>();
  readonly grip = UIIcons.Lucide.Layout.GripVertical;
  readonly announcement = signal('');
  drop(previousIndex: number, currentIndex: number): void {
    if (this.disabled() || previousIndex === currentIndex) return;
    const row = this.rows()[previousIndex];
    if (!row || currentIndex < 0 || currentIndex >= this.rows().length) return;
    this.move.emit({id: row.id, offset: currentIndex - previousIndex});
    this.announcement.set(`${row.label} moved to position ${currentIndex + 1} of ${this.rows().length}.`);
  }
  moveWithKeyboard(event: KeyboardEvent, index: number): void {
    const target = {ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: this.rows().length - 1}[event.key];
    if (target === undefined || this.disabled()) return;
    event.preventDefault();
    this.drop(index, target);
  }
  probeFor(id: StrategyId): CommunicationProbe | undefined { const row = this.rows().find(row => row.id === id); return this.probes().find(probe => probe.id === id && probe.port === row?.port); }
}
