using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Domain;
using GuitarDb.Scraper.Models.Reverb;
using Microsoft.Extensions.Logging;

namespace GuitarDb.Scraper.Services;

public class DealFinderOrchestrator
{
    private readonly ReverbApiClient _apiClient;
    private readonly PotentialBuyRepository _repository;
    private readonly PriceGuideCache _priceGuideCache;
    private readonly DealFinderSettings _settings;
    private readonly ILogger<DealFinderOrchestrator> _logger;

    public DealFinderOrchestrator(
        ReverbApiClient apiClient,
        PotentialBuyRepository repository,
        PriceGuideCache priceGuideCache,
        DealFinderSettings settings,
        ILogger<DealFinderOrchestrator> logger)
    {
        _apiClient = apiClient;
        _repository = repository;
        _priceGuideCache = priceGuideCache;
        _settings = settings;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        _logger.LogInformation("===== Starting Deal Finder =====");
        _logger.LogInformation("Deal threshold: price <= {Threshold}% of lowest used ask", _settings.DealThresholdPercent);

        var stats = new DealFinderStats();

        try
        {
            var filters = _settings.SearchFilters;
            var listings = await _apiClient.FetchPublicListingsAsync(
                filters.Makes,
                filters.PriceMax,
                filters.AcceptsOffers,
                filters.PerPage,
                filters.MaxListings,
                filters.Category,
                filters.ProductType,
                filters.ShipFromCountryCode,
                cancellationToken);

            stats.ListingsChecked = listings.Count;
            _logger.LogInformation("Fetched {Count} listings to analyze", listings.Count);

            foreach (var listing in listings)
            {
                try
                {
                    var (potentialBuy, priceResult) = await ProcessListingAsync(listing, cancellationToken);
                    await _repository.UpsertAsync(potentialBuy, cancellationToken);

                    if (priceResult.LookupError) stats.LookupErrors++;

                    if (potentialBuy.HasPriceGuide)
                    {
                        stats.WithPriceGuide++;
                        if (potentialBuy.IsDeal) stats.DealsFound++;
                    }
                    else
                    {
                        stats.WithoutPriceGuide++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to process listing {Id}", listing.Id);
                    stats.Errors++;
                }

                await Task.Delay(200, cancellationToken); // Rate limiting
            }

            // Cleanup stale and old records
            await RunCleanupAsync(startTime, stats, cancellationToken);

            PrintSummary(startTime, stats);

            // Fail loudly if the price data source is systematically broken (e.g. Reverb
            // retires the CSP API like it did the priceguide API) instead of silently
            // completing a run with zero deals.
            if (stats.ListingsChecked >= 20 && stats.WithPriceGuide == 0 && stats.LookupErrors > stats.ListingsChecked / 2)
            {
                throw new InvalidOperationException(
                    $"Price data lookups are failing ({stats.LookupErrors}/{stats.ListingsChecked} errors) — the Reverb CSP API may have changed");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deal finder failed");
            throw;
        }
    }

    private async Task<(PotentialBuy Buy, CspPriceResult PriceResult)> ProcessListingAsync(ReverbListing listing, CancellationToken ct)
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
            LastCheckedAt = DateTime.UtcNow
        };

        // Benchmark against Reverb market prices via the CSP API
        var priceResult = await _priceGuideCache.SearchAsync(listing.Make, listing.Model, ct);

        if (priceResult.HasPrice)
        {
            var usedLow = priceResult.UsedLowPrice!.Value;

            potentialBuy.HasPriceGuide = true;
            potentialBuy.PriceGuideId = priceResult.CspId ?? potentialBuy.PriceGuideId;
            potentialBuy.PriceGuideLow = usedLow;                    // lowest current used ask on Reverb
            potentialBuy.PriceGuideHigh = priceResult.NewLowPrice;   // lowest current new ask (may be null)
            potentialBuy.DiscountPercent = (usedLow - potentialBuy.Price) / usedLow * 100;

            // Deal criteria:
            // 1. Price at or below the lowest used ask x threshold percent
            // 2. Used low must be <= $3500 (within budget)
            // 3. CSP match must be reliable
            // 4. Must offer shipping (not local pickup only)
            var isBelowMarket = potentialBuy.Price <= usedLow * _settings.DealThresholdPercent / 100m;
            var isWithinBudget = usedLow <= 3500;
            var canShip = !listing.IsLocalPickupOnly;
            potentialBuy.IsDeal = isBelowMarket && isWithinBudget && priceResult.IsReliable && canShip;

            string matchLabel;
            if (!priceResult.IsReliable)
                matchLabel = "SKIP ";
            else if (listing.IsLocalPickupOnly)
                matchLabel = "LOCAL";
            else if (!isWithinBudget)
                matchLabel = "$$$$$ ";
            else if (potentialBuy.IsDeal)
                matchLabel = "DEAL!";
            else
                matchLabel = "     ";

            _logger.LogInformation(
                "{Deal} {Title}: ${Price} vs used low ${UsedLow} (new: ${NewLow}) [{MatchType}: {CspTitle}]",
                matchLabel,
                listing.Title.Length > 50 ? listing.Title[..50] + "..." : listing.Title,
                potentialBuy.Price,
                usedLow,
                priceResult.NewLowPrice,
                priceResult.MatchType,
                priceResult.CspTitle);
        }
        else if (!priceResult.LookupError)
        {
            _logger.LogDebug("No CSP price data found for {Make} {Model}", listing.Make, listing.Model);
        }

        return (potentialBuy, priceResult);
    }

    private void PrintSummary(DateTime startTime, DealFinderStats stats)
    {
        var duration = DateTime.UtcNow - startTime;
        _logger.LogInformation("");
        _logger.LogInformation("===== DEAL FINDER SUMMARY =====");
        _logger.LogInformation("Listings Checked: {Count}", stats.ListingsChecked);
        _logger.LogInformation("With Price Guide: {Count}", stats.WithPriceGuide);
        _logger.LogInformation("Without Price Guide: {Count}", stats.WithoutPriceGuide);
        _logger.LogInformation("Deals Found: {Count}", stats.DealsFound);
        _logger.LogInformation("Errors: {Count}", stats.Errors);
        _logger.LogInformation("Lookup Errors: {Count}", stats.LookupErrors);
        _logger.LogInformation("Price Guides Cached: {Count}", _priceGuideCache.CacheSize);
        if (stats.StaleRemoved > 0 || stats.OldResolvedRemoved > 0)
        {
            _logger.LogInformation("--- Cleanup ---");
            if (stats.StaleRemoved > 0)
                _logger.LogInformation("Stale Removed: {Count}", stats.StaleRemoved);
            if (stats.OldResolvedRemoved > 0)
                _logger.LogInformation("Old Resolved Removed: {Count}", stats.OldResolvedRemoved);
        }
        _logger.LogInformation("Total in Database: {Count}", stats.TotalInDatabase);
        _logger.LogInformation("Duration: {Duration}", duration);
        _logger.LogInformation("===============================");
    }

    private async Task RunCleanupAsync(DateTime runStartTime, DealFinderStats stats, CancellationToken ct)
    {
        var cleanup = _settings.Cleanup;

        // Remove listings no longer on Reverb (not seen in this run)
        if (cleanup.RemoveStaleListings)
        {
            stats.StaleRemoved = await _repository.DeleteStaleListingsAsync(runStartTime, ct);
            if (stats.StaleRemoved > 0)
            {
                _logger.LogInformation("Removed {Count} stale listings (no longer on Reverb)", stats.StaleRemoved);
            }
        }

        // Remove old dismissed/purchased records
        if (cleanup.KeepResolvedDays > 0)
        {
            stats.OldResolvedRemoved = await _repository.DeleteOldResolvedAsync(cleanup.KeepResolvedDays, ct);
            if (stats.OldResolvedRemoved > 0)
            {
                _logger.LogInformation("Removed {Count} old dismissed/purchased records (>{Days} days old)",
                    stats.OldResolvedRemoved, cleanup.KeepResolvedDays);
            }
        }

        // Get final database count
        stats.TotalInDatabase = await _repository.GetTotalCountAsync(ct);
    }

    private class DealFinderStats
    {
        public int ListingsChecked { get; set; }
        public int WithPriceGuide { get; set; }
        public int WithoutPriceGuide { get; set; }
        public int DealsFound { get; set; }
        public int Errors { get; set; }
        public int LookupErrors { get; set; }
        public long StaleRemoved { get; set; }
        public long OldResolvedRemoved { get; set; }
        public long TotalInDatabase { get; set; }
    }
}
