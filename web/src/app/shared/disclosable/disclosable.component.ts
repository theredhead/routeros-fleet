import { Component, input, model } from '@angular/core';
import { UIIcon, UIIcons } from '@theredhead/lucid-kit';

export type DisclosableState = 'plain' | 'error' | 'warning' | 'success';
let nextDisclosableId = 0;

@Component({
  selector: 'app-disclosable',
  imports: [UIIcon],
  templateUrl: './disclosable.component.html',
  styleUrl: './disclosable.component.scss',
  host: {'[attr.data-state]': 'state()'},
})
export class DisclosableComponent {
  readonly title = input.required<string>();
  readonly details = input('');
  readonly items = input<readonly string[]>([]);
  readonly state = input<DisclosableState>('plain');
  readonly expanded = model(false);
  readonly disclosureIcon = UIIcons.Lucide.Arrows.ChevronRight;
  readonly detailsId = `disclosable-details-${++nextDisclosableId}`;
  readonly titleId = `${this.detailsId}-title`;
}
