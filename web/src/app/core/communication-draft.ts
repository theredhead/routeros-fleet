import { computed, signal } from '@angular/core';
import { CommunicationMethod, STRATEGY_LABELS, StrategyId } from './communication.models';
export interface CommunicationMethodRow extends CommunicationMethod { label: string; }
export interface CommunicationMethodChange { id: StrategyId; changes: Partial<Pick<CommunicationMethod, 'enabled' | 'port' | 'acceptSelfSignedCertificates'>>; }
export class CommunicationDraft {
  readonly methods;
  readonly rows;
  readonly valid;
  constructor(methods: CommunicationMethod[]) {
    this.methods = signal(structuredClone(methods));
    this.rows = computed(() => this.methods().map(method => ({...method, label: STRATEGY_LABELS[method.id]})));
    this.valid = computed(() => this.methods().some(method => method.enabled) && this.methods().every(method => Number.isInteger(method.port) && method.port > 0 && method.port <= 65535));
  }
  update(event: CommunicationMethodChange): void {
    this.methods.update(methods => methods.map(method => method.id === event.id ? {...method, ...event.changes} : method));
  }
  move(event: {id: StrategyId; offset: number}): void {
    this.methods.update(methods => {
      const index = methods.findIndex(method => method.id === event.id), target = index + event.offset;
      if (index < 0 || target < 0 || target >= methods.length) return methods;
      const moved = [...methods]; const [method] = moved.splice(index, 1); moved.splice(target, 0, method); return moved;
    });
  }
}
