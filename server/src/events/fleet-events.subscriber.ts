import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent, TransactionCommitEvent, TransactionRollbackEvent, TransactionStartEvent, QueryRunner } from 'typeorm';
import { FleetEventsService, FleetTopic } from './fleet-events.service';

const TOPICS: Record<string, FleetTopic[]> = {
  communication_settings: ['diagnostics'],
  customers: ['customers', 'devices'], devices: ['devices'], device_credentials: ['devices'],
  profiles: ['profiles'], config_profiles: ['configuration'], jobs: ['jobs'],
  saved_overview_filters: ['filters'], app_form_schemas: ['forms'], audit_log: ['diagnostics'],
};

/** Buffer invalidations until commit so clients cannot read uncommitted state. */
@Injectable()
export class FleetEventsSubscriber implements EntitySubscriberInterface, OnModuleInit, OnModuleDestroy {
  private readonly pending = new WeakMap<QueryRunner, Set<FleetTopic>[]>();
  constructor(private readonly db: DataSource, private readonly events: FleetEventsService) {}
  onModuleInit(): void { this.db.subscribers.push(this); }
  onModuleDestroy(): void {
    const index = this.db.subscribers.indexOf(this);
    if (index >= 0) this.db.subscribers.splice(index, 1);
  }
  afterInsert(event: InsertEvent<unknown>): void { this.changed(event); }
  afterUpdate(event: UpdateEvent<unknown>): void { this.changed(event); }
  afterRemove(event: RemoveEvent<unknown>): void { this.changed(event); }

  private changed(event: {metadata: {tableName: string}; queryRunner: QueryRunner}): void {
    const topics = TOPICS[event.metadata.tableName];
    if (!topics) return;
    if (!event.queryRunner.isTransactionActive) { this.events.publish(topics); return; }
    const stack = this.pending.get(event.queryRunner) || [new Set<FleetTopic>()];
    topics.forEach(topic => stack[stack.length - 1].add(topic));
    this.pending.set(event.queryRunner, stack);
  }
  afterTransactionStart(event: TransactionStartEvent): void {
    const stack = this.pending.get(event.queryRunner) || [];
    stack.push(new Set());
    this.pending.set(event.queryRunner, stack);
  }
  afterTransactionCommit(event: TransactionCommitEvent): void {
    const stack = this.pending.get(event.queryRunner);
    const topics = stack?.pop();
    if (stack?.length && event.queryRunner.isTransactionActive) {
      topics?.forEach(topic => stack[stack.length - 1].add(topic));
      return;
    }
    this.pending.delete(event.queryRunner);
    if (topics) this.events.publish([...topics]);
  }
  afterTransactionRollback(event: TransactionRollbackEvent): void {
    const stack = this.pending.get(event.queryRunner);
    stack?.pop();
    if (!stack?.length) this.pending.delete(event.queryRunner);
  }
}
