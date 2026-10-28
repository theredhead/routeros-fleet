import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CommunicationMethod, CommunicationProbe, CommunicationSettings, DeviceCommunication } from './communication.models';
import { CommunicationDraft } from './communication-draft';
@Injectable({providedIn: 'root'})
export class CommunicationSettingsService {
  private readonly http = inject(HttpClient);
  load(): Promise<CommunicationSettings> { return firstValueFrom(this.http.get<CommunicationSettings>('/api/communication/settings')); }
  save(settings: CommunicationSettings): Promise<CommunicationSettings> { return firstValueFrom(this.http.put<CommunicationSettings>('/api/communication/settings', settings)); }
  probe(host: string, communication: DeviceCommunication): Promise<CommunicationProbe[]> { return firstValueFrom(this.http.post<CommunicationProbe[]>('/api/communication/probe', {host, communication})); }
  draft(methods: CommunicationMethod[]): CommunicationDraft { return new CommunicationDraft(methods); }
}
