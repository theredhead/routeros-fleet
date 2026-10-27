import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer, Device, ConfigProfile, Job } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';
  constructor(private http: HttpClient) {}

  // Customers
  listCustomers(): Observable<Customer[]> { return this.http.get<Customer[]>(`${this.base}/customers`); }
  createCustomer(d: Partial<Customer>): Observable<Customer> { return this.http.post<Customer>(`${this.base}/customers`, d); }

  // Devices
  listDevices(customerId?: string): Observable<Device[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', customerId);
    return this.http.get<Device[]>(`${this.base}/devices`, { params });
  }
  getDevice(id: string): Observable<Device> { return this.http.get<Device>(`${this.base}/devices/${id}`); }

  // Config profile (desired state)
  getProfile(deviceId: string): Observable<ConfigProfile> { return this.http.get<ConfigProfile>(`${this.base}/devices/${deviceId}/config-profile`); }
  saveProfile(deviceId: string, d: Partial<ConfigProfile>): Observable<ConfigProfile> { return this.http.put<ConfigProfile>(`${this.base}/devices/${deviceId}/config-profile`, d); }

  // DHCP operations
  getCurrentDhcp(deviceId: string): Observable<any> { return this.http.get(`${this.base}/devices/${deviceId}/dhcp/current`); }
  dryRunDhcp(deviceId: string): Observable<{ job: Job; plan: any }> { return this.http.post(`${this.base}/devices/${deviceId}/dhcp/dry-run`, {}); }
  applyDhcp(deviceId: string): Observable<Job> { return this.http.post<Job>(`${this.base}/devices/${deviceId}/dhcp/apply`, {}); }

  // Jobs
  getJob(id: string): Observable<Job> { return this.http.get<Job>(`${this.base}/jobs/${id}`); }
}
