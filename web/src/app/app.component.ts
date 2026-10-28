import { DeviceNavigationService } from './core/device-navigation.service';
import { Component, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { UIIcons, UIToastContainer } from '@theredhead/lucid-kit';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UINavigationPage, NavigationNode, navGroup, navItem } from '@theredhead/lucid-blocks';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UINavigationPage, UIToastContainer],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly deviceNavigation = inject(DeviceNavigationService);
  readonly items = computed(() => [
    navItem('dashboard', 'RouterOS Fleet', { route: '/', icon: UIIcons.Lucide.Layout.LayoutDashboard }),
    navItem('customers', 'Customers', { route: '/customers', icon: UIIcons.Lucide.Account.Users }),
    navGroup('devices', 'Devices', [
      navItem('known', 'Known', { route: '/devices/known', icon: UIIcons.Lucide.Layout.LayoutList }),
      navItem('discover', 'Discover', { route: '/devices/discover', icon: UIIcons.Lucide.Navigation.Radar }),
      ...(this.deviceNavigation.current() ? [navItem('device:' + this.deviceNavigation.current()!.id, this.deviceNavigation.current()!.name, {route: '/devices/' + this.deviceNavigation.current()!.id})] : []),
    ], { expanded: true, icon: UIIcons.Lucide.Connectivity.Router }),
    navItem('profiles', 'Profiles', { route: '/profiles', icon: UIIcons.Lucide.Layout.Layers }),
    navItem('communication', 'Communication', {route: '/settings/communication', icon: UIIcons.Lucide.Connectivity.Router}),
    navItem('development', 'Development', { route: '/development', icon: UIIcons.Lucide.Account.Wrench }),
  ]);
  readonly activePage = signal(this.pageForUrl(this.router.url));

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) this.activePage.set(this.pageForUrl(event.urlAfterRedirects));
      if (event instanceof NavigationCancel || event instanceof NavigationError) this.activePage.set(this.pageForUrl(this.router.url));
    });
  }

  navigate(node: NavigationNode): void {
    if (node.data.route) void this.router.navigateByUrl(node.data.route);
  }

  private pageForUrl(url: string): string {
    if (url === '/' || url.startsWith('/?')) return 'dashboard';
    if (url.startsWith('/settings/communication')) return 'communication';
    if (url.startsWith('/profiles')) return 'profiles';
    if (url.startsWith('/development')) return 'development';
    if (url.startsWith('/customers')) return 'customers';
    const detail = /^\/devices\/([^/?#]+)(?:[?#].*)?$/.exec(url);
    if (detail && !['known', 'discover'].includes(detail[1])) return 'device:' + decodeURIComponent(detail[1]);
    return url.includes('discover') ? 'discover' : 'known';
  }
}
