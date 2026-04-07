using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

public class SweetwaterDealFinderService
{
    private readonly SweetwaterScraperClient _scraperClient;
    private readonly PriceGuideCache _priceGuideCache;
    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SweetwaterDealFinderService> _logger;
    private static bool _isRunning = false;
    private static readonly object _lock = new();

    public SweetwaterDealFinderService(
        SweetwaterScraperClient scraperClient,
        PriceGuideCache priceGuideCache,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<SweetwaterDealFinderService> logger)
    {
        _scraperClient = scraperClient;
        _priceGuideCache = priceGuideCache;
        _mongoDbService = mongoDbService;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsRunning => _isRunning;

    public async Task<SweetwaterDealFinderResult> RunAsync(CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            if (_isRunning)
            {
                return new SweetwaterDealFinderResult
                {
                    Success = false,
                    Message = "Sweetwater deal finder is already running"
                };
            }
            _isRunning = true;
        }

        var startTime = DateTime.UtcNow;
        var result = new SweetwaterDealFinderResult();

        try
        {
            _logger.LogInformation("===== Starting Sweetwater Deal Finder =====");

            var removeStaleListings = _configuration.GetValue<bool>("DealFinder:Cleanup:RemoveStaleListings", true);
            var keepResolvedDays = _configuration.GetValue<int>("DealFinder:Cleanup:KeepResolvedDays", 30);

            // Get search filter sets - reuse the same config as Reverb
            var filterSets = _configuration.GetSection("DealFinder:SearchFilterSets").Get<List<SearchFilterSet>>();

            if (filterSets == null || filterSets.Count == 0)
            {
                filterSets = new List<SearchFilterSet>
                {
                    new SearchFilterSet
                    {
                        Name = "Default",
                        Makes = new List<string> { "Fender", "Gibson", "PRS", "Schecter" },
                        PriceMax = 3500,
                        MaxListings = 500
                    }
                };
            }

            int totalWithPriceGuide = 0, totalWithoutPriceGuide = 0, totalDealsFound = 0, totalErrors = 0;

            // Collect all makes from all filter sets and fetch once
            var allMakes = filterSets.SelectMany(f => f.Makes).Distinct().ToList();
            var globalPriceMax = filterSets.Max(f => f.PriceMax);
            var globalMaxListings = filterSets.Sum(f => f.MaxListings);

            _logger.LogInformation("Fetching Sweetwater listings for makes: {Makes}", string.Join(", ", allMakes));

            var listings = await _scraperClient.FetchListingsAsync(
                allMakes,
                globalPriceMax,
                globalMaxListings,
                cancellationToken);

            result.ListingsChecked = listings.Count;
            _logger.LogInformation("Fetched {Count} Sweetwater listings to analyze", listings.Count);

            foreach (var listing in listings)
            {
                try
                {
                    var potentialBuy = await ProcessListingAsync(listing, cancellationToken);
                    await _mongoDbService.UpsertSweetwaterPotentialBuyAsync(potentialBuy, cancellationToken);

                    if (potentialBuy.HasPriceGuide)
                    {
                        totalWithPriceGuide++;
                        if (potentialBuy.IsDeal) totalDealsFound++;
                    }
                    else
                    {
                        totalWithoutPriceGuide++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to process Sweetwater listing {Id}", listing.ListingId);
                    totalErrors++;
                }

                await Task.Delay(200, cancellationToken); // Rate limiting for price guide API
            }

            // Cleanup
            if (removeStaleListings)
            {
                var staleRemoved = await _mongoDbService.DeleteStaleSweetwaterPotentialBuysAsync(startTime, cancellationToken);
                if (staleRemoved > 0)
                    _logger.LogInformation("Removed {Count} stale Sweetwater listings", staleRemoved);
            }
            if (keepResolvedDays > 0)
            {
                var oldRemoved = await _mongoDbService.DeleteOldResolvedSweetwaterPotentialBuysAsync(keepResolvedDays, cancellationToken);
                if (oldRemoved > 0)
                    _logger.LogInformation("Removed {Count} old resolved Sweetwater records", oldRemoved);
            }

            var totalInDb = await _mongoDbService.GetSweetwaterPotentialBuysTotalCountAsync(cancellationToken);

            result.Success = true;
            result.Message = "Sweetwater deal finder completed successfully";
            result.DealsFound = totalDealsFound;
            result.Duration = DateTime.UtcNow - startTime;

            _logger.LogInformation("===== SWEETWATER DEAL FINDER SUMMARY =====");
            _logger.LogInformation("Listings Checked: {Count}", result.ListingsChecked);
            _logger.LogInformation("With Price Guide: {Count}", totalWithPriceGuide);
            _logger.LogInformation("Without Price Guide: {Count}", totalWithoutPriceGuide);
            _logger.LogInformation("Deals Found: {Count}", totalDealsFound);
            _logger.LogInformation("Errors: {Count}", totalErrors);
            _logger.LogInformation("Total in Database: {Count}", totalInDb);
            _logger.LogInformation("Duration: {Duration}", result.Duration);
            _logger.LogInformation("==========================================");

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sweetwater deal finder failed with exception");
            result.Success = false;
            result.Message = "Sweetwater deal finder failed";
            result.Error = ex.Message;
            result.Duration = DateTime.UtcNow - startTime;
            return result;
        }
        finally
        {
            lock (_lock)
            {
                _isRunning = false;
            }
        }
    }

    private async Task<SweetwaterPotentialBuy> ProcessListingAsync(SweetwaterListing listing, CancellationToken ct)
    {
        var potentialBuy = new SweetwaterPotentialBuy
        {
            ListingTitle = listing.Title,
            Images = listing.ImageUrl != null ? new List<string> { listing.ImageUrl } : new List<string>(),
            SweetwaterLink = listing.ListingUrl,
            Condition = listing.Condition,
            Price = listing.Price,
            OriginalPrice = listing.OriginalPrice,
            Currency = "USD",
            SweetwaterListingId = listing.ListingId,
            Shipping = listing.Shipping,
            LastCheckedAt = DateTime.UtcNow
        };

        // Search price guide using Reverb's price guides
        var priceGuideResult = await _priceGuideCache.SearchAsync(
            listing.Make,
            listing.Model,
            listing.Finish,
            null, // No CSP ID from Sweetwater
            listing.Year,
            ct);

        var priceGuide = priceGuideResult.PriceGuide;
        if (priceGuide?.EstimatedValue != null)
        {
            potentialBuy.HasPriceGuide = true;
            potentialBuy.PriceGuideLow = priceGuide.EstimatedValue.PriceLow?.Amount;
            potentialBuy.PriceGuideHigh = priceGuide.EstimatedValue.PriceHigh?.Amount;

            if (potentialBuy.PriceGuideLow.HasValue && potentialBuy.PriceGuideLow > 0)
            {
                potentialBuy.DiscountPercent =
                    (potentialBuy.PriceGuideLow.Value - potentialBuy.Price)
                    / potentialBuy.PriceGuideLow.Value * 100;

                var priceHigh = potentialBuy.PriceGuideHigh ?? potentialBuy.PriceGuideLow.Value;
                var midpoint = (potentialBuy.PriceGuideLow.Value + priceHigh) / 2;

                var isInBottomHalf = potentialBuy.Price <= midpoint;
                var isWithinBudget = potentialBuy.PriceGuideLow.Value <= 3500;
                potentialBuy.IsDeal = isInBottomHalf && isWithinBudget && priceGuideResult.IsReliable;

                string matchLabel = potentialBuy.IsDeal ? "DEAL!" : (priceGuideResult.IsReliable ? "     " : "SKIP ");
                _logger.LogInformation(
                    "[SW] {Deal} {Title}: ${Price} vs ${Low}-${High} (mid: ${Mid}) [{MatchType}]",
                    matchLabel,
                    listing.Title.Length > 50 ? listing.Title[..50] + "..." : listing.Title,
                    potentialBuy.Price,
                    potentialBuy.PriceGuideLow,
                    potentialBuy.PriceGuideHigh,
                    midpoint,
                    priceGuideResult.MatchType);
            }
        }

        return potentialBuy;
    }
}

public class SweetwaterDealFinderResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Error { get; set; }
    public int ListingsChecked { get; set; }
    public int DealsFound { get; set; }
    public TimeSpan Duration { get; set; }
}
