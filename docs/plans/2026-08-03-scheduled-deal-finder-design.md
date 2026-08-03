# Scheduled Deal Finder - Design Document

**Date:** 2026-08-03
**Status:** Approved

## Overview

Run both deal finders automatically at 8:00am US Eastern every day, from inside the
already-deployed API, replacing manual triggering from the admin portal.

The original deal finder design (2026-02-18) called for hourly runs via Windows Task
Scheduler. That ties the job to a developer workstation being awake. This design moves
scheduling into the API process that already runs 24/7 on Fly.

## Requirements

- Run `DealFinderService` (Reverb) and `SweetwaterDealFinderService` daily at 8:00am ET
- Handle daylight saving time without twice-yearly manual edits
- Survive process restarts and deploys without skipping or duplicating a day's run
- Never collide with a manual run triggered from the admin portal
- Be switchable off, and off by default in local development

## Approaches Considered

| Approach | Verdict |
|----------|---------|
| **In-process `BackgroundService` in the API** | **Chosen.** No new infrastructure, no new secrets, matches the two hosted services already in the codebase. |
| GitHub Actions cron hitting the admin endpoints | Rejected. `AdminController` is `[AdminAuthorize]`, so it needs a stored admin credential; runs are long enough to risk an HTTP timeout; Actions cron drifts 5-30 minutes and needs manual DST edits. |
| Separate Fly scheduled machine running `GuitarDb.Scraper` | Rejected. Fly machine schedules only support `hourly`/`daily`/`weekly` with no time-of-day control. Also needs a second deploy pipeline and duplicated secrets, and the console app has no Sweetwater support. |

## Architecture

### New component

`backend/GuitarDb.API/Services/ScheduledDealFinderService.cs` — a `BackgroundService`
registered in `Program.cs` alongside `OfferExpirationService` and `DeliveryTrackingService`.

It depends on `DealFinderService`, `SweetwaterDealFinderService`, and `MongoDbService`.
All three are singletons, so no service scope is needed — unlike `OfferExpirationService`,
which creates one because it resolves scoped services.

### Scheduling loop

The loop ticks every 60 seconds and evaluates a single predicate: *is it past 8:00am ET
today, and has today's run not already happened?*

- "Today" is computed in `America/New_York` via `TimeZoneInfo.FindSystemTimeZoneById`.
  DST is handled by the framework rather than by arithmetic. .NET 9 resolves IANA time
  zone ids on both Windows and Linux, so this works in local dev and on Fly.
- 8:00am never falls in the spring-forward gap, so there is no invalid-local-time case
  to handle.
- A 60-second tick starts the run within a minute of 8:00 and is far more restart-resilient
  than computing one long `Task.Delay` to the next occurrence.

### Catch-up window

If the machine is down at 8:00 and starts at 8:20, the run still fires. If it starts at
3:00pm, it does not — it waits for tomorrow. The bound is configurable and defaults to
4 hours.

Without this window, a machine starting at 11:00pm would satisfy "past 8:00am today, has
not run today" and fire a run at 11:00pm.

### Run marker

New `scheduled_job_runs` collection, following the existing snake_case collection naming.
One document per job name, holding the last run date, outcome, and summary counts.

This is what makes the schedule idempotent across restarts: two rapid deploys around
8:00am cannot double-run, and the record survives the process dying later in the day.

### Execution order

Reverb runs first, then Sweetwater, sequentially — not in parallel, to avoid two long
scrape jobs contending for the 512mb Fly VM.

Each run is wrapped in its own try/catch so a Sweetwater failure does not discard a
successful Reverb run. The marker records partial success.

### Collision safety

`DealFinderService` and `SweetwaterDealFinderService` both hold static `_isRunning` locks
and return `Success = false` with an "already running" message rather than throwing. A
scheduled run that overlaps a manual admin run is therefore logged as a skip, not an error.

## Configuration

```json
"DealFinder": {
  "Schedule": {
    "Enabled": true,
    "TimeOfDay": "08:00",
    "TimeZone": "America/New_York",
    "RunReverb": true,
    "RunSweetwater": true,
    "CatchUpWindowHours": 4
  }
}
```

`Enabled` is `false` in `appsettings.Development.json` so local runs do not hit Reverb and
Sweetwater every morning, and `true` in `appsettings.json` for production.

## Error Handling

Any exception inside the tick loop is caught and logged without terminating the service,
matching the shape of `OfferExpirationService.ExecuteAsync`. A failing day is logged and
retried the next morning; there is no intra-day retry.

## Testing

The run decision is extracted as a pure static method — `ShouldRunNow(nowUtc, lastRunDate,
config)` — so the DST boundary, catch-up window, and already-ran-today cases can be
exercised without waiting for 8:00am or touching Mongo.

**Note:** `GuitarDb.sln` contains only `GuitarDb.API` and `GuitarDb.Scraper` — there is no
test project. This design extracts the pure function so the logic is testable, but does not
add a test project. Adding one is a separate decision.

## Out of Scope

- An admin endpoint or UI surfacing last-run status (the `scheduled_job_runs` document is
  written to support this later, but nothing reads it yet)
- Intra-day retries on failure
- Email or push notification when deals are found
