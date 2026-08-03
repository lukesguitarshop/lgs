# Scheduled Deal Finder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the Reverb and Sweetwater deal finders automatically at 8:00am US Eastern every day, from inside the API process already deployed on Fly.

**Architecture:** A new `ScheduledDealFinderService : BackgroundService` ticks every 60 seconds and asks whether today's 8:00am ET run is due and unclaimed. Claiming is done by inserting a document into a new `scheduled_job_runs` collection guarded by a unique index, which makes the schedule idempotent across restarts and overlapping deploys. The run decision itself is a pure static function so it can be reasoned about without waiting for 8:00am.

**Tech Stack:** .NET 9, ASP.NET Core hosted services, MongoDB.Driver 3.5.2.

**Design doc:** `docs/plans/2026-08-03-scheduled-deal-finder-design.md`

---

## Note On Testing

`GuitarDb.sln` contains only `GuitarDb.API` and `GuitarDb.Scraper` — **there is no test project**, so this plan cannot use the normal red/green TDD loop. Verification steps below are real commands with real expected output (`dotnet build`, plus a runtime check in Task 6 that exercises the scheduler end-to-end against local Mongo without calling any external API). Do not invent `dotnet test` commands; they will fail.

If you would rather have real unit tests, stop and add an xunit project first — `DealFinderSchedule.GetDueRunDate` in Task 3 is a pure function designed to be tested directly.

---

## Task 1: Add the `ScheduledJobRun` model

**Files:**
- Create: `backend/GuitarDb.API/Models/ScheduledJobRun.cs`

**Step 1: Create the model**

Follow the BSON attribute style used by `backend/GuitarDb.API/Models/MonthlySnapshot.cs`.

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// One record per scheduled job execution. Acts as the idempotency marker that
/// stops a job running twice on the same day across restarts and deploys.
/// </summary>
public class ScheduledJobRun
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("job_name")]
    public string JobName { get; set; } = string.Empty;

    /// <summary>
    /// The date the run belongs to, in the job's configured time zone, as "yyyy-MM-dd".
    /// Stored as a string so the calendar date is unambiguous regardless of server time zone.
    /// </summary>
    [BsonElement("run_date")]
    public string RunDate { get; set; } = string.Empty;

    [BsonElement("started_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime StartedAt { get; set; }

    [BsonElement("completed_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    /// <summary>running | success | partial | failed</summary>
    [BsonElement("outcome")]
    public string Outcome { get; set; } = "running";

    [BsonElement("details")]
    public string? Details { get; set; }
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: `Build succeeded`, 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/ScheduledJobRun.cs
git commit -m "feat(scheduler): add ScheduledJobRun model"
```

---

## Task 2: Add Mongo accessors for the run marker

**Files:**
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs`

**Step 1: Declare the collection field**

Add after the `_userActivitiesCollection` declaration (currently line 27):

```csharp
    private readonly IMongoCollection<ScheduledJobRun> _scheduledJobRunsCollection;
```

**Step 2: Initialise the collection**

Add after the `_userActivitiesCollection` assignment in the constructor (currently line 60):

```csharp
        _scheduledJobRunsCollection = database.GetCollection<ScheduledJobRun>("scheduled_job_runs");
```

**Step 3: Add the unique index**

Inside `CreateIndexesAsync()`, alongside the existing index registrations:

```csharp
            // Unique on (job_name, run_date) - this is what makes a scheduled job
            // idempotent. Two instances racing during a deploy both try to insert;
            // exactly one wins and the loser skips.
            var scheduledJobRunIndex = Builders<ScheduledJobRun>.IndexKeys
                .Ascending(r => r.JobName)
                .Ascending(r => r.RunDate);
            await _scheduledJobRunsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<ScheduledJobRun>(scheduledJobRunIndex,
                    new CreateIndexOptions { Name = "job_name_run_date_uniq", Unique = true })
            );
```

**Step 4: Add the three accessor methods**

Add these as public methods on `MongoDbService`:

```csharp
    /// <summary>
    /// True if a run has already been recorded for this job on this date, whether it
    /// succeeded, failed, or is still in flight.
    /// </summary>
    public async Task<bool> HasScheduledJobRunAsync(string jobName, string runDate, CancellationToken ct = default)
    {
        var filter = Builders<ScheduledJobRun>.Filter.And(
            Builders<ScheduledJobRun>.Filter.Eq(r => r.JobName, jobName),
            Builders<ScheduledJobRun>.Filter.Eq(r => r.RunDate, runDate));

        return await _scheduledJobRunsCollection.Find(filter).AnyAsync(ct);
    }

    /// <summary>
    /// Attempts to claim this job/date pair. Returns false if another instance already
    /// claimed it, which the unique index enforces via a duplicate key error.
    /// </summary>
    public async Task<bool> TryClaimScheduledJobRunAsync(string jobName, string runDate, CancellationToken ct = default)
    {
        try
        {
            await _scheduledJobRunsCollection.InsertOneAsync(new ScheduledJobRun
            {
                JobName = jobName,
                RunDate = runDate,
                StartedAt = DateTime.UtcNow,
                Outcome = "running"
            }, cancellationToken: ct);

            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task CompleteScheduledJobRunAsync(
        string jobName,
        string runDate,
        string outcome,
        string? details,
        CancellationToken ct = default)
    {
        var filter = Builders<ScheduledJobRun>.Filter.And(
            Builders<ScheduledJobRun>.Filter.Eq(r => r.JobName, jobName),
            Builders<ScheduledJobRun>.Filter.Eq(r => r.RunDate, runDate));

        var update = Builders<ScheduledJobRun>.Update
            .Set(r => r.CompletedAt, DateTime.UtcNow)
            .Set(r => r.Outcome, outcome)
            .Set(r => r.Details, details);

        await _scheduledJobRunsCollection.UpdateOneAsync(filter, update, cancellationToken: ct);
    }
```

`ServerErrorCategory` lives in `MongoDB.Driver`, which the file already imports. If the compiler cannot resolve it, add `using MongoDB.Driver.Core.Servers;` — do not guess at a different exception type.

**Step 5: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: `Build succeeded`, 0 errors.

**Step 6: Commit**

```bash
git add backend/GuitarDb.API/Services/MongoDbService.cs
git commit -m "feat(scheduler): add scheduled_job_runs collection and accessors"
```

---

## Task 3: Add the schedule options and the pure run-decision function

**Files:**
- Create: `backend/GuitarDb.API/Services/DealFinderSchedule.cs`

This mirrors the existing convention where result/option types live next to the service that uses them (see `DealFinderResult` at the bottom of `DealFinderService.cs`).

**Step 1: Create the file**

```csharp
namespace GuitarDb.API.Services;

public class DealFinderScheduleOptions
{
    /// <summary>Off by default so a missing config section can never start scraping.</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>24-hour local time, "HH:mm".</summary>
    public string TimeOfDay { get; set; } = "08:00";

    /// <summary>IANA time zone id. .NET 9 resolves these on Windows and Linux alike.</summary>
    public string TimeZone { get; set; } = "America/New_York";

    public bool RunReverb { get; set; } = true;

    public bool RunSweetwater { get; set; } = true;

    /// <summary>
    /// How long after the scheduled time a missed run may still fire. Without this bound,
    /// a machine starting at 11pm would satisfy "past 8am today, has not run today" and
    /// fire a run at 11pm.
    /// </summary>
    public int CatchUpWindowHours { get; set; } = 4;
}

public static class DealFinderSchedule
{
    /// <summary>
    /// Returns the local date whose run is currently due, or null if none is.
    /// Pure - no clock, no config, no I/O - so the DST and catch-up cases can be
    /// reasoned about and exercised directly.
    /// </summary>
    public static DateOnly? GetDueRunDate(
        DateTime utcNow,
        TimeZoneInfo timeZone,
        TimeOnly timeOfDay,
        int catchUpWindowHours)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone);
        var today = DateOnly.FromDateTime(localNow);
        var scheduledLocal = today.ToDateTime(timeOfDay);

        // Not yet time today.
        if (localNow < scheduledLocal)
            return null;

        // Too late - the catch-up window has closed, wait for tomorrow.
        if (localNow >= scheduledLocal.AddHours(catchUpWindowHours))
            return null;

        return today;
    }
}
```

Comparing local wall-clock times is what makes DST free: the framework does the UTC conversion each tick, so 8:00am stays 8:00am across both transitions. 8:00am never lands in the spring-forward gap, so there is no invalid-local-time case to handle.

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: `Build succeeded`, 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/DealFinderSchedule.cs
git commit -m "feat(scheduler): add deal finder schedule options and due-date logic"
```

---

## Task 4: Add the `ScheduledDealFinderService` background service

**Files:**
- Create: `backend/GuitarDb.API/Services/ScheduledDealFinderService.cs`

**Step 1: Create the service**

Structurally this follows `OfferExpirationService`, with one deliberate difference: it does **not** create a service scope, because `DealFinderService`, `SweetwaterDealFinderService`, and `MongoDbService` are all registered as singletons.

```csharp
using System.Globalization;

namespace GuitarDb.API.Services;

public class ScheduledDealFinderService : BackgroundService
{
    private const string JobName = "deal-finder";

    private readonly DealFinderService _dealFinder;
    private readonly SweetwaterDealFinderService _sweetwaterDealFinder;
    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ScheduledDealFinderService> _logger;
    private readonly TimeSpan _tickInterval = TimeSpan.FromSeconds(60);

    // Avoids a Mongo round trip on every tick once we know today is handled.
    private DateOnly? _lastRunDate;

    public ScheduledDealFinderService(
        DealFinderService dealFinder,
        SweetwaterDealFinderService sweetwaterDealFinder,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<ScheduledDealFinderService> logger)
    {
        _dealFinder = dealFinder;
        _sweetwaterDealFinder = sweetwaterDealFinder;
        _mongoDbService = mongoDbService;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = _configuration.GetSection("DealFinder:Schedule").Get<DealFinderScheduleOptions>()
            ?? new DealFinderScheduleOptions();

        if (!options.Enabled)
        {
            _logger.LogInformation("Scheduled Deal Finder is disabled");
            return;
        }

        TimeZoneInfo timeZone;
        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(options.TimeZone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unknown time zone '{TimeZone}' - Scheduled Deal Finder will not run", options.TimeZone);
            return;
        }

        if (!TimeOnly.TryParse(options.TimeOfDay, CultureInfo.InvariantCulture, out var timeOfDay))
        {
            _logger.LogError("Invalid TimeOfDay '{TimeOfDay}' - Scheduled Deal Finder will not run", options.TimeOfDay);
            return;
        }

        _logger.LogInformation(
            "Scheduled Deal Finder starting - daily at {TimeOfDay} {TimeZone} (Reverb: {Reverb}, Sweetwater: {Sweetwater})",
            options.TimeOfDay, timeZone.Id, options.RunReverb, options.RunSweetwater);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(options, timeZone, timeOfDay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Scheduled Deal Finder tick");
            }

            try
            {
                await Task.Delay(_tickInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("Scheduled Deal Finder stopping");
    }

    private async Task TickAsync(
        DealFinderScheduleOptions options,
        TimeZoneInfo timeZone,
        TimeOnly timeOfDay,
        CancellationToken ct)
    {
        var dueDate = DealFinderSchedule.GetDueRunDate(
            DateTime.UtcNow, timeZone, timeOfDay, options.CatchUpWindowHours);

        if (dueDate is not { } runDate)
            return;

        if (_lastRunDate == runDate)
            return;

        var runDateKey = runDate.ToString("yyyy-MM-dd");

        if (await _mongoDbService.HasScheduledJobRunAsync(JobName, runDateKey, ct))
        {
            _lastRunDate = runDate;
            return;
        }

        if (!await _mongoDbService.TryClaimScheduledJobRunAsync(JobName, runDateKey, ct))
        {
            _logger.LogInformation("Deal finder run for {RunDate} was claimed by another instance", runDateKey);
            _lastRunDate = runDate;
            return;
        }

        _lastRunDate = runDate;
        await RunJobAsync(options, runDateKey, ct);
    }

    private async Task RunJobAsync(DealFinderScheduleOptions options, string runDateKey, CancellationToken ct)
    {
        _logger.LogInformation("===== Scheduled Deal Finder starting run for {RunDate} =====", runDateKey);

        var details = new List<string>();
        var attempted = 0;
        var failures = 0;

        if (options.RunReverb)
        {
            attempted++;
            try
            {
                var result = await _dealFinder.RunAsync(ct);
                details.Add($"Reverb: {result.Message}");

                if (result.Success)
                {
                    _logger.LogInformation(
                        "Scheduled Reverb deal finder: {Checked} checked, {Deals} deals, took {Duration}",
                        result.ListingsChecked, result.DealsFound, result.Duration);
                }
                else
                {
                    // Includes the "already running" case when an admin triggered a
                    // manual run - a skip, not a crash.
                    failures++;
                    _logger.LogWarning("Scheduled Reverb deal finder did not complete: {Message}", result.Message);
                }
            }
            catch (Exception ex)
            {
                failures++;
                details.Add($"Reverb: {ex.Message}");
                _logger.LogError(ex, "Scheduled Reverb deal finder failed");
            }
        }

        // Sequential, not parallel - two long scrapes would contend for the 512mb Fly VM.
        if (options.RunSweetwater)
        {
            attempted++;
            try
            {
                var result = await _sweetwaterDealFinder.RunAsync(ct);
                details.Add($"Sweetwater: {result.Message}");

                if (result.Success)
                {
                    _logger.LogInformation(
                        "Scheduled Sweetwater deal finder: {Checked} checked, {Deals} deals, took {Duration}",
                        result.ListingsChecked, result.DealsFound, result.Duration);
                }
                else
                {
                    failures++;
                    _logger.LogWarning("Scheduled Sweetwater deal finder did not complete: {Message}", result.Message);
                }
            }
            catch (Exception ex)
            {
                failures++;
                details.Add($"Sweetwater: {ex.Message}");
                _logger.LogError(ex, "Scheduled Sweetwater deal finder failed");
            }
        }

        var outcome = failures == 0 ? "success"
            : failures == attempted ? "failed"
            : "partial";

        await _mongoDbService.CompleteScheduledJobRunAsync(
            JobName, runDateKey, outcome, string.Join(" | ", details), CancellationToken.None);

        _logger.LogInformation("===== Scheduled Deal Finder finished: {Outcome} =====", outcome);
    }
}
```

Note the deliberate `CancellationToken.None` on the completion write: if the app is shutting down mid-run, the marker should still be updated rather than left as `running`.

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: `Build succeeded`, 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/ScheduledDealFinderService.cs
git commit -m "feat(scheduler): add ScheduledDealFinderService background service"
```

---

## Task 5: Register the service and add configuration

**Files:**
- Modify: `backend/GuitarDb.API/Program.cs:81`
- Modify: `backend/GuitarDb.API/appsettings.json`
- Modify: `backend/GuitarDb.API/appsettings.Development.json`

**Step 1: Register the hosted service**

In `Program.cs`, add below the existing `AddHostedService` lines (currently 80-81):

```csharp
builder.Services.AddHostedService<ScheduledDealFinderService>();
```

**Step 2: Add the production schedule config**

In `appsettings.json`, add a `Schedule` block inside the existing `DealFinder` object, as a sibling of `PriceGuideCacheMinutes` and `SearchFilterSets`:

```json
    "Schedule": {
      "Enabled": true,
      "TimeOfDay": "08:00",
      "TimeZone": "America/New_York",
      "RunReverb": true,
      "RunSweetwater": true,
      "CatchUpWindowHours": 4
    },
```

**Step 3: Disable it in development**

`appsettings.Development.json` currently has no `DealFinder` section, and configuration merges rather than replaces — so without this override, local development would inherit `Enabled: true` and scrape every morning. Add a top-level section:

```json
  "DealFinder": {
    "Schedule": {
      "Enabled": false
    }
  }
```

**Step 4: Verify it compiles and boots**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: `Build succeeded`, 0 errors.

**Step 5: Commit**

```bash
git add backend/GuitarDb.API/Program.cs backend/GuitarDb.API/appsettings.json backend/GuitarDb.API/appsettings.Development.json
git commit -m "feat(scheduler): register scheduled deal finder and add 8am ET config"
```

---

## Task 6: Runtime verification

The point of this task is to prove the scheduler actually fires, claims a run, and writes a marker — **without calling Reverb or Sweetwater**. It runs against local Mongo (`appsettings.json` points `MongoDb:ConnectionString` at localhost), so nothing touches production.

**Step 1: Confirm local Mongo is running**

Run: `docker ps` (or check your local Mongo service)
If Mongo is not up, start it — the API will not boot without it.

**Step 2: Temporarily configure a firing window with both finders off**

Edit `appsettings.Development.json` to:

```json
  "DealFinder": {
    "Schedule": {
      "Enabled": true,
      "TimeOfDay": "00:00",
      "TimeZone": "America/New_York",
      "RunReverb": false,
      "RunSweetwater": false,
      "CatchUpWindowHours": 24
    }
  }
```

`TimeOfDay: 00:00` with a 24-hour catch-up window means "due right now, whatever time it is", and both finders are off so no external API is called.

**Step 3: Run the API and watch the logs**

Run: `dotnet run --project backend/GuitarDb.API`

Expected within ~60 seconds of startup:

```
Scheduled Deal Finder starting - daily at 00:00 America/New_York (Reverb: False, Sweetwater: False)
===== Scheduled Deal Finder starting run for <today> =====
===== Scheduled Deal Finder finished: success =====
```

If you see `Scheduled Deal Finder is disabled`, the config override did not take — check you edited the Development file and that `ASPNETCORE_ENVIRONMENT=Development`.

**Step 4: Confirm the marker document and idempotency**

Stop the API (Ctrl+C), then start it again with the same config.

Expected: the startup line appears, but **no** `starting run` line — the existing marker suppresses the second run. This is the restart-safety property; it is the single most important behaviour to confirm.

Check the document directly:

```bash
mongosh GuitarDb --quiet --eval "db.scheduled_job_runs.find().pretty()"
```

Expected: one document with `job_name: "deal-finder"`, today's `run_date`, and `outcome: "success"`.

**Step 5: Clean up the test marker and revert the config**

```bash
mongosh GuitarDb --quiet --eval "db.scheduled_job_runs.deleteMany({job_name: 'deal-finder'})"
```

Then revert `appsettings.Development.json` back to the Task 5 version (`Enabled: false` only). **Do not commit the temporary config from Step 2.**

Run: `git diff backend/GuitarDb.API/appsettings.Development.json`
Expected: no output — the file matches what was committed in Task 5.

**Step 6: Commit (only if anything changed)**

If Step 5 left the tree clean, there is nothing to commit. Confirm with:

Run: `git status --short`
Expected: no changes under `backend/GuitarDb.API/`.

---

## Task 7: Deploy

**Step 1: Deploy to Fly**

Deploying is a user decision — confirm before running this.

Per project memory, `fly deploy` in this environment needs the sandbox disabled and an explicit `FLY_API_TOKEN` from `~/.fly/config.yml`.

**Step 2: Confirm the schedule is live**

```bash
fly logs -a guitar-price-api
```

Expected shortly after boot:

```
Scheduled Deal Finder starting - daily at 08:00 America/New_York (Reverb: True, Sweetwater: True)
```

**Step 3: Confirm the first real run**

The morning after deploy, check that a `scheduled_job_runs` document exists for that date with `outcome: "success"`, and that new potential buys appear in the admin portal.
