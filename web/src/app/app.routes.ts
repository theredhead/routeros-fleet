import { Routes } from '@angular/router';
import { DeviceListComponent } from './pages/device-list/device-list.component';
import { DhcpEditorComponent } from './pages/dhcp-editor/dhcp-editor.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: DeviceListComponent },
  { path: 'devices/:id/dhcp', component: DhcpEditorComponent },
];
