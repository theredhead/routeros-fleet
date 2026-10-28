# RouterOS Fleet UI Conventions

## Overviews

- Use LucidKit `ui-table-view` for overview tables.
- Include `OverviewFilterComponent` in overview headings for compact search and advanced rules; open named-filter management through its bookmark icon.
  - Register fields in `OVERVIEW_FIELDS`.
  - Preserve the active filter during SSE refreshes.
  - Use LucidKit predicates for local rows and server-side filtering for profiles.
- Put `Add <entity>` in the table heading area (`.overview-table` / `.table-header`), including when the table is empty.
  - Use the existing domain creation flow, such as discovery/enrollment for devices.

## Row Actions

- Use `ObjectActionsComponent` for row actions.
  - Pencil opens the object's detail editor.
  - Trash requires an explicit confirmation naming the object and explaining the effect.
  - Protected objects omit deletion.
  - Optional duplication uses its icon.

## Detail Forms

- Detail forms use Lucid Forms and the shared app-form catalog, with Save and Cancel.
- Preserve unsaved drafts during live updates.

## Live Updates

- Use SSE to keep object overviews current.
  - Keep retry actions on errors.
  - Omit standalone refresh buttons on these overviews.
  - Read-only status/diagnostics can retain icon refresh controls.

## Accessibility & Styling

- Render app router links as LucidKit `ui-button` controls with `variant="ghost"` and `color="secondary"`.

- Give icon buttons descriptive tooltips and accessible names.
- Keep component-specific styles in the component’s own stylesheet; do not use inline template styles.
- Use global stylesheets for app-wide layout, theme tokens, and genuinely shared conventions.
- Prefer LucidKit’s built-in appearance and theme tokens; avoid custom overrides of library internals.
  - Action groups use 12px gaps in both axes.
  - Panel surfaces use 12px padding, excluding sidebar navigation.
  - Use compact non-wrapping row actions so buttons fit the table row.
- Put supporting explanations behind tertiary-colored (?) popovers with outside-click dismissal.
  - Keep concise errors/status and destructive-action warnings visible, with expandable error details.

## Discovery

- Keep discovery table-first: one `Scan network` header action opens the schema-driven scan dialog.
  - Keep scan setup and saved-filter management out of the overview body.
  - Enrollment lookup errors must not masquerade as scan failures.

## Communication

- Keep RouterOS transports behind the shared injected strategy interface.
- Show the SSH fingerprint beside its trust checkbox outside the connection-details disclosure. Enrollment login and trust controls are fixed LucidKit controls, not configurable forms.
- Use compact LucidKit controls for communication method settings; these are not configurable forms and do not belong in the forms designer.
- Reorder communication methods with drag handles; put keyboard instructions in a (?) help popover.
- Configure app-wide enabled methods and default order in Communication; enrollment overrides may only use globally enabled methods.
- Probe without credentials before enrollment; keep protocol reachability distinct from verified login and backup access.
- Make untrusted TLS acceptance explicit and pin confirmed SSH host-key fingerprints.
- Never automatically replay mutations through a fallback strategy after an uncertain result.

## Configuration issues

- Show noteworthy configuration problems prominently on the landing page using `app-configuration-issues`.
- Keep the component presentational: the page supplies findings obtained from the configuration-integrity service.
- Render each finding separately with `app-disclosable`, its severity, a concise message, and actionable instructions.

## Notifications

- Send action-result messages through `NotificationsService` as auto-dismissing, severity-colored LucidKit toasts.
  - Keep result text out of page banners.
  - Keep persistent validation, unavailable-data states, and unsaved-draft conflicts beside or instead of the affected UI.

# Coding Style

- Do not silently swallow caught errors. Handle or propagate them, or log safely at an appropriate severity; a comment alone is insufficient. Never log credentials or raw transport error objects.

- Give variables, types, and functions clear and descriptive names. Brevity is not a goal; readability and maintainability are.
- When creating or editing Angular components, always keep template, code, and style in their own files.
  - Create components, directives, services, etc. using the Angular CLI.
  - Every component gets a directory with at least three files: `.ts`, `.html`, and `.spec` (unused `.scss` files do not need to be kept).
- Keep files small, readable, and SOLID.
- Use inversion of control.
- Leverage the strategy pattern where more than one implementation for a function exists: extract a minimal interface and use that interface to inject the relevant implementation.
- Keep components dumb and presentational.
- Leverage all functionality already present in LucidKit before rolling custom components, directives, and types.
