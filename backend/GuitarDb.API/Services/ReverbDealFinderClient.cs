using System.Text.Json;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

public class ReverbDealFinderClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ReverbDealFinderClient> _logger;
    private readonly IConfiguration _configuration;
    private readonly JsonSerializerOptions _jsonOptions;

    public ReverbDealFinderClient(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<ReverbDealFinderClient> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        var apiKey = _configuration["ReverbApi:ApiKey"] ?? "";
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/hal+json");
        _httpClient.DefaultRequestHeaders.Add("Accept-Version", "3.0");
    }

    private string BaseUrl => _configuration["ReverbApi:BaseUrl"] ?? "https://api.reverb.com/api";
    private int RateLimitDelayMs => _configuration.GetValue<int>("ReverbApi:RateLimitDelayMs", 500);

    public async Task<List<ReverbListing>> FetchPublicListingsAsync(
        List<string> makes,
        decimal priceMax,
        bool acceptsOffers,
        int perPage,
        int maxListings,
        string? category = null,
        string? productType = null,
        string? shipFromCountryCode = null,
        CancellationToken cancellationToken = default)
    {
        var allListings = new List<ReverbListing>();
        var allowedMakes = new HashSet<string>(makes, StringComparer.OrdinalIgnoreCase);
        var makeParams = string.Join("&", makes.Select(m => $"make[]={Uri.EscapeDataString(m)}"));
        var baseUrl = $"{BaseUrl}/listings/all?{makeParams}&price_max={priceMax}&accepts_offers={acceptsOffers.ToString().ToLower()}&sort=created_at-desc&per_page={perPage}";

        if (!string.IsNullOrEmpty(category))
            baseUrl += $"&category={Uri.EscapeDataString(category)}";
        if (!string.IsNullOrEmpty(productType))
            baseUrl += $"&product_type={Uri.EscapeDataString(productType)}";
        if (!string.IsNullOrEmpty(shipFromCountryCode))
            baseUrl += $"&item_region={Uri.EscapeDataString(shipFromCountryCode.ToLower())}";

        string? nextUrl = baseUrl;
        var page = 1;

        _logger.LogInformation("Fetching up to {Max} public listings...", maxListings);

        try
        {
            while (!string.IsNullOrEmpty(nextUrl) && allListings.Count < maxListings)
            {
                _logger.LogInformation("Fetching page {Page}", page);

                var response = await _httpClient.GetAsync(nextUrl, cancellationToken);
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                var listingsResponse = JsonSerializer.Deserialize<ReverbListingsResponse>(content, _jsonOptions);

                if (listingsResponse?.Listings == null || listingsResponse.Listings.Count == 0)
                {
                    _logger.LogInformation("No more listings on page {Page}", page);
                    break;
                }

                var liveListings = listingsResponse.Listings
                    .Where(l => l.State.Slug.Equals("live", StringComparison.OrdinalIgnoreCase))
                    .Where(l => l.OffersEnabled)
                    .Where(l => allowedMakes.Contains(l.Make))
                    .ToList();

                allListings.AddRange(liveListings);
                _logger.LogInformation("Page {Page}: {Count} live offer-enabled listings (total: {Total})", page, liveListings.Count, allListings.Count);

                if (allListings.Count >= maxListings)
                {
                    allListings = allListings.Take(maxListings).ToList();
                    break;
                }

                nextUrl = listingsResponse.Links?.Next?.Href;
                if (!string.IsNullOrEmpty(nextUrl))
                {
                    await Task.Delay(RateLimitDelayMs, cancellationToken);
                }
                page++;
            }

            _logger.LogInformation("Fetched {Count} total live listings", allListings.Count);
            return allListings;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch public listings");
            throw;
        }
    }

    /// <summary>
    /// Resolves a make/model to market price data via the CSP (Comparison Shopping Page)
    /// search API. The /priceguide API was retired by Reverb (403) in July 2026; CSPs
    /// expose used_low_price / new_low_price instead of an estimated value range.
    /// </summary>
    public async Task<CspPriceResult> SearchCspPriceAsync(
        string make,
        string model,
        CancellationToken cancellationToken = default)
    {
        var query = Uri.EscapeDataString($"{make} {model}".Trim());
        var url = $"{BaseUrl}/csps?query={query}&per_page=24";

        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("CSP search returned HTTP {Status} for {Make} {Model}",
                    (int)response.StatusCode, make, model);
                return new CspPriceResult { LookupError = true };
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var searchResponse = JsonSerializer.Deserialize<CspSearchResponse>(content, _jsonOptions);

            var candidates = (searchResponse?.ComparisonShoppingPages ?? new List<CspResponse>())
                .Where(c => c.UsedLowPrice?.Amount > 0)
                .ToList();

            if (candidates.Count == 0)
            {
                _logger.LogDebug("No CSPs with used prices found for {Make} {Model}", make, model);
                return new CspPriceResult();
            }

            var brandMatches = candidates
                .Where(c => c.Brand != null && c.Brand.Name.Equals(make, StringComparison.OrdinalIgnoreCase))
                .ToList();

            // CSP titles usually include the brand, e.g. "Fender American Professional II Stratocaster"
            var fullName = $"{make} {model}".Trim();

            // Priority 1: exact title match
            var exact = brandMatches.FirstOrDefault(c =>
                c.Title.Equals(fullName, StringComparison.OrdinalIgnoreCase) ||
                c.Title.Equals(model, StringComparison.OrdinalIgnoreCase));
            if (exact != null)
                return ToResult(exact, PriceGuideMatchType.Csp);

            // Priority 2: CSP title contains the listing's model name
            var contains = brandMatches.FirstOrDefault(c =>
                c.Title.Contains(model, StringComparison.OrdinalIgnoreCase));
            if (contains != null)
                return ToResult(contains, PriceGuideMatchType.Model);

            // Priority 3: listing model contains the CSP title (minus brand prefix),
            // e.g. model "Les Paul Standard '60s Figured Top" vs CSP "Gibson Les Paul Standard '60s"
            var reverse = brandMatches.FirstOrDefault(c =>
            {
                var coreTitle = c.Title.StartsWith(make, StringComparison.OrdinalIgnoreCase)
                    ? c.Title[make.Length..].Trim()
                    : c.Title;
                return coreTitle.Length >= 5 && model.Contains(coreTitle, StringComparison.OrdinalIgnoreCase);
            });
            if (reverse != null)
                return ToResult(reverse, PriceGuideMatchType.Model);

            // Fallback: record the first result's prices but flag as unreliable so it's never a deal
            return ToResult(brandMatches.FirstOrDefault() ?? candidates.First(), PriceGuideMatchType.Fallback);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CSP search failed for {Make} {Model}", make, model);
            return new CspPriceResult { LookupError = true };
        }
    }

    private static CspPriceResult ToResult(CspResponse csp, PriceGuideMatchType matchType) => new()
    {
        CspId = csp.Id.ToString(),
        CspTitle = csp.Title,
        UsedLowPrice = csp.UsedLowPrice?.Amount,
        NewLowPrice = csp.NewLowPrice?.Amount,
        MatchType = matchType
    };
}

public class PriceGuideCache
{
    private readonly ReverbDealFinderClient _apiClient;
    private readonly ILogger<PriceGuideCache> _logger;
    private readonly int _cacheMinutes;
    private readonly Dictionary<string, CachedPriceGuideResult> _resultCache = new();

    public PriceGuideCache(
        ReverbDealFinderClient apiClient,
        IConfiguration configuration,
        ILogger<PriceGuideCache> logger)
    {
        _apiClient = apiClient;
        _logger = logger;
        _cacheMinutes = configuration.GetValue<int>("DealFinder:PriceGuideCacheMinutes", 1440);
    }

    public async Task<CspPriceResult> SearchAsync(
        string make,
        string model,
        CancellationToken ct = default)
    {
        var cacheKey = $"csp:{make.ToLowerInvariant()}:{model.ToLowerInvariant()}";

        if (_resultCache.TryGetValue(cacheKey, out var cached))
        {
            if (cached.ExpiresAt > DateTime.UtcNow)
            {
                _logger.LogDebug("CSP price search cached for {Make} {Model}", make, model);
                return cached.Data;
            }
            _resultCache.Remove(cacheKey);
        }

        var result = await _apiClient.SearchCspPriceAsync(make, model, ct);

        // Don't cache transient HTTP failures; do cache legitimate "no match" results
        if (!result.LookupError)
        {
            _resultCache[cacheKey] = new CachedPriceGuideResult
            {
                Data = result,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_cacheMinutes)
            };
        }

        return result;
    }

    public int CacheSize => _resultCache.Count;

    private class CachedPriceGuideResult
    {
        public CspPriceResult Data { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}
