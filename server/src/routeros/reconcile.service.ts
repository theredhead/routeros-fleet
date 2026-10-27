import { Injectable } from '@nestjs/common';

export interface DesiredItem {
  key: string;                                  // stable identity of the record within its menu
  props: Record<string, any>;                   // RouterOS property names (hyphenated)
}

export type Op =
  | { action: 'add'; menu: string; props: Record<string, any> }
  | { action: 'update'; menu: string; id: string; props: Record<string, any> }
  | { action: 'remove'; menu: string; id: string };

export interface Convergence {
  ops: Op[];       // add / update for desired records
  removed: any[];  // actual records not covered by desired (candidate prune)
}

/**
 * Menu-agnostic converge(desired, actual). This is the reusable core: every config
 * domain (DHCP today, firewall/VLAN/WiFi later) plugs in here with its own key field.
 */
@Injectable()
export class ReconcileService {
  /** RouterOS read-only fields are prefixed with '.'; 'id' is the record handle. */
  private ignored(k: string): boolean {
    return k.startsWith('.') || k === 'id';
  }

  /** Strip read-only / id fields so a snapshot can be re-sent as a writable create/update. */
  writableProps(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of Object.keys(obj)) {
      if (this.ignored(k)) continue;
      out[k] = obj[k];
    }
    return out;
  }

  private changed(desiredProps: Record<string, any>, existing: Record<string, any>): boolean {
    for (const k of Object.keys(desiredProps)) {
      if (this.ignored(k)) continue;
      const dv = desiredProps[k];
      if (dv === undefined) continue;
      if (String(dv) !== String(existing[k])) return true;
    }
    return false;
  }

  converge(menu: string, desired: DesiredItem[], actual: any[], keyField: string): Convergence {
    const actualByKey = new Map<string, any>();
    for (const o of actual) actualByKey.set(String(o[keyField]), o);

    const ops: Op[] = [];
    const desiredKeys = new Set<string>();

    for (const d of desired) {
      desiredKeys.add(d.key);
      const existing = actualByKey.get(d.key);
      if (!existing) {
        ops.push({ action: 'add', menu, props: d.props });
      } else if (this.changed(d.props, existing)) {
        ops.push({ action: 'update', menu, id: String(existing.id), props: d.props });
      }
    }

    const removed = actual.filter((o) => !desiredKeys.has(String(o[keyField])));
    return { ops, removed };
  }
}
