# Fleet configuration profiles

`server/src/configuration` is the canonical pure TypeScript domain used by both the API and Angular (through the `@fleet/configuration` path alias). It has no NestJS, database, browser, or LucidKit dependency.

- `device-configuration.ts` defines all eleven groups and their detailed settings, including conditional authentication/action variants. `DeviceConfigurationGroup` contains `sectionTitle`, `sectionContentSummary`, and `settings`.
- `configuration-schema.ts` defines the matching runtime schema, canonical section descriptions, collection identity rules, default constructors, and validation. The recursive Lucid Forms editor uses this same schema, so accepted fields and available controls stay aligned.
- `profile.ts` defines stored/temporary profiles, composition strategies, candidate values and conflict results.
- `combine-profiles.ts` implements pure, immutable snapshot composition.

## Partial desired state

A profile can contribute a single field. An omitted property is unmanaged and does not override any source. Explicit `false`, `0`, and empty lists are configured values. An empty list explicitly clears the entire list; it is not an instruction to ignore that field. To stop contributing a setting, choose **Leave … unmanaged** in the editor.

The `PartialConfiguration<T>` type makes nested fields optional, including fields inside collection items. Collection items still require their stable identity at runtime. For example, a profile may define `{ name: "lan", enabled: false }` in DHCP servers, while another profile contributes `{ name: "lan", interfaceName: "bridge" }`. A profile is a partial contribution, not necessarily a complete, hardware-valid configuration ready for deployment.

The editor supports all fields in the model, nested objects, repeatable objects and primitive lists, booleans, bounded integers, enums, and discriminated variants. Configured strings require values except fields that can intentionally be cleared (comments, descriptions, prefixes and contact details). Secret fields store secure-storage references only. Resolving those references and hardware/RouterOS-specific application are separate future work; saving profiles never contacts a physical router.

## Combination semantics

Sources are an explicitly ordered list:

- **First locks:** the first source defining a field supplies its value. Later sources can add fields that earlier sources did not configure.
- **Last wins:** later configured values replace earlier overlapping values. Omitted fields never erase values.
- **User selects:** every differing overlapping field requires a source choice. The result has no usable configuration, and cannot be saved or kept temporarily, until all conflicts are resolved.

Identical configured values are not conflicts. Named object collections merge by stable identity (usually `name`, a firewall rule's `key`, or an interface name). Conflict paths use escaped JSON Pointer segments and include the collection identity, not its array position. Optional route `routingTable` defaults to `main` for identity. VLAN ID sets are normalized for identity.

Primitive lists such as DNS servers are atomic ordered field values; they are not silently concatenated. Empty versus non-empty named collections is also a whole-field conflict. Incompatible union variants (for example, firewall `drop` versus `jump`) resolve as a whole object, preventing a selected action from retaining fields belonging to another action type. With the same variant, individual fields merge normally.

Rule `order` is an ordinary configurable field and can itself conflict; explicit rule order is preserved for future application. Collection entries are emitted in deterministic first-seen order.

Source configurations are cloned and never modified. Saved combinations are independent snapshots, not live inheritance. They retain source IDs, names, revisions and chosen conflict resolutions. Editing a saved configuration directly clears its composition provenance. Saving an edited temporary profile through the ordinary editor creates a new standalone profile snapshot.

## Persistence and required baselines

Reusable profiles live in the `profiles` table (`FleetProfileEntity`), separate from the older per-device DHCP `config_profiles` table. This avoids changing existing DHCP behavior or implying that a reusable profile has been applied to a device.

Startup creates **Bronze**, **Silver**, and **Gold** idempotently. They start with all sections present and no configured settings. Seeding never overwrites existing settings. Their names cannot be changed and the required baselines cannot be deleted; their configuration and descriptions remain editable. Custom profiles can be created, renamed and deleted.

Writes use revisions to reject stale saves and deletes. Combinations verify selected source revisions before saving. Case-insensitive name uniqueness is enforced by a database index. Persisting a combination, including source checks and lineage, is transactional.

The Development database reset also deletes reusable profiles and immediately recreates the three empty baselines in the same transaction. Diagnostics include profile counts. The reset clears temporary profiles in the current app session too.

## Temporary profiles

**Keep as temporary profile** creates an in-memory snapshot without an API write. It survives navigation in the same app tab, can be edited with **Keep changes in memory**, and is available as a source for further combinations. **Save profile** persists it as a standalone profile. Browser reloads discard temporary profiles. Each temporary source has a `temp:` identifier and is validated when submitted to the combination API.

## Profiles overview

`/profiles` is a LucidKit table containing only Name, Description, and a Duplicate button per row. Profile names open their separate editors. The toolbar contains **Add profile** (`/profiles/new`) and **Combine profiles** (`/profiles/combine`); editors and combination controls are not embedded in the overview.

LucidKit's `UIFilter` supplies both simple search and the Advanced predicate builder, including AND/OR rules against name and description. It emits a serializable `ProfileFilter`. The overview creates a fresh lazy `RestDatasource` for each filter, cancels superseded requests, and sends a structured `ProfileFetchRequest` to the API for every page. Filtering, counts, ordering and pagination execute in PostgreSQL, not on an already-downloaded array. Overview responses contain only row summaries, not complete configurations. SQL identifiers and operators are allowlisted, values are parameterized, and LIKE wildcard characters in search text are treated literally.

**Add profile** starts with a blank name/description and an empty configuration. Saving returns to the overview. **Duplicate** immediately creates an independent stored copy with the source description and configuration, a new ID and revision, and an automatically unique name such as `Silver copy` or `Silver copy 2`. Sources are never modified. The current overview filter remains active after duplication.

## API and verification

- `GET /api/profiles`: list complete profiles for composition.
- `POST /api/profiles/fetch`: execute a `ProfileFetchRequest`, returning `{ rows, totalNumberOfRows }` for the overview.
- `GET /api/profiles/:id`: load one complete profile for its editor.
- `POST /api/profiles/:id/duplicate`: clone a profile, optionally checking the source revision.
- `POST /api/profiles`: create a profile with name, description and configuration.
- `PUT /api/profiles/:id`: update with the currently loaded revision.
- `DELETE /api/profiles/:id?revision=N`: delete a custom profile.
- `POST /api/profiles/combine`: preview or save ordered source profiles, including temporary snapshots, a strategy, source revisions and optional per-field source choices. Adding `saveAs` persists a resolved result.

A fetch request looks like:

```json
{
  "filter": {
    "junction": "and",
    "rules": [{ "id": 1, "field": "name", "operator": "contains", "value": "Silver" }]
  },
  "pageIndex": 0,
  "pageSize": 25
}
```

`cd server && npm test` exercises configuration validation, fetch-request validation, and merge semantics. `npm run test:integration` verifies baseline seeding, server filtering, pagination, safe literal searches, duplication, database persistence, protected profiles, source revisions, saved snapshots, concurrent name conflicts, and reset/reseeding in isolated temporary PostgreSQL databases. UI verification uses disposable custom profiles, never changes required baseline settings, and never deploys configuration to routers.

Tests compile the API into `server/dist-test`, separately from the running watch server's `dist` directory, so test builds do not interrupt the local API.
