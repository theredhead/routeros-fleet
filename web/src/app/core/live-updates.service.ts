import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, concatMap, debounceTime, filter, from, of, switchMap, take, timer } from 'rxjs';

export type FleetTopic = 'customers' | 'devices' | 'profiles' | 'configuration' | 'jobs' | 'forms' | 'filters' | 'diagnostics';
const ALL: FleetTopic[] = ['customers', 'devices', 'profiles', 'configuration', 'jobs', 'forms', 'filters', 'diagnostics'];

@Injectable({providedIn: 'root'})
export class LiveUpdatesService {
  private readonly changes = new Subject<FleetTopic[]>();
  private readonly source = new EventSource('/api/events');

  constructor() {
    this.source.addEventListener('ready', () => this.changes.next(ALL));
    this.source.addEventListener('change', event => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(data.topics)) this.changes.next(data.topics.filter((topic: FleetTopic) => ALL.includes(topic)));
      } catch { console.warn('Ignored a malformed fleet update event.'); }
    });
    inject(DestroyRef).onDestroy(() => { this.source.close(); this.changes.complete(); });
  }

  watch(topics: FleetTopic[], refresh: () => void | Promise<void>, busy: () => boolean = () => false): void {
    this.changes.pipe(
      filter(changed => topics.some(topic => changed.includes(topic))),
      debounceTime(150),
      switchMap(() => timer(0, 100).pipe(filter(() => !busy()), take(1))),
      concatMap(() => from(Promise.resolve().then(refresh)).pipe(catchError(() => of(undefined)))),
      takeUntilDestroyed(),
    ).subscribe();
  }
}
