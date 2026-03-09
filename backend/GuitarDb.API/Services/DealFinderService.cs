using GuitarDb.API.Models;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

public class DealFinderService
{
    private readonly ReverbDealFinderClient _apiClient;
    private readonly PriceGuideCache _priceGuideCache;
    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DealFinderService> _logger;
    private static bool _isRunning = false;
    private static readonly object _lock = new();

    public DealFinderService(
        ReverbDealFinderClient apiClient,
        PriceGuideCache priceGuideCache,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<DealFinderService> logger)
    {
        _apiClient = apiClient;
        _priceGuideCache = priceGuideCache;
        _mongoDbService = mongoDbService;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsRunning => _isRunning;

    public async Task<DealFinderResult> RunAsync(CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            if (_isRunning)
            {
                return new DealFinderResult
                {
                    Success = false,
                    Message = "Deal finder is already running"
                };
            }
            _isRunning = true;
        }

        var startTime = DateTime.UtcNow;
        var result = new DealFinderResult();

        try
        {
            _logger.LogInformation("===== Starting Deal Finder =====");

            // Get cleanup configuration
            var removeStaleListings = _configuration.GetValue<bool>("DealFinder:Cleanup:RemoveStaleListings", true);
            var keepResolvedDays = _configuration.GetValue<int>("DealFinder:Cleanup:KeepResolvedDays", 30);

            // Get search filter sets (supports multiple categories like electric + acoustic)
            var filterSets = _configuration.GetSection("DealFinder:SearchFilterSets").Get<List<SearchFilterSet>>();

            // Fallback to legacy single SearchFilters config if SearchFilterSets not defined
            if (filterSets == null || filterSets.Count == 0)
            {
                filterSets = new List<SearchFilterSet>
                {
                    new SearchFilterSet
                    {
                        Name = "Default",
                        Makes = _configuration.GetSection("DealFinder:SearchFilters:Makes").Get<List<string>>() ?? new List<string> { "Fender", "Gibson", "PRS", "Schecter" },
                        PriceMax = _configuration.GetValue<decimal>("DealFinder:SearchFilters:PriceMax", 3500),
                        AcceptsOffers = _configuration.GetValue<bool>("DealFinder:SearchFilters:AcceptsOffers", true),
                        PerPage = _configuration.GetValue<int>("DealFinder:SearchFilters:PerPage", 50),
                        MaxListings = _configuration.GetValue<int>("DealFinder:SearchFilters:MaxListings", 500),
                        Category = _configuration["DealFinder:SearchFilters:Category"] ?? "solid-body",
                        ProductType = _configuration["DealFinder:SearchFilters:ProductType"] ?? "electric-guitars",
                        ShipFromCountryCode = _configuration["DealFinder:SearchFilters:ShipFromCountryCode"] ?? "US"
                    }
                };
            }

            int totalWithPriceGuide = 0, totalWithoutPriceGuide = 0, totalDealsFound = 0, totalErrors = 0;

            // Process each filter set
            foreach (var filterSet in filterSets)
            {
                _logger.LogInformation("----- Processing: {Name} -----", filterSet.Name);

                var listings = await _apiClient.FetchPublicListingsAsync(
                    filterSet.Makes,
                    filterSet.PriceMax,
                    filterSet.AcceptsOffers,
                    filterSet.PerPage,
                    filterSet.MaxListings,
                    filterSet.Category,
                    filterSet.ProductType,
                    filterSet.ShipFromCountryCode,
                    cancellationToken);

                result.ListingsChecked += listings.Count;
                _logger.LogInformation("Fetched {Count} listings for {Name}", listings.Count, filterSet.Name);

                int withPriceGuide = 0, withoutPriceGuide = 0, dealsFound = 0, errors = 0;

                foreach (var listing in listings)
                {
                    try
                    {
                        var potentialBuy = await ProcessListingAsync(listing, cancellationToken);
                        await _mongoDbService.UpsertPotentialBuyAsync(potentialBuy, cancellationToken);

                        if (potentialBuy.HasPriceGuide)
                        {
                            withPriceGuide++;
                            if (potentialBuy.IsDeal) dealsFound++;
                        }
                        else
                        {
                            withoutPriceGuide++;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to process listing {Id}", listing.Id);
                        errors++;
                    }

                    await Task.Delay(200, cancellationToken); // Rate limiting
                }

                _logger.LogInformation("{Name}: {Deals} deals, {WithGuide} with price guide, {WithoutGuide} without, {Errors} errors",
                    filterSet.Name, dealsFound, withPriceGuide, withoutPriceGuide, errors);

                totalWithPriceGuide += withPriceGuide;
                totalWithoutPriceGuide += withoutPriceGuide;
                totalDealsFound += dealsFound;
                totalErrors += errors;
            }

            // Cleanup
            long staleRemoved = 0, oldResolvedRemoved = 0;
            if (removeStaleListings)
            {
                staleRemoved = await _mongoDbService.DeleteStalePotentialBuysAsync(startTime, cancellationToken);
                if (staleRemoved > 0)
                    _logger.LogInformation("Removed {Count} stale listings", staleRemoved);
            }
            if (keepResolvedDays > 0)
            {
                oldResolvedRemoved = await _mongoDbService.DeleteOldResolvedPotentialBuysAsync(keepResolvedDays, cancellationToken);
                if (oldResolvedRemoved > 0)
                    _logger.LogInformation("Removed {Count} old resolved records", oldResolvedRemoved);
            }

            var totalInDb = await _mongoDbService.GetPotentialBuysTotalCountAsync(cancellationToken);

            result.Success = true;
            result.Message = "Deal finder completed successfully";
            result.DealsFound = totalDealsFound;
            result.Duration = DateTime.UtcNow - startTime;

            _logger.LogInformation("===== DEAL FINDER SUMMARY =====");
            _logger.LogInformation("Filter Sets Processed: {Count}", filterSets.Count);
            _logger.LogInformation("Listings Checked: {Count}", result.ListingsChecked);
            _logger.LogInformation("With Price Guide: {Count}", totalWithPriceGuide);
            _logger.LogInformation("Without Price Guide: {Count}", totalWithoutPriceGuide);
            _logger.LogInformation("Deals Found: {Count}", totalDealsFound);
            _logger.LogInformation("Errors: {Count}", totalErrors);
            _logger.LogInformation("Price Guides Cached: {Count}", _priceGuideCache.CacheSize);
            _logger.LogInformation("Total in Database: {Count}", totalInDb);
            _logger.LogInformation("Duration: {Duration}", result.Duration);
            _logger.LogInformation("===============================");

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deal finder failed with exception");
            result.Success = false;
            result.Message = "Deal finder failed";
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

    private async Task<PotentialBuy> ProcessListingAsync(ReverbListing listing, CancellationToken ct)
    {
        var potentialBuy = new PotentialBuy
        {
            ListingTitle = listing.Title,
            Description = listing.Description,
            Images = listing.AllImageUrls,
            ReverbLink = listing.ListingUrl,
            Condition = listing.Condition?.DisplayName,
            Price = listing.Price?.Amount ?? 0,
            Currency = listing.Price?.Currency ?? "USD",
            ReverbListingId = listing.Id,
            PriceGuideId = listing.ComparisonShoppingPageId ?? listing.PriceGuideId,
            LastCheckedAt = DateTime.UtcNow,
            ListingCreatedAt = listing.PublishedAt
        };

        var priceGuideResult = await _priceGuideCache.SearchAsync(
            listing.Make,
            listing.Model,
            listing.Finish,
            listing.ComparisonShoppingPageId,
            listing.ParsedYear,
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
                var canShip = !listing.IsLocalPickupOnly;
                potentialBuy.IsDeal = isInBottomHalf && isWithinBudget && priceGuideResult.IsReliable && canShip;

                string matchLabel = potentialBuy.IsDeal ? "DEAL!" : (priceGuideResult.IsReliable ? "     " : "SKIP ");
                _logger.LogInformation(
                    "{Deal} {Title}: ${Price} vs ${Low}-${High} (mid: ${Mid}) [{MatchType}]",
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

public class DealFinderResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Error { get; set; }
    public int ListingsChecked { get; set; }
    public int DealsFound { get; set; }
    public TimeSpan Duration { get; set; }
}

public class SearchFilterSet
{
    public string Name { get; set; } = "Default";
    public List<string> Makes { get; set; } = new();
    public decimal PriceMax { get; set; } = 3500;
    public bool AcceptsOffers { get; set; } = true;
    public int PerPage { get; set; } = 50;
    public int MaxListings { get; set; } = 500;
    public string Category { get; set; } = "solid-body";
    public string ProductType { get; set; } = "electric-guitars";
    public string ShipFromCountryCode { get; set; } = "US";
}
