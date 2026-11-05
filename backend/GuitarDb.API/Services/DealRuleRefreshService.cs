namespace GuitarDb.API.Services;

/// <summary>
/// On every startup (so every deploy), re-applies the deal rule to listings already priced
/// from sold history, so a change to DealFinder:DealThresholdPercent moves listings between
/// Deals and Priced right away instead of at their next scan. Uses only stored prices - no
/// Reverb calls. Listings still on the old pricing wait for their next scan.
/// </summary>
public class DealRuleRefreshService : BackgroundService
{
    private readonly MongoDbService _mongo;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DealRuleRefreshService> _logger;

    public DealRuleRefreshService(MongoDbService mongo, IConfiguration configuration, ILogger<DealRuleRefreshService> logger)
    {
        _mongo = mongo;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Let startup finish; the scans start minutes later
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            await RefreshAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deal rule refresh failed");
        }
    }

    public async Task RefreshAsync(CancellationToken ct)
    {
        var threshold = _configuration.GetValue<decimal>("DealFinder:DealThresholdPercent", 110);

        int reverbChecked = 0, reverbToDeals = 0, reverbFromDeals = 0;
        foreach (var buy in await _mongo.GetActiveSoldPricedPotentialBuysAsync(ct))
        {
            reverbChecked++;
            var isDeal = SoldPriceService.QualifiesAsDeal(buy, canShip: buy.ShippingPrice != null, threshold);
            if (isDeal == buy.IsDeal) continue;
            await _mongo.SetPotentialBuyIsDealAsync(buy.Id!, isDeal, ct);
            if (isDeal) reverbToDeals++; else reverbFromDeals++;
        }

        int swChecked = 0, swToDeals = 0, swFromDeals = 0;
        foreach (var buy in await _mongo.GetActiveSoldPricedSweetwaterPotentialBuysAsync(ct))
        {
            swChecked++;
            var isDeal = SoldPriceService.QualifiesAsDeal(buy, canShip: true, threshold);
            if (isDeal == buy.IsDeal) continue;
            await _mongo.SetSweetwaterPotentialBuyIsDealAsync(buy.Id!, isDeal, ct);
            if (isDeal) swToDeals++; else swFromDeals++;
        }

        _logger.LogInformation(
            "Deal rule refresh at {Threshold}% of median: Reverb {RChecked} checked, {RIn} into Deals, {ROut} out; Sweetwater {SChecked} checked, {SIn} into Deals, {SOut} out",
            threshold, reverbChecked, reverbToDeals, reverbFromDeals, swChecked, swToDeals, swFromDeals);
    }
}
