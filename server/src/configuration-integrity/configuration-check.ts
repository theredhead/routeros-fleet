import { ActionableIssue } from '../common/actionable-issue';

export const CONFIGURATION_CHECKS = Symbol('CONFIGURATION_CHECKS');
export interface ConfigurationCheck {
  readonly name: string;
  check(): ActionableIssue[] | Promise<ActionableIssue[]>;
}
