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

    // Slot keys ("yyyy-MM-dd HH:mm") already handled by this process. Avoids a Mongo
    // round trip on every tick once a slot is known to be done. Pruned to the last two
    // local days so it cannot grow without bound.
    private readonly HashSet<string> _handledSlots = new();

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

        var timesOfDay = new List<TimeOnly>();
        foreach (var raw in options.TimesOfDay)
        {
            if (!TimeOnly.TryParse(raw, CultureInfo.InvariantCulture, out var parsed))
            {
                _logger.LogError("Invalid TimesOfDay entry '{TimeOfDay}' - Scheduled Deal Finder will not run", raw);
                return;
            }

            if (!timesOfDay.Contains(parsed))
                timesOfDay.Add(parsed);
        }

        if (timesOfDay.Count == 0)
        {
            _logger.LogError("TimesOfDay is empty or missing - Scheduled Deal Finder will not run");
            return;
        }

        timesOfDay.Sort();

        _logger.LogInformation(
            "Scheduled Deal Finder starting - daily at {TimesOfDay} {TimeZone} (Reverb: {Reverb}, Sweetwater: {Sweetwater})",
            string.Join(", ", timesOfDay.Select(t => t.ToString("HH\\:mm", CultureInfo.InvariantCulture))),
            timeZone.Id, options.RunReverb, options.RunSweetwater);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(options, timeZone, timesOfDay, stoppingToken);
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
        IReadOnlyList<TimeOnly> timesOfDay,
        CancellationToken ct)
    {
        var utcNow = DateTime.UtcNow;
        var openSlots = DealFinderSchedule.GetOpenSlots(
            utcNow, timeZone, timesOfDay, options.CatchUpWindowHours);

        PruneHandledSlots(DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone)));

        foreach (var slot in openSlots)
        {
            var handledKey = slot.ToString();

            if (_handledSlots.Contains(handledKey))
                continue;

            if (await _mongoDbService.HasScheduledJobRunAsync(JobName, slot.RunDateKey, slot.SlotKey, ct))
            {
                _handledSlots.Add(handledKey);
                continue;
            }

            if (!await _mongoDbService.TryClaimScheduledJobRunAsync(JobName, slot.RunDateKey, slot.SlotKey, ct))
            {
                _logger.LogInformation("Deal finder run for {Slot} was claimed by another instance", handledKey);
                _handledSlots.Add(handledKey);
                continue;
            }

            _handledSlots.Add(handledKey);
            await RunJobAsync(options, slot, ct);

            // One run per tick. These jobs are long, and any other open slot is still
            // open on the next tick.
            return;
        }
    }

    private void PruneHandledSlots(DateOnly localToday)
    {
        if (_handledSlots.Count == 0)
            return;

        var keep = new[]
        {
            localToday.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            localToday.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
        };

        _handledSlots.RemoveWhere(key => !keep.Any(d => key.StartsWith(d, StringComparison.Ordinal)));
    }

    private async Task RunJobAsync(DealFinderScheduleOptions options, ScheduledSlot slot, CancellationToken ct)
    {
        _logger.LogInformation("===== Scheduled Deal Finder starting run for {Slot} =====", slot);

        var details = new List<string>();
        var attempted = 0;
        var failures = 0;
        var skips = 0;

        if (options.RunReverb)
        {
            attempted++;
            try
            {
                var result = await _dealFinder.RunAsync(ct);

                if (result.Success)
                {
                    details.Add($"Reverb: {result.Message}");
                    _logger.LogInformation(
                        "Scheduled Reverb deal finder: {Checked} checked, {Deals} deals, took {Duration}",
                        result.ListingsChecked, result.DealsFound, result.Duration);
                }
                else if (result.Error is null)
                {
                    // The "already running" case when an admin triggered a manual run.
                    // A skip, not a crash - the service leaves Error null there, and sets
                    // it on every genuine failure.
                    skips++;
                    details.Add($"Reverb: skipped - {result.Message}");
                    _logger.LogInformation("Scheduled Reverb deal finder skipped: {Message}", result.Message);
                }
                else
                {
                    failures++;
                    details.Add($"Reverb: {result.Message}");
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

                if (result.Success)
                {
                    details.Add($"Sweetwater: {result.Message}");
                    _logger.LogInformation(
                        "Scheduled Sweetwater deal finder: {Checked} checked, {Deals} deals, took {Duration}",
                        result.ListingsChecked, result.DealsFound, result.Duration);
                }
                else if (result.Error is null)
                {
                    skips++;
                    details.Add($"Sweetwater: skipped - {result.Message}");
                    _logger.LogInformation("Scheduled Sweetwater deal finder skipped: {Message}", result.Message);
                }
                else
                {
                    failures++;
                    details.Add($"Sweetwater: {result.Message}");
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

        var outcome = failures > 0
            ? (failures == attempted ? "failed" : "partial")
            : skips > 0
                ? (skips == attempted ? "skipped" : "success")
                : "success";

        await _mongoDbService.CompleteScheduledJobRunAsync(
            JobName, slot.RunDateKey, slot.SlotKey, outcome, string.Join(" | ", details), CancellationToken.None);

        _logger.LogInformation("===== Scheduled Deal Finder finished {Slot}: {Outcome} =====", slot, outcome);
    }
}
