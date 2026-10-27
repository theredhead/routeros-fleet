import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Customer, Device } from '../../models';

@Component({
  selector: 'app-device-list',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card">
      <h1>Devices</h1>
      <p class="sub">Enrolled RouterOS devices and their managed state. Open a device to edit its DHCP configuration.</p>

      @if (customers().length) {
        <div class="row" style="margin-bottom:14px">
          <label style="margin:0">Filter by customer</label>
          <select #cust style="padding:9px 11px;border:1px solid #d1d5db;border-radius:8px;min-width:220px"
                  (change)="onCustomerChange(cust.value)">
            <option value="">All customers</option>
            @for (c of customers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>
      }

      @if (loading()) { <p>Loading…</p> }
      @else if (devices().length === 0) {
        <p>No devices yet. Enroll one via the API (<code>POST /api/devices</code>) or from your provisioning flow.</p>
      }
      @else {
        <table>
          <thead><tr><th>Hostname</th><th>Mgmt IP</th><th>Model</th><th>RouterOS</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (d of devices(); track d.id) {
              <tr>
                <td>{{ d.hostname }}</td>
                <td>{{ d.mgmtIp }}</td>
                <td>{{ d.model || '—' }}</td>
                <td>{{ d.routerosVersion || '—' }}</td>
                <td><span class="badge" [class.online]="d.status==='online'" [class.offline]="d.status==='offline'" [class.error]="d.status==='error'">{{ d.status }}</span></td>
                <td><a [routerLink]="['/devices', d.id, 'dhcp']">DHCP config →</a></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class DeviceListComponent implements OnInit {
  customers = signal<Customer[]>([]);
  devices = signal<Device[]>([]);
  loading = signal(true);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.listCustomers().subscribe((cs) => this.customers.set(cs), () => {});
    this.loadDevices();
  }

  loadDevices(customerId?: string): void {
    this.loading.set(true);
    this.api.listDevices(customerId).subscribe({
      next: (ds) => { this.devices.set(ds); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onCustomerChange(value: string): void {
    this.loadDevices(value || undefined);
  }
}
