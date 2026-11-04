namespace GuitarDb.API.Services;

public class SweetwaterIntervalScanOptions
{
    /// <summary>Off by default so a missing config section can never start scraping.</summary>
    public bool Enabled { get; set; } = false;

    public int IntervalMinutes { get; set; } = 30;
}

/// <summary>
/// Scans Sweetwater Gear Exchange on a fixed interval - the Sweetwater counterpart of
/// <see cref="IncrementalDealFinderService"/>. Gear Exchange is small enough (about a
/// thousand matching listings, prices cached for a day) that each run is a full scan,
/// which also re-prices and clears out listings that sold.
/// </summary>
public class SweetwaterIntervalScanService : BackgroundService
{
    private readonly SweetwaterDealFinderService _sweetwater;
    private readonly DealFinderService _reverb;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SweetwaterIntervalScanService> _logger;

    // Lets startup and the Reverb quick check get going first.
    private readonly TimeSpan _startupDelay = TimeSpan.FromMinutes(5);

    public SweetwaterIntervalScanService(
        SweetwaterDealFinderService sweetwater,
        DealFinderService reverb,
        IConfiguration configuration,
        ILogger<SweetwaterIntervalScanService> logger)
    {
        _sweetwater = sweetwater;
        _reverb = reverb;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = _configuration.GetSection("DealFinder:Sweetwater").Get<SweetwaterIntervalScanOptions>()
            ?? new SweetwaterIntervalScanOptions();

        if (!options.Enabled)
        {
            _logger.LogInformation("Sweetwater interval scan is disabled");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(5, options.IntervalMinutes));
        _logger.LogInformation("Sweetwater interval scan starting - every {Interval}", interval);

        try
        {
            await Task.Delay(_startupDelay, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                var due = interval;

                if (_reverb.IsRunning || _sweetwater.IsRunning)
                {
                    // One scrape at a time on the 512mb VM; a scan started from the page
                    // also counts as this slot's run once it finishes.
                    due = TimeSpan.FromMinutes(1);
                }
                else
                {
                    try
                    {
                        var result = await _sweetwater.RunAsync(stoppingToken);
                        if (!result.Success)
                            _logger.LogWarning("Sweetwater interval scan did not complete: {Message}", result.Message);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        _logger.LogError(ex, "Sweetwater interval scan failed");
                    }
                }

                await Task.Delay(due, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }

        _logger.LogInformation("Sweetwater interval scan stopping");
    }
}
