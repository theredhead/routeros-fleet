import { Component, input } from '@angular/core';
import { ActionableIssue } from '../../models';
import { DisclosableComponent } from '../disclosable/disclosable.component';

@Component({
  selector: 'app-configuration-issues',
  imports: [DisclosableComponent],
  templateUrl: './configuration-issues.component.html',
  styleUrl: './configuration-issues.component.scss',
})
export class ConfigurationIssuesComponent {
  readonly issues = input.required<readonly ActionableIssue[]>();
}
