import { DisclosableComponent } from './disclosable/disclosable.component';
import { Component, input, output } from '@angular/core';
import { UIButton, UIProgress } from '@theredhead/lucid-kit';

@Component({
  selector: 'app-overview-state',
  imports: [DisclosableComponent, UIButton, UIProgress],
  templateUrl: './overview-state.component.html',
  styleUrl: './overview-state.component.scss',
})
export class OverviewStateComponent {
  readonly message = input.required<string>();
  readonly error = input('');
  readonly loading = input(false);
  readonly retryable = input(false);
  readonly retry = output<void>();
}
