import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FilterExpression } from '@theredhead/lucid-kit';
import { OverviewKey } from '@fleet/filters';

export interface SavedFilter { id: string; view: OverviewKey; name: string; expression: FilterExpression; revision: number; }
@Injectable({providedIn: 'root'})
export class SavedFiltersService {
  private readonly http = inject(HttpClient);
  list(view: OverviewKey): Promise<SavedFilter[]> { return firstValueFrom(this.http.get<SavedFilter[]>('/api/filters', {params: {view}})); }
  get(id: string): Promise<SavedFilter> { return firstValueFrom(this.http.get<SavedFilter>(`/api/filters/${id}`)); }
  save(view: OverviewKey, name: string, expression: FilterExpression, existing?: SavedFilter): Promise<SavedFilter> {
    const body = {view, name, expression, ...(existing ? {revision: existing.revision} : {})};
    return firstValueFrom(existing ? this.http.put<SavedFilter>(`/api/filters/${existing.id}`, body) : this.http.post<SavedFilter>('/api/filters', body));
  }
  remove(filter: SavedFilter): Promise<unknown> { return firstValueFrom(this.http.delete(`/api/filters/${filter.id}/${filter.revision}`)); }
  message(error: any): string {
    const message = error?.error?.message || error?.message || 'Request failed.';
    return Array.isArray(message) ? message.join(', ') : message;
  }
}
