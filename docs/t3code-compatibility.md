# T3 Code Compatibility

This document records the T3 Code API surface P3 depends on.

## Target

Unmodified T3 Code, in either of its two orchestration protocols.

| Protocol | Server | Verified against |
| --- | --- | --- |
| 1 | published `t3` CLI | `t3@0.0.33`, `t3@0.0.38` |
| 2 | T3 Code Fold and current upstream `main` | `t3@0.3.4` (`BreakTheBeta/T3codefold`) |

There is no compatibility branch and no server patch in either case. The earlier fork — which re-added `--auth-token`, legacy `?token=` WebSocket auth, and an `orchestration.getSnapshot` RPC — is no longer used, and must not come back.

`./verify-p3.sh` reports which protocol the server it smoke-tested actually spoke. Point it at a specific CLI with `T3_CMD`:

```sh
./verify-p3.sh                                   # whichever t3 is on PATH
T3_CMD=/path/to/fold/t3 ./verify-p3.sh           # the other one
```

## Telling the two apart

The shell snapshot identifies itself. Protocol 2 carries `schemaVersion: 2` and a separate `archivedThreads` array; protocol 1 carries neither and has `updatedAt` instead. Nothing probes a capability endpoint, so nothing can go stale between the probe and the read.

## Protocol 2 differences

### Required header

Every REST call must carry:

```
x-t3-orchestration-protocol: 2
```

Without it the orchestration routes answer `400` with an empty body. A protocol-1 server ignores the header, so the bridge sends it unconditionally.

### Required WebSocket parameter

```
/ws?wsTicket=<ticket>&orchestrationProtocol=2
```

Without the parameter the upgrade closes with code `1006` and no diagnostic. Protocol 1 ignores it, so it too is unconditional.

### Writes

`POST /api/orchestration/dispatch` **does not exist** on protocol 2; the route is absent from the server bundle entirely and answers `404`. Commands go over the WebSocket RPC instead:

```json
{ "_tag": "Request", "id": 1, "tag": "orchestration.dispatchCommand",
  "payload": { "type": "...", "commandId": "...", "threadId": "..." }, "headers": [] }
```

Protocol 1 keeps the REST route, which is one round trip instead of a ticket plus a socket, so the bridge keeps using it there.

### Command vocabulary

| Protocol 1 | Protocol 2 |
| --- | --- |
| `thread.settle` | unchanged |
| `thread.unsettle` | unchanged |
| `thread.create` | unchanged |
| `thread.turn.start` | `message.dispatch` — the nested `message` flattens into the command, plus `createdBy`/`creationSource` |
| `thread.turn.interrupt` | `run.interrupt` — additionally requires `runId` |
| `thread.approval.respond` | `runtime-request.respond` with `decision` |
| `thread.user-input.respond` | `runtime-request.respond` with `answers` |
| `project.create` | **no equivalent** |
| `project.delete` | **no equivalent** |

`run.interrupt` needs a run id that the protocol-1 command never carried, so the bridge harvests `activeRunId`/`latestRunId` per thread while normalizing the snapshot.

### Thread read model

| Protocol 1 | Protocol 2 |
| --- | --- |
| `latestTurn.{state,requestedAt,startedAt,completedAt}` | `status`, `activityRunStatus`, `latestRunRequestedAt`, `latestRunStartedAt`, `latestRunCompletedAt` |
| `session.{status,providerName,lastError,updatedAt}` | `status`/`activityRunStatus`, `providerInstanceId`, `lastError`, `updatedAt` |
| `hasPendingApprovals`, `hasPendingUserInput` | one `pendingRuntimeRequest` with a `kind` |
| `backgroundLiveness` | `pendingBackgroundTasks` |
| archived threads inline, flagged by `archivedAt` | separate `archivedThreads` array |

A pending request of kind `user_input` is a question; `auth_refresh` is neither a question nor an approval; anything else is an approval. The server classifies them the same way and warns that clients must agree.

### Thread detail

| Protocol 1 | Protocol 2 |
| --- | --- |
| `{ snapshotSequence, thread }` | `{ snapshotSequence, projection }` — **no `thread` key** |
| `thread.messages` | `projection.messages` (same shape) |
| `thread.activities` event log | `projection.runtimeRequests`, current state with a `status` |

Reading `response.thread` on protocol 2 yields `undefined`, which surfaces as "Thread not found" for every thread and an empty summary on every row.

Approvals are rebuilt from `runtimeRequests`: `status: "pending"` becomes an `approval.requested`, anything else an `approval.resolved`. `kind` needs no mapping — `ProviderRequestKind` is `command` / `file-read` / `file-change` / `mcp-elicitation` / `permission`. A `user_input` request carries no question text on this route, so the watch cannot rebuild an answerable prompt from it; the thread still reads as needing attention from the shell flags.

### Subagent threads

Protocol 2 represents a provider's subagents as real child threads and includes them in the shell list. They carry `lineage.relationshipToParent === "subagent"` and are titled by their working directory, so they surface as rows like `/root/<something>` that the user never started. T3's own thread lists filter them out with that exact test, and so does P3. A `fork` is a thread the user genuinely branched and is kept.

## Required API Surface

### Auth

A bearer access token issued by the CLI:

```sh
t3 auth session issue --ttl 365d --label "P3 watch" --token-only
```

That grants `AuthAdministrativeScopes`, which includes the two scopes the app needs: `orchestration:read` and `orchestration:operate`. The token must be issued against the same data directory the server runs with (`--base-dir`, or the default).

Every REST request carries it as `Authorization: Bearer <token>`. There is no
pairing exchange or session cookie involved.

For model discovery when starting a thread, the bridge posts
the bearer token to `POST /api/auth/websocket-ticket`, then uses the returned
short-lived ticket as `wsTicket` on `/ws`. The bearer token is never placed in
the WebSocket URL.

### Reads

| Route | Used for |
| --- | --- |
| `GET /api/orchestration/shell` | Projects and thread lifecycle: one request per host |
| `GET /api/orchestration/threads/:threadId?turnLimit=N` | Thread bodies: messages, activities, session |
| `POST /api/auth/websocket-ticket` + `server.getConfig` WebSocket RPC | Live provider/model catalog for the new-thread picker |
| `POST /api/auth/websocket-ticket` + `vcs.refreshStatus` WebSocket RPC | Live PR state used by T3's settled partition |

The shell route serves `OrchestrationShellSnapshot`, the same lifecycle read
model the T3 web sidebar starts from: no message bodies, but `session`,
`latestTurn` and every persisted lifecycle field. The bridge augments it with
the same live VCS PR state T3 uses, then the watch's list, roll-up and detail
card all classify that enriched shell; the thread detail route only supplies
bodies.

`GET /api/orchestration/snapshot` also exists and returns the fuller command read model. The app does not use it — it is a bigger response and carries nothing the shell route does not.

Turn windows requested by the app:

- `turnLimit=6` for list rows and the detail card
- `turnLimit=40` for the transcript view

The thread detail response is `{ snapshotSequence, thread, page }`.

Provider snapshots are not present in either orchestration REST read model.
For a new thread, the phone reads `server.getConfig`, puts the project's
`defaultModelSelection` first, then lists live non-legacy models from enabled
and installed providers. The config is cached for five minutes. If the phone
runtime cannot open the WebSocket or the request fails, the menu contains only
the project default already returned by the shell route, so thread creation is
still available.

### Thread lifecycle parity

`threadState()` in the bridge is a port of T3's `effectiveSettled` / `effectiveSnoozed` (`packages/client-runtime/src/state/threadSettled.ts`) plus the bucket order the sidebar applies around them (`apps/web/src/components/Sidebar.tsx`): **snooze outranks a pin, a pin outranks settled**. Three things a thread can be blocked on all read as `needs`, matching the sidebar's status pills:

| Shell field | T3 pill | Watch |
| --- | --- | --- |
| `hasPendingApprovals` | Pending Approval | `needs`, reply routed to `thread.approval.respond` |
| `hasPendingUserInput` | Awaiting Input | `needs`, reply routed to `thread.user-input.respond` |
| `interactionMode === "plan"` + `hasActionableProposedPlan` + settled latest turn | Plan Ready | `needs`, reply sent as a normal turn |

Background liveness follows T3's sidebar priority below Plan Ready and errors.
`"working"` maps to the animated `run` row; `"monitoring"` maps to a distinct
`monitor` row labelled **Monitoring**. The latter uses Casio green and does not
pulse or keep the watch animation timer alive, matching T3's calm
background-presence treatment. On the host page its count joins the running
band and its roster cells stay green. Settled and snoozed buckets still outrank
either background label.

`pinnedAt` suppresses the settled bucket entirely, including an explicit
`settledOverride: "settled"` — the server's decider clears one on the other, so
the two only ever coexist on a raced write. Pinned rows form the first block in
the watch's active scope, ordered by `pinOrderKey`; keyless pins fall back to
newest-created order, matching `sortPinnedThreadsByOrderKey`. The watch draws
that block as a **PINNED** section above a **THREADS** one, with a pushpin on
each pinned row; both headers appear only when something is actually pinned, so
an unpinned host keeps the single unlabelled run of rows. The row carries a
`pinned` flag rather than a section boundary, and the watch counts the leading
run of it — an out-of-order pin lands in the ordinary section with its marker
still drawn instead of mislabelling the rows between.

**Settled is derived, not stored.** The API carries only `settledOverride` and
`settledAt`, and both are null on a thread that settled by inactivity or PR
state — every client computes the rest from the same shell and VCS inputs. So
"the server says it is settled" is not a thing that can be asked; a client that
classifies differently is a client missing one of the inputs.

- **`sidebarAutoSettleAfterDays`.** A web client setting kept in `localStorage`
  and never sent to the server, so no route can carry it. It is entered by hand
  on the Pebble settings page instead (*Settle a quiet thread after*, days or
  blank for never, clamped to T3's 1–90) and defaults to T3's 3.
- **`sidebarAutoSettleOnMerge`.** This is client-local too. The Pebble setting
  *Auto-settle merged pull requests* defaults on, like T3; turn it off in both
  clients if merged PRs should remain active until another rule settles them.
- **Change-request state.** T3 settles a thread whose PR closed, settles a
  merged PR when the preceding setting is on, and refuses inactivity
  auto-settle while the PR is open. The bridge batches `vcs.refreshStatus`
  requests for the host's distinct checkouts over one ticketed WebSocket per
  poll. Only a PR whose reported ref matches the thread branch is applied.
  Like T3, it retains an observed merged/closed snapshot for a local thread
  after the shared checkout moves away; worktree snapshots remain
  branch-matched. A VCS failure retains prior snapshots and never turns a
  reachable host into an offline row.

### Writes

`POST /api/orchestration/dispatch`, carrying a `ClientOrchestrationCommand`:

- `project.create`
- `project.delete` with `force: true` (removes the project's threads too)
- `thread.create`
- `thread.turn.start`
- `thread.turn.interrupt`
- `thread.settle` / `thread.unsettle`
- `thread.pin` / `thread.unpin`
- `thread.approval.respond`
- `thread.user-input.respond`

`thread.unsettle` requires `reason: "user"`. Settling sets `settledAt` and
`settledOverride: "settled"`; unsettling clears `settledAt` and sets
`settledOverride: "active"`.

`thread.pin` takes an optional `orderKey`. The watch never sends one: a
two-button list has no way to express a position, so the server appends a
keyless pin to the end of the pinned block. Pinning is also the one-press way
out of the settled list, because T3's decider emits `thread.unsettled` and
`thread.unsnoozed` alongside `thread.pinned` for a thread that was in either.
Re-pinning an already-pinned thread keeps the original `pinnedAt`.

`project.create` honours `createWorkspaceRootIfMissing`, and the REST
normalizer resolves `workspaceRoot` before dispatch, so the watch can create a
project and its directory without an agent involved.

The bridge uses the host's configured project root when present. Older setup
bundles can omit it: the bridge then uses the common parent of existing project
paths, or `server.getConfig.cwd` when the server is completely fresh. It never
falls back to the filesystem root.

A malformed command is rejected with `400 invalid_request`.

#### Starting a thread takes two commands, not one

`thread.turn.start` accepts a `bootstrap.createThread` block that is supposed to
create the thread and start the first turn together. **Do not use it over REST.**
The REST handler validates the block and then ignores it: it calls
`orchestrationEngine.dispatch` directly, bypassing the `dispatchNormalizedCommand`
router that is the only thing routing a bootstrap command into the branch which
creates the thread. That router is wired into the WebSocket RPC path alone.

The visible symptom is a `500 orchestration_dispatch_failed`, because the turn
lands on a thread that does not exist yet:

```json
{"_tag":"OrchestrationCommandInvariantError","commandType":"thread.turn.start",
 "detail":"Thread '...' does not exist for command 'thread.turn.start'."}
```

Note that an invalid field inside the block still returns `400`, so the block
being accepted proves nothing about it being acted on.

So the bridge dispatches `thread.create` first and then `thread.turn.start`
against that thread id, carrying no bootstrap. Both commands carry the model
chosen on the watch; choosing the first row preserves the project's complete
server-side default selection, including its option values. Thread ids do not
have to be UUIDs; the bridge's own `pebble-thread-...` format is accepted.

### Error shapes

Errors are tagged JSON, for example:

```json
{"_tag":"EnvironmentAuthInvalidError","code":"auth_invalid","reason":"missing_credential","traceId":"..."}
```

The bridge reads `reason` / `requiredScope` for its status line. Relevant statuses: `401` (bad or missing token), `403` (missing scope), `404` with `reason: "thread_not_found"`.

## Notes

- `access-control-allow-origin` is `*`, so the PebbleKit JS sandbox can call the API directly.
- The bridge uses non-subscription WebSocket RPCs for `server.getConfig` (when
  the model picker opens) and batched `vcs.refreshStatus` calls (during the
  minute host poll). Thread state and bodies still poll the REST routes; the
  subscription RPCs (`orchestration.subscribeShell`,
  `orchestration.subscribeThread`) remain a poor fit for a watch.
- `t3 serve` supports `--host`, `--port`, `--base-dir`, and `--no-browser`, which is all the launch script needs. Mainline also ships `--tailscale-serve` if you would rather it manage Tailscale itself.
