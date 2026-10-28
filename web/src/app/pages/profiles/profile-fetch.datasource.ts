import { RestDatasource } from '@theredhead/lucid-foundation';
import type { ProfileFetchRequest, ProfileFilter, ProfileSummary } from '@fleet/configuration';

/** LucidKit's lazy page cache backed by structured server-side fetch requests. */
export class ProfileFetchDatasource extends RestDatasource<ProfileSummary> {
  constructor(filter: ProfileFilter, signal: AbortSignal, onError: (message: string) => void) {
    const snapshot = structuredClone(filter);
    super('/api/profiles/fetch', 25, async input => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
      const request: ProfileFetchRequest = {
        filter: snapshot,
        pageIndex: Number(url.searchParams.get('pageIndex') || 0),
        pageSize: Number(url.searchParams.get('pageSize') || 25),
      };
      try {
        const response = await fetch('/api/profiles/fetch', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(request), signal,
        });
        if (!response.ok) {
          const error = await response.clone().json().catch(() => null);
          const message = error?.message || `Could not fetch profiles (HTTP ${response.status}).`;
          onError(Array.isArray(message) ? message.join(', ') : message);
        }
        return response;
      } catch (error: any) {
        if (error?.name !== 'AbortError') onError(error?.message || 'Could not fetch profiles.');
        throw error;
      }
    });
  }
}
