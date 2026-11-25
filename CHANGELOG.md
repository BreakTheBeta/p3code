# Changelog

Notable user-facing changes are recorded here.

## 0.27

- Added clearance between the header text and the loading rail.

## 0.26

- Unified sync, list, detail, transcript, model lookup, and submission loading
  around an elapsed-time dot-matrix shutter.

## 0.25

- Reworked sync, list, and detail loading as center-out pixel scans.
- Running threads cycle a fixed four-pixel status marker.

## 0.24

- Restored the v0.22 host dashboard.
- Added project names and longer previews to thread rows. Thread detail adds
  project, branch, pull request and model when available, plus fuller responses
  and approval context.

## 0.23

- Replaced the dashboard's duplicate roster meters with six compact readouts,
  the next thread that needs attention, and a recent activity preview.

## 0.22

- Added dot-matrix labels, roster cells, selection markers, and transcript roles.
- Split the dashboard's attention count into input and errors, and show running
  and waiting counts separately within in-flight work.
- Show failure reasons in thread previews when available.

## 0.21

- Redesigned the Pebble display with dot-matrix counters, dotted rules, and a
  high-contrast palette. The sync rail moves on elapsed time during requests.
- Used proportional type for thread titles and descriptions, with a preview
  when Fold includes the latest message in its shell response.
- Updated Fold protocol 2 state mapping for threads waiting on another thread
  and background tasks the agent awaits. Pending questions can be answered
  from the watch when Fold includes their turn items.

## 0.20

- Added a **PINNED** section to the thread list, with a pushpin marker on each
  pinned row and Pin/Unpin in the thread action menu.
- Rebranded the application and repository as **P3 — T3 Code for Pebble**.
- Added a new P3 launcher icon and repository identity.
- Added long-SELECT project deletion with a cancel-first menu.
- Expanded deterministic emulator screenshots to every primary watch surface.
- Migrated settings to P3 storage keys while preserving existing installations.
- Introduced `p3code1` setup lines while retaining legacy-line compatibility.

## 0.19

- Added live pull-request-aware settlement and the monitoring state.
- Added project creation, multi-host support, scoped thread lists, and model
  selection against stock T3 Code.
