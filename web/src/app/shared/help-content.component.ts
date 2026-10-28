import { Component, input } from '@angular/core';

@Component({
  selector: 'app-help-content',
  templateUrl: './help-content.component.html',
  styleUrl: './help-content.component.scss',
})
export class HelpContentComponent {
  readonly label = input.required<string>();
  readonly text = input.required<string>();
}
