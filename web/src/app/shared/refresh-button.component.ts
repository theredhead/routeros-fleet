import { Component, input, output } from '@angular/core';
import { UIButton, UIIcon, UIIcons, UITooltip } from '@theredhead/lucid-kit';

@Component({
  selector: 'app-refresh-button',
  imports: [UIButton, UIIcon, UITooltip],
  templateUrl: './refresh-button.component.html',
})
export class RefreshButtonComponent {
  readonly label = input('Refresh');
  readonly disabled = input(false);
  readonly refresh = output<void>();
  readonly icon = UIIcons.Lucide.Arrows.RefreshCw;
}
