import { DeviceDetailComponent } from './pages/device-detail/device-detail.component';
import { CommunicationSettingsComponent } from './pages/communication-settings/communication-settings.component';
import { FormsDesignerComponent } from './pages/development/forms-designer.component';
import { Routes } from '@angular/router';
import { DeviceListComponent } from './pages/device-list/device-list.component';
import { DhcpEditorComponent } from './pages/dhcp-editor/dhcp-editor.component';
import { DiscoverComponent } from './pages/discover/discover.component';

import { CustomersComponent } from './pages/customers/customers.component';

import { DevelopmentComponent } from './pages/development/development.component';

import { DashboardComponent } from './pages/dashboard/dashboard.component';

import { ProfilesComponent } from './pages/profiles/profiles.component';

import { ProfileEditorComponent } from './pages/profiles/profile-editor.component';
import { ProfileCombinationPageComponent } from './pages/profiles/profile-combination-page.component';

export const routes: Routes = [
  { path: 'settings/communication', component: CommunicationSettingsComponent, canDeactivate: [(component: CommunicationSettingsComponent) => component.canLeave()] },
  { path: '', pathMatch: 'full', component: DashboardComponent },
  { path: 'profiles', component: ProfilesComponent },
  { path: 'profiles/new', component: ProfileEditorComponent, canDeactivate: [(component: ProfileEditorComponent) => component.canLeave()] },
  { path: 'profiles/combine', component: ProfileCombinationPageComponent, canDeactivate: [(component: ProfileCombinationPageComponent) => component.canLeave()] },
  { path: 'profiles/:id/edit', component: ProfileEditorComponent, canDeactivate: [(component: ProfileEditorComponent) => component.canLeave()] },
  { path: 'development/forms', component: FormsDesignerComponent, canDeactivate: [(component: FormsDesignerComponent) => component.canLeave()] },
  { path: 'development', component: DevelopmentComponent },
  { path: 'customers', component: CustomersComponent },
  { path: 'devices/known', component: DeviceListComponent },
  { path: 'devices/discover', component: DiscoverComponent },
  { path: 'discover', pathMatch: 'full', redirectTo: 'devices/discover' },
  { path: 'devices/:id', pathMatch: 'full', component: DeviceDetailComponent },
  { path: 'devices/:id/dhcp', component: DhcpEditorComponent },
  { path: '**', redirectTo: 'devices/known' },
];
