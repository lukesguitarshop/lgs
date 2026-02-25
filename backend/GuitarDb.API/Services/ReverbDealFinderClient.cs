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
                    .ToList();

                allListings.AddRange(liveListings);
                _logger.LogInformation("Page {Page}: {Count} live listings (total: {Total})", page, liveListings.Count, allListings.Count);

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

    public async Task<PriceGuideResult> SearchPriceGuideAsync(
        string make,
        string model,
        string? finish,
        string? cspId,
        int? year = null,
        CancellationToken cancellationToken = default)
    {
        var query = Uri.EscapeDataString($"{make} {model}");
        var url = $"{BaseUrl}/priceguide?query={query}&per_page=50";

        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var searchResponse = JsonSerializer.Deserialize<PriceGuideSearchResponse>(content, _jsonOptions);

            if (searchResponse?.PriceGuides == null || searchResponse.PriceGuides.Count == 0)
            {
                _logger.LogDebug("No price guides found for {Make} {Model}", make, model);
                return new PriceGuideResult { PriceGuide = null, MatchType = PriceGuideMatchType.Fallback };
            }

            var guidesWithValues = searchResponse.PriceGuides
                .Where(g => g.EstimatedValue?.PriceLow != null)
                .ToList();

            if (guidesWithValues.Count == 0)
            {
                _logger.LogDebug("No price guides with values for {Make} {Model}", make, model);
                return new PriceGuideResult { PriceGuide = null, MatchType = PriceGuideMatchType.Fallback };
            }

            // Priority 1: Match by CSP ID (most reliable)
            if (!string.IsNullOrEmpty(cspId))
            {
                var cspMatches = guidesWithValues.Where(g => g.ComparisonShoppingPageId == cspId).ToList();
                if (cspMatches.Count > 0)
                {
                    if (year.HasValue)
                    {
                        var yearMatch = cspMatches.FirstOrDefault(g => IsYearInRange(year.Value, g.Year));
                        if (yearMatch != null)
                            return new PriceGuideResult { PriceGuide = yearMatch, MatchType = PriceGuideMatchType.CspAndYear };
                    }
                    return new PriceGuideResult { PriceGuide = cspMatches.First(), MatchType = PriceGuideMatchType.Csp };
                }
            }

            // Priority 2: Match by model name
            var modelMatches = guidesWithValues
                .Where(g => g.Model.Equals(model, StringComparison.OrdinalIgnoreCase) ||
                           g.Title.Contains(model, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (modelMatches.Count > 0)
            {
                if (year.HasValue)
                {
                    var modelYearMatch = modelMatches.FirstOrDefault(g => IsYearInRange(year.Value, g.Year));
                    if (modelYearMatch != null)
                        return new PriceGuideResult { PriceGuide = modelYearMatch, MatchType = PriceGuideMatchType.ModelAndYear };
                }
                var exactModelMatch = modelMatches.FirstOrDefault(g => g.Model.Equals(model, StringComparison.OrdinalIgnoreCase));
                return new PriceGuideResult { PriceGuide = exactModelMatch ?? modelMatches.First(), MatchType = PriceGuideMatchType.Model };
            }

            // Priority 3: Match by year only
            if (year.HasValue)
            {
                var yearMatches = guidesWithValues.Where(g => IsYearInRange(year.Value, g.Year)).ToList();
                if (yearMatches.Count > 0)
                    return new PriceGuideResult { PriceGuide = yearMatches.First(), MatchType = PriceGuideMatchType.YearOnly };
            }

            // Priority 4: Fallback to first result
            return new PriceGuideResult { PriceGuide = guidesWithValues.First(), MatchType = PriceGuideMatchType.Fallback };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to search price guide for {Make} {Model}", make, model);
            return new PriceGuideResult { PriceGuide = null, MatchType = PriceGuideMatchType.Fallback };
        }
    }

    private static bool IsYearInRange(int year, string? yearRange)
    {
        if (string.IsNullOrEmpty(yearRange)) return false;
        if (int.TryParse(yearRange, out var singleYear)) return year == singleYear;

        var parts = yearRange.Split(new[] { '-', '–' }, StringSplitOptions.TrimEntries);
        if (parts.Length == 2)
        {
            if (int.TryParse(parts[0], out var startYear) && int.TryParse(parts[1], out var endYear))
                return year >= startYear && year <= endYear;
            if (int.TryParse(parts[0], out var fromYear) && parts[1].Equals("Present", StringComparison.OrdinalIgnoreCase))
                return year >= fromYear;
        }
        return false;
    }
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

    public async Task<PriceGuideResult> SearchAsync(
        string make,
        string model,
        string? finish,
        string? cspId,
        int? year = null,
        CancellationToken ct = default)
    {
        var cacheKey = $"search:{make}:{model}:{cspId ?? "none"}:{year?.ToString() ?? "none"}";

        if (_resultCache.TryGetValue(cacheKey, out var cached))
        {
            if (cached.ExpiresAt > DateTime.UtcNow)
            {
                _logger.LogDebug("Price guide search cached for {Make} {Model} {Year}", make, model, year);
                return cached.Data;
            }
            _resultCache.Remove(cacheKey);
        }

        var result = await _apiClient.SearchPriceGuideAsync(make, model, finish, cspId, year, ct);

        _resultCache[cacheKey] = new CachedPriceGuideResult
        {
            Data = result,
            ExpiresAt = DateTime.UtcNow.AddMinutes(_cacheMinutes)
        };

        return result;
    }

    public int CacheSize => _resultCache.Count;

    private class CachedPriceGuideResult
    {
        public PriceGuideResult Data { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}
