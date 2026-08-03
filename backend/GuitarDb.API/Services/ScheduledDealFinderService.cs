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
