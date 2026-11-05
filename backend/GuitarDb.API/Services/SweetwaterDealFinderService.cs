using GuitarDb.API.Models;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

public class SweetwaterDealFinderService
{
    private readonly SweetwaterScraperClient _scraperClient;
    private readonly SoldPriceService _soldPriceService;
    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SweetwaterDealFinderService> _logger;
    private static bool _isRunning = false;
    private static readonly object _lock = new();

    public SweetwaterDealFinderService(
        SweetwaterScraperClient scraperClient,
        SoldPriceService soldPriceService,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<SweetwaterDealFinderService> logger)
    {
        _scraperClient = scraperClient;
        _soldPriceService = soldPriceService;
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

            var dealThresholdPercent = _configuration.GetValue<decimal>("DealFinder:DealThresholdPercent", 80);
            int totalWithPriceGuide = 0, totalWithoutPriceGuide = 0, totalDealsFound = 0, totalErrors = 0, totalLookupErrors = 0;

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
                    var (potentialBuy, priceResult) = await ProcessListingAsync(listing, dealThresholdPercent, cancellationToken);
                    await _mongoDbService.UpsertSweetwaterPotentialBuyAsync(potentialBuy, cancellationToken);

                    if (priceResult.LookupError) totalLookupErrors++;

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

            result.DealsFound = totalDealsFound;
            result.WithPriceData = totalWithPriceGuide;
            result.LookupErrors = totalLookupErrors;
            result.Duration = DateTime.UtcNow - startTime;

            // Fail loudly if the price data source is systematically broken instead of
            // silently reporting a successful run with zero deals.
            if (result.ListingsChecked >= 20 && totalWithPriceGuide == 0 && totalLookupErrors > result.ListingsChecked / 2)
            {
                result.Success = false;
                result.Message = $"Price data lookups are failing ({totalLookupErrors}/{result.ListingsChecked} errors) — Reverb's product or sold-history (gql.reverb.com priceRecordsSearch) API may have changed";
                result.Error = result.Message;
                _logger.LogError("{Message}", result.Message);
                return result;
            }

            result.Success = true;
            result.Message = "Sweetwater deal finder completed successfully";

            _logger.LogInformation("===== SWEETWATER DEAL FINDER SUMMARY =====");
            _logger.LogInformation("Listings Checked: {Count}", result.ListingsChecked);
            _logger.LogInformation("With Price Guide: {Count}", totalWithPriceGuide);
            _logger.LogInformation("Without Price Guide: {Count}", totalWithoutPriceGuide);
            _logger.LogInformation("Deals Found: {Count}", totalDealsFound);
            _logger.LogInformation("Errors: {Count}", totalErrors);
            _logger.LogInformation("Lookup Errors: {Count}", totalLookupErrors);
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

    private async Task<(SweetwaterPotentialBuy Buy, SoldPriceResult PriceResult)> ProcessListingAsync(
        SweetwaterListing listing, decimal dealThresholdPercent, CancellationToken ct)
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
            ShippingPrice = listing.ShippingPrice,
            TotalPrice = listing.ShippingPrice.HasValue ? listing.Price + listing.ShippingPrice.Value : null,
            ListingCreatedAt = listing.PublishedAt,
            SellerUserId = listing.SellerUserId,
            SellerName = listing.SellerName,
            SellerSlug = listing.SellerSlug,
            SellerLocation = listing.SellerLocation,
            SellerListingCount = listing.SellerListingCount,
            Make = listing.Make,
            Model = listing.Model,
            // Sweetwater listings only come with a title
            RepairNote = RepairDetector.Find(listing.Title, null),
            LastCheckedAt = DateTime.UtcNow
        };

        // Sweetwater listings have no Reverb product link: manual fix, learned alias, then text search
        var (years, yearSource) = ListingFacts.FindYears(listing.Make, listing.Model, null, listing.Title, null, listing.MadeYear, listing.MadeDecade);
        potentialBuy.DetectedYear = years?.ToString();
        potentialBuy.YearSource = yearSource;

        var priceResult = await _soldPriceService.ResolveAsync(new SoldPriceQuery
        {
            Make = listing.Make,
            Model = listing.Model,
            Title = listing.Title,
            Years = years,
        }, ct);

        // Judged on what it costs delivered, like Reverb
        SoldPriceService.Apply(potentialBuy, priceResult, canShip: true, dealThresholdPercent);

        if (potentialBuy.SoldMedian.HasValue)
        {
            var matchLabel = potentialBuy.IsDeal ? "DEAL!" : (potentialBuy.PriceReliable ? "     " : "SKIP ");
            _logger.LogInformation(
                "[SW] {Deal} {Title}: ${Price} delivered vs sold median ${Median} ({Sales} sales, {Window} mo) [{Source}: {Product}] {Reason}",
                matchLabel,
                listing.Title.Length > 50 ? listing.Title[..50] + "..." : listing.Title,
                potentialBuy.TotalPrice ?? potentialBuy.Price,
                potentialBuy.SoldMedian,
                potentialBuy.SoldSaleCount,
                potentialBuy.SoldWindowMonths,
                potentialBuy.MatchSource,
                potentialBuy.ProductTitle,
                potentialBuy.UnreliableReason);
        }

        return (potentialBuy, priceResult);
    }
}

public class SweetwaterDealFinderResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Error { get; set; }
    public int ListingsChecked { get; set; }
    public int DealsFound { get; set; }
    public int WithPriceData { get; set; }
    public int LookupErrors { get; set; }
    public TimeSpan Duration { get; set; }
}
