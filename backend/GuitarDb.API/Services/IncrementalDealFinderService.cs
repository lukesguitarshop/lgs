namespace GuitarDb.API.Services;

public class IncrementalDealFinderOptions
{
    /// <summary>Off by default so a missing config section can never start scraping.</summary>
    public bool Enabled { get; set; } = false;

    public int IntervalMinutes { get; set; } = 15;
}

/// <summary>
/// Runs the Reverb quick check on a fixed interval, so newly published listings show up
/// within minutes instead of waiting for the next full sweep. The full sweeps in
/// <see cref="ScheduledDealFinderService"/> still handle re-pricing and stale cleanup.
/// </summary>
public class IncrementalDealFinderService : BackgroundService
{
    private readonly DealFinderService _dealFinder;
    private readonly IConfiguration _configuration;
    private readonly ILogger<IncrementalDealFinderService> _logger;

    // Gives startup (and a catch-up full sweep, if one is due) a head start.
    private readonly TimeSpan _startupDelay = TimeSpan.FromMinutes(2);

    public IncrementalDealFinderService(
        DealFinderService dealFinder,
        IConfiguration configuration,
        ILogger<IncrementalDealFinderService> logger)
    {
        _dealFinder = dealFinder;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = _configuration.GetSection("DealFinder:Incremental").Get<IncrementalDealFinderOptions>()
            ?? new IncrementalDealFinderOptions();

        if (!options.Enabled)
        {
            _logger.LogInformation("Deal finder quick check is disabled");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, options.IntervalMinutes));
        _logger.LogInformation("Deal finder quick check starting - every {Interval}", interval);

        try
        {
            await Task.Delay(_startupDelay, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                // A check opened from the deals page resets the clock, so the timer
                // doesn't immediately repeat one that just ran.
                var last = _dealFinder.LastQuickCheckAt;
                var due = last is null ? TimeSpan.Zero : last.Value + interval - DateTime.UtcNow;

                if (due <= TimeSpan.Zero)
                {
                    due = interval;
                    try
                    {
                        var result = await _dealFinder.RunIncrementalAsync(stoppingToken);

                        if (!result.Success && result.Error is null)
                            due = TimeSpan.FromMinutes(1); // a full sweep is running - try again shortly
                        else if (!result.Success)
                            _logger.LogWarning("Deal finder quick check did not complete: {Message}", result.Message);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        _logger.LogError(ex, "Deal finder quick check failed");
                    }
                }

                await Task.Delay(due, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }

        _logger.LogInformation("Deal finder quick check stopping");
    }
}
