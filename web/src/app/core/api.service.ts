import type { DeviceCommunication } from './communication.models';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { FleetProfile, DeviceConfiguration, CombineProfilesRequest, ProfileCombination, ProfileSummary } from '@fleet/configuration';
import { Customer, Device, DeviceDetailsSnapshot, ConfigProfile, Job, DiscoveredDevice, DevelopmentDiagnostics, DatabaseResetResult, ServerHealth } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';
  constructor(private http: HttpClient) {}

  discover(identifier: string, subnet?: string): Observable<DiscoveredDevice[]> {
    return this.http.post<DiscoveredDevice[]>(`${this.base}/discover`, { identifier, subnet });
  }
  enrollDevice(device: Partial<Device> & {username: string; password: string; communication?: DeviceCommunication}): Observable<Device> {
    return this.http.post<Device>(`${this.base}/devices`, device);
  }

  serverHealth(): Observable<ServerHealth> {
    return this.http.get<ServerHealth>(`${this.base}/health`);
  }
  developmentDiagnostics(): Observable<DevelopmentDiagnostics> {
    return this.http.get<DevelopmentDiagnostics>(`${this.base}/development`);
  }
  resetDatabase(confirmation: string): Observable<DatabaseResetResult> {
    return this.http.post<DatabaseResetResult>(`${this.base}/development/reset`, { confirmation });
  }

  listFleetProfiles(): Observable<FleetProfile[]> { return this.http.get<FleetProfile[]>(`${this.base}/profiles`); }
  getFleetProfile(id: string): Observable<FleetProfile> { return this.http.get<FleetProfile>(`${this.base}/profiles/${id}`); }
  duplicateFleetProfile(profile: ProfileSummary): Observable<FleetProfile> {
    return this.http.post<FleetProfile>(`${this.base}/profiles/${profile.id}/duplicate`, {revision: profile.revision});
  }
  createFleetProfile(name: string, description: string, configuration: DeviceConfiguration): Observable<FleetProfile> {
    return this.http.post<FleetProfile>(`${this.base}/profiles`, {name, description, configuration});
  }
  updateFleetProfile(profile: FleetProfile): Observable<FleetProfile> { return this.http.put<FleetProfile>(`${this.base}/profiles/${profile.id}`, {name: profile.name, description: profile.description, configuration: profile.configuration, revision: profile.revision}); }
  deleteFleetProfile(profile: Pick<FleetProfile, 'id' | 'revision'>): Observable<void> { return this.http.delete<void>(`${this.base}/profiles/${profile.id}`, {params: {revision: profile.revision!}}); }
  combineFleetProfiles(request: CombineProfilesRequest): Observable<ProfileCombination> { return this.http.post<ProfileCombination>(`${this.base}/profiles/combine`, request); }

  // Customers
  listCustomers(): Observable<Customer[]> { return this.http.get<Customer[]>(`${this.base}/customers`); }
  createCustomer(d: Partial<Customer>): Observable<Customer> { return this.http.post<Customer>(`${this.base}/customers`, d); }

  updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> { return this.http.patch<Customer>(`${this.base}/customers/${id}`, customer); }
  deleteCustomer(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/customers/${id}`); }

  // Devices
  listDevices(customerId?: string): Observable<Device[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', customerId);
    return this.http.get<Device[]>(`${this.base}/devices`, { params });
  }
  testStoredDeviceLogin(id: string): Observable<{verified: true; routerosVersion: string}> { return this.http.post<{verified: true; routerosVersion: string}>(`${this.base}/devices/${id}/test-login`, {}); }
  updateDevice(id: string, device: Partial<Device>): Observable<Device> { return this.http.patch<Device>(`${this.base}/devices/${id}`, device); }
  deleteDevice(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/devices/${id}`); }
  getDeviceDetails(id: string): Observable<DeviceDetailsSnapshot> { return this.http.get<DeviceDetailsSnapshot>(`${this.base}/devices/${id}/details`); }
  inspectDevice(id: string): Observable<Record<string, unknown>> { return this.http.get<Record<string, unknown>>(`${this.base}/devices/${id}/inspection`); }
  getDevice(id: string): Observable<Device> { return this.http.get<Device>(`${this.base}/devices/${id}`); }

  // Config profile (desired state)
  getProfile(deviceId: string): Observable<ConfigProfile> { return this.http.get<ConfigProfile>(`${this.base}/devices/${deviceId}/config-profile`); }
  saveProfile(deviceId: string, d: Partial<ConfigProfile>): Observable<ConfigProfile> { return this.http.put<ConfigProfile>(`${this.base}/devices/${deviceId}/config-profile`, d); }

  // DHCP operations
  getCurrentDhcp(deviceId: string): Observable<any> { return this.http.get(`${this.base}/devices/${deviceId}/dhcp/current`); }
  dryRunDhcp(deviceId: string): Observable<{ job: Job; plan: any }> { return this.http.post<{ job: Job; plan: any }>(`${this.base}/devices/${deviceId}/dhcp/dry-run`, {}); }
  applyDhcp(deviceId: string): Observable<Job> { return this.http.post<Job>(`${this.base}/devices/${deviceId}/dhcp/apply`, {}); }

  // Jobs
  getJob(id: string): Observable<Job> { return this.http.get<Job>(`${this.base}/jobs/${id}`); }
}
