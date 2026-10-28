import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, interval, map, merge, of } from 'rxjs';

export type FleetTopic = 'customers' | 'devices' | 'profiles' | 'configuration' | 'jobs' | 'forms' | 'filters' | 'diagnostics';

@Injectable()
export class FleetEventsService implements OnModuleDestroy {
  private readonly changes = new Subject<MessageEvent>();

  publish(topics: FleetTopic[]): void {
    if (topics.length) this.changes.next({type: 'change', data: {topics: [...new Set([...topics, 'diagnostics'])]}});
  }

  stream(): Observable<MessageEvent> {
    return merge(
      of({type: 'ready', data: {connected: true}}),
      this.changes,
      interval(20_000).pipe(map(() => ({type: 'heartbeat', data: {}}))),
    );
  }

  onModuleDestroy(): void { this.changes.complete(); }
}
