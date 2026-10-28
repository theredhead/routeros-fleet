import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActionableIssue } from '../common/actionable-issue';
import { ConfigurationCheck } from './configuration-check';

@Injectable()
export class DatabaseSchemaCheck implements ConfigurationCheck {
  readonly name = 'database-schema';
  constructor(private readonly database: DataSource) {}
  async check(): Promise<ActionableIssue[]> {
    let columns: {table_schema: string; table_name: string; column_name: string}[];
    try {
      columns = await this.database.query('SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_catalog = current_database()');
    } catch {
      return [{code: 'DATABASE_CONFIGURATION_UNAVAILABLE', severity: 'error', message: 'Database configuration integrity could not be checked.', instructions: 'Check PostgreSQL availability, DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD, including schema access permissions. Restore connectivity and retry the status check.'}];
    }
    const existing = new Set(columns.map(column => `${column.table_schema}.${column.table_name}.${column.column_name}`));
    const schema = (this.database.options as {schema?: string}).schema || 'public';
    const missing = this.database.entityMetadatas.flatMap(entity => entity.columns.filter(column => !existing.has(`${entity.schema || schema}.${entity.tableName}.${column.databaseName}`)).map(column => `${entity.schema || schema}.${entity.tableName}.${column.databaseName}`));
    if (!missing.length) return [];
    return [{code: 'DATABASE_SCHEMA_INCOMPLETE', severity: 'error', message: 'The database schema is missing required application tables or columns.', instructions: `Apply the schema migrations for this app version to the configured database. In development, DB_SYNCHRONIZE=true can provision the schema after restarting the API. Missing: ${missing.join(', ')}.`}];
  }
}
