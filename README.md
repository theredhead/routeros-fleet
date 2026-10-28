# RouterOS Fleet

Angular 21 with LucidKit, a NestJS API, and PostgreSQL for managed RouterOS devices and DHCP desired state.

## Run

Start PostgreSQL with `docker compose up -d`, then run `./scripts/run.sh` from this checkout. The UI is at http://localhost:4200 and proxies `/api/**` to the API on port 3000. Stop other copies before starting; an older checkout on these ports will show older code.

For storing router credentials, create `server/.env` from `server/.env.example` and set a persistent `ENCRYPTION_KEY` (generate once with `openssl rand -hex 32`). Preserve that key to decrypt existing credentials.

## Navigation and enrollment

The full-window LucidKit NavigationPage contains Customers and Devices → Known / Discover, with Lucide icons. The theme uses the orange accent. Only root window sizing is defined by the app; LucidKit owns component styling and content scrolling.

Customers can be listed and added from the Customers page. Each row has a pencil icon that opens a prefilled Lucid Forms detail dialog and a trash icon that requires confirmation. Deleting a customer keeps their devices enrolled and makes them unassigned. On Discover, choose **Enroll** to open the LucidKit enrollment dialog, review the discovered identity and choose **Enroll device**. Profiles opens a server-filtered LucidKit table with Add, Combine, and row-level Duplicate actions. Full Lucid Forms editors and combination workflows have separate pages. See [profiles documentation](docs/profiles.md). Enrollment requires a RouterOS username and an explicitly supplied password (which may be empty). It attempts the configured communication methods in order, verifies RouterOS access, encrypts the credentials, reads them back and verifies login again. Device and credentials commit together; login or database failure aborts enrollment. An initial backup is currently not required or created. Known devices persist after reload; duplicate IP/MAC enrollments return a conflict. Enrollment does not apply configuration changes or create files on the router.

## Discovery

- **Scan local network** (`identifier: "auto"`) listens for MikroTik MNDP announcements on UDP 5678 for five seconds and sends discovery requests on local IPv4 interfaces. It reports identity, IP, MAC, model, and version without REST credentials.
- **MAC lookup** checks MNDP first, then uses a supplied or detected local subnet to populate the ARP table. MAC lookup works within the server's LAN, not across routed networks. ARP entries are normalized, including macOS's unpadded octets.
- **IP or CIDR** probes HTTP and HTTPS for RouterOS/WebFig signatures. ICMP is not required, and generic 200/401 responses do not establish RouterOS identity. IPv4 subnets are limited to /22–/32; concurrency defaults to 64 and is capped at 128.

Run the API directly on the host network for LAN discovery. Neighbor announcements must be enabled on the router's LAN interface, and inbound UDP 5678 must be allowed. Discovery does not enable REST or change router configuration. HTTP probing sends no credentials; managed configuration uses the device’s configured communication strategies.

## Validation

`./scripts/build.sh` builds both apps. `cd server && npm test` builds the API and runs discovery regression tests. With the API and PostgreSQL running, `npm run test:integration` verifies enrollment persistence, stored-login reuse, enrollment without backup access, duplicate rejection and rollback using an isolated temporary PostgreSQL database and a simulated router. It removes that database afterward. Global LucidKit tokens come from `web/src/styles.scss`; its controls use signal value/checked bindings, and all application forms use Lucid Forms schemas.

## Landing page and development tools

The RouterOS Fleet landing page (`/`) checks `/api/health` and displays live API/database status and uptime. It also shows persistent setup warnings with expandable instructions, including missing or invalid credential encryption configuration. The same warning appears during enrollment. The landing page retrieves findings from `/api/configuration/issues` through `ConfigurationIntegrityService` and passes them to the presentational `app-configuration-issues` component. Each finding has its own severity-colored disclosure and instructions. Independent injected check strategies validate encryption setup and stored-credential decryption, environment values (ports, RouterOS timeout, boolean flags, database identifiers and CORS origins), required database tables/columns, and production schema-synchronization settings. Check failures are reported explicitly; issue responses never return key material, passwords or raw exceptions. API availability remains a separate health check. It is the starting point for the future dashboard.

Development (`/development`) shows server/runtime diagnostics, database target and row counts, and IPv4 interfaces used for discovery. It never returns encryption keys or stored credentials. Refresh retrieves a new snapshot.

The reset utility requires opening the confirmation and typing `RESET DATABASE`. It atomically clears all seven fleet tables, including customers, devices, credentials, desired configuration, jobs and audit history, and restarts sequences. Bronze, Silver, and Gold are recreated empty. Physical routers and environment settings are unchanged. Queued/running jobs block reset. Unexpected foreign-key dependencies fail the reset without cascading into other tables. Reset is always disabled for `NODE_ENV=production`; set `DEVELOPMENT_TOOLS_ENABLED=false` to disable it in other environments too.

`npm run test:integration` now also creates an isolated temporary PostgreSQL database to test reset confirmation, disabled environments, active-job protection, rollback and complete reset. It removes that test database afterward and never resets the live fleet database. The database role needs permission to create temporary databases for this test.

Reusable configuration models, partial-setting semantics, combination rules and API details are documented in [docs/profiles.md](docs/profiles.md).


## Forms designer

Open **Development → Forms designer** (`/development/forms`). Select a form and choose **Load**, edit its groups, field labels, properties or layout, and **Save**. Preview and JSON views show the current draft. **Restore default** removes the saved customization for the loaded form. Leaving or loading another form prompts before discarding unsaved work.

The catalog includes customer creation, profile metadata, profile combination, conflict choices, device discovery, DHCP desired state, reset confirmation, and every editable scalar/variant field in the generated configuration editor. Runtime values and choices are supplied by the app. Application field IDs, component types and option values remain stable; display-only fields can be added. Baseline application validation remains enforced.

Overrides are stored in PostgreSQL's `app_form_schemas` table and loaded at app startup; newly opened forms use them. Load refreshes the catalog from the API. Concurrent edits are rejected until the latest saved design is loaded. Fleet database reset preserves form customizations; use Restore default to reset a form. The API uses TypeORM schema synchronization in development; installations with synchronization disabled must provision this table before using the designer.

Run `cd server && npm test` for schema validation checks. `npm run test:integration` includes an isolated-database test for form persistence, revision conflicts, and default restoration.


## Live updates

The browser keeps one EventSource connection to `/api/events`. Committed app database writes announce affected topics (customers, devices, profiles, configuration, jobs, forms, diagnostics); notifications contain no record contents or credentials. The TypeORM subscriber buffers transaction events until commit and drops rolled-back changes. Database reset explicitly invalidates the cleared resources. Heartbeats keep the connection active, and reconnects trigger a fresh read of relevant data.

Overview pages update automatically. Refresh icons retain descriptive tooltips and accessible labels. Discovery updates enrollment status without restarting network scans. Background DHCP job status uses SSE notifications instead of polling. Profile, DHCP, and form-design drafts are preserved when another client makes a change; saving an outdated profile or form design still uses its original revision check.

The event bus covers writes through the running API process, including background jobs. Direct SQL changes and other API worker processes need a shared notification transport before they can broadcast to these clients. Proxies in front of the API must allow long-lived, unbuffered `text/event-stream` responses.

`npm test` covers commit/rollback notification behavior and event payloads. `node --test test/events.integration.cjs` (after `npm run build:test`) verifies HTTP SSE against an isolated temporary database.


## Overview object actions

Customers, known devices, and profiles share the standard overview pattern in `AGENTS.md`: an integrated table heading with the Add action, pencil/detail and confirmed trash/delete row icons, and optional icon duplication. SSE keeps these tables current; retry remains available on errors. Built-in profiles omit deletion. Profile pencils open the existing full configuration editor; customer and device pencils open schema-driven detail dialogs with Save/Cancel.

Device details offer **Test stored login** and **Download initial backup** for enrolled devices. Backup downloads are integrity-checked and contain sensitive configuration; keep them secure. The download action is shown only for devices with an existing backup. New enrollment does not capture one.

Device details edit fleet metadata (name, management address, customer assignment, model, MAC). These edits do not configure the physical router. Deleting a device removes its local enrollment, credentials and desired configuration; job/audit history stays intact. Active jobs block device edits and deletion. `Add device` opens discovery/enrollment. The device detail schema is available in Development's forms designer.


## Overview filters

Customers, known devices, profiles, discovery results, dashboard services, and each Development diagnostic view support simple search and advanced AND/OR rules. Numeric record counts support comparisons and ranges. Customer filtering on known devices is part of the shared filter builder, so it is included when a filter is saved.

Open the bookmark icon beside search to manage saved filters. Choose **Save current filter**, enter a name, and save. Select a named filter and choose **Load filter** to restore it, including its search mode and rules. Saving with the loaded filter's name updates it; changing the name creates a new saved filter. **Clear** resets only the active table filter. Deleting a named filter requires confirmation and preserves the current table filter and all records.

Named filters are shared in PostgreSQL's `saved_overview_filters` table, scoped by overview. They survive browser reloads and fleet-data resets. Revision checks prevent overwriting another client's changes. SSE updates saved-filter lists and retains active table filters when data changes. Profiles continue to filter and paginate on the server; other overviews use LucidKit's predicate compiler against their declared fields. Deployments with schema synchronization disabled must provision the new table and its unique `(view, name)` index.

The filter-naming dialog is included in Development's forms designer. Tests cover schema validation, view scoping, persistence, and concurrent-edit conflicts (`test/filters.test.cjs`, `test/filters.integration.cjs`).


Discovery uses the same table-first overview shell. **Scan network** opens the schema-driven scan setup dialog; a blank address still means automatic local discovery. The page keeps one primary action and a compact search row, leaving the remaining space for results, progress, or concise empty/error states. Scan retries reuse the previous options. Enrollment-status lookup errors are reported separately from scan errors and temporarily disable enrollment until status can be checked.


## Action feedback

Action results use one application-level LucidKit toast container at the bottom right. `NotificationsService` supplies success (green), information (blue), warning (amber), and error (red) feedback. Success and information dismiss after 4 seconds, warnings after 6 seconds, and errors after 8 seconds; toasts can also be dismissed manually. Failed overview actions offer a Details action. Toasts survive route changes, so profile saves and deletions remain visible after returning to the overview. Persistent validation and unsaved-draft conflicts stay beside the affected editor.

## Existing initial backups

Enrollment currently requires working stored credentials only. It does not capture a backup or require backup, file-transfer or scripting permissions beyond those needed by the selected transport to verify login. Existing encrypted initial backups and their download/integrity checks are retained. Preserve the original ENCRYPTION_KEY to decrypt stored credentials and any existing backups.

## Communication strategies

Open **Communication** in the sidebar (`/settings/communication`) to enable methods, change their ports and reorder attempts. HTTPS REST (443), SSH (22), native API over TLS (8729), HTTP REST (80), and native API (8728) share an injected `TransportStrategy` interface. The default order enables the first three, with certificate validation enabled. Plaintext methods require explicitly enabling them in the app settings. The singleton settings row is persisted in `communication_settings`, uses revision checks and survives fleet-data reset. Concurrent changes preserve drafts and reject stale saves.

Opening enrollment automatically probes the globally enabled methods without a username or password. Expand **Communication methods and connection checks** to review results, change ports, deselect methods and reorder attempts for this device. Web authentication challenges remain unconfirmed until login; native API probes request a challenge without credentials, and SSH probes stop after retrieving the server host key. A reachable endpoint is not proof of RouterOS identity or backup permissions. **Check connections** repeats the probes using the current options. SSH requires explicitly confirming the displayed SHA-256 host-key fingerprint; changing the fingerprint or SSH port clears that trust confirmation. Stored SSH connections reject a changed host key.

TLS methods offer **Accept untrusted TLS certificates (including self-signed)** globally and during enrollment. This explicitly skips certificate-chain, identity and expiry validation. Strict verification is the default. HTTP REST and plain native API send credentials without encryption; globally enabling these or disabling TLS validation creates prominent configuration findings on the landing page. Globally disabled strategies cannot be enabled by an enrollment override.

The ordered device policy, ports, trust choices, SSH fingerprint and successful enrollment method are saved on `devices.communication` and reused for stored-login tests, backups and DHCP operations. Existing devices without a policy inherit current global defaults. Changes to the global enable list also constrain existing device policies. Fallback is limited to connection/login verification: mutations and backup commands are never automatically replayed through another strategy after an uncertain result. All backup commands for one snapshot run in the same authenticated session. RouterOS scripting features required by the backup workflow must be supported; backup capture is currently separate from enrollment and is not invoked by it.

Deployments without schema synchronization must provision `communication_settings` (`id`, JSONB `methods`, integer `revision`) and the nullable JSONB `devices.communication` column. Tests use local HTTP, HTTPS, SSH, API and API-TLS fixture servers to verify pre-login behavior, TLS rejection/explicit acceptance, SSH host-key pinning, exact binary backup bytes, settings persistence, ordering, and no write replay. These tests do not verify a physical router.

## Device JSON details

Select a device name in Known devices, or **Device JSON details** in its edit dialog, to open `/devices/:id`. The LucidKit JSON viewer combines stored enrollment/customer/desired configuration, the latest 100 jobs and audit entries (with totals), and a separate live read-only router snapshot. Stored data appears independently of live connectivity and refreshes through SSE. Refresh explicitly requests a new live snapshot. Metadata editing and DHCP configuration remain accessible from the page.

Live inspection uses one authenticated configured transport and reads a declared set of common system, hardware, interface, wireless, addressing, routing, DNS, DHCP, firewall, service, time and queue menus. Each menu reports available, unavailable or skipped; unsupported features and restricted permissions do not discard other results. Reads are bounded by a 20-second loop budget and 8 MiB aggregate payload limit (an in-flight command retains the transport timeout). This is a diagnostic snapshot, not an exhaustive RouterOS export or backup. Credential/key/token fields and script sources are redacted; encrypted backups and stored passwords are not exposed. Offline routers leave stored JSON visible. The page wraps its toolbar and scrolls long JSON on mobile.
