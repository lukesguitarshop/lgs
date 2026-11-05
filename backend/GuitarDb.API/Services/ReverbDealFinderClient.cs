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
        CancellationToken cancellationToken = default,
        DateTime? stopAtPublishedBefore = null,
        int? maxPages = null)
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
            while (!string.IsNullOrEmpty(nextUrl) && allListings.Count < maxListings && (maxPages is null || page <= maxPages))
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

                // "created_at-desc" actually orders by published_at, so once a page reaches
                // the cutoff everything after it is older too. Checked against the raw page,
                // before filtering, so filtered-out listings still advance the scan.
                var reachedCutoff = stopAtPublishedBefore.HasValue &&
                    listingsResponse.Listings.Any(l => l.PublishedAt.HasValue && l.PublishedAt.Value.ToUniversalTime() < stopAtPublishedBefore.Value);

                var liveListings = listingsResponse.Listings
                    .Where(l => !stopAtPublishedBefore.HasValue || l.PublishedAt is null || l.PublishedAt.Value.ToUniversalTime() >= stopAtPublishedBefore.Value)
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

                if (reachedCutoff)
                {
                    _logger.LogInformation("Page {Page} reached listings published before {Cutoff:u} - stopping", page, stopAtPublishedBefore);
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
    /// The Reverb product (comparison shopping page) the seller tied the listing to. Only the
    /// single-listing endpoint returns it; the bulk search leaves it out. Failed is true when
    /// the lookup itself failed, as opposed to the listing having no product.
    /// </summary>
    public async Task<(string? ProductId, bool Failed)> GetListingProductIdAsync(long listingId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/listings/{listingId}", cancellationToken);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return (null, false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Listing product lookup returned HTTP {Status} for {Id}", (int)response.StatusCode, listingId);
                return (null, true);
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var listing = JsonSerializer.Deserialize<ReverbListing>(content, _jsonOptions);
            var productId = listing?.ComparisonShoppingPageId;
            return (string.IsNullOrWhiteSpace(productId) ? null : productId, false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Listing product lookup failed for {Id}", listingId);
            return (null, true);
        }
    }

    /// <summary>A Reverb product by ID or slug, or null when it doesn't exist or the lookup failed.</summary>
    public async Task<CspResponse?> GetCspAsync(string idOrSlug, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/csps/{Uri.EscapeDataString(idOrSlug)}", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Product lookup returned HTTP {Status} for {Product}", (int)response.StatusCode, idOrSlug);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<CspResponse>(content, _jsonOptions);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Product lookup failed for {Product}", idOrSlug);
            return null;
        }
    }

    /// <summary>
    /// A Reverb product from its reverb.com/p/ slug. The API has no slug lookup, so this
    /// searches the slug's words and takes the result whose slug matches exactly.
    /// </summary>
    public async Task<CspResponse?> FindCspBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        var words = slug.Split('-', StringSplitOptions.RemoveEmptyEntries);
        var queries = new[]
        {
            string.Join(' ', words),
            // Year ranges in slugs ("1986-2000", "present") can trip Reverb's all-words search
            string.Join(' ', words.Where(w => !System.Text.RegularExpressions.Regex.IsMatch(w, @"^((19|20)\d{2}|present)$"))),
        };

        foreach (var query in queries.Distinct())
        {
            var (results, _) = await SearchCspsAsync(query, cancellationToken);
            var match = results.FirstOrDefault(c => c.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
            if (match != null) return await GetCspAsync(match.Id.ToString(), cancellationToken) ?? match;
        }

        return null;
    }

    /// <summary>Reverb catalog search. Failed is true on an HTTP error rather than no results.</summary>
    public async Task<(List<CspResponse> Results, bool Failed)> SearchCspsAsync(string query, CancellationToken cancellationToken = default)
    {
        var url = $"{BaseUrl}/csps?query={Uri.EscapeDataString(query)}&per_page=24";

        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Product search returned HTTP {Status} for {Query}", (int)response.StatusCode, query);
                return (new List<CspResponse>(), true);
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var searchResponse = JsonSerializer.Deserialize<CspSearchResponse>(content, _jsonOptions);
            return (searchResponse?.ComparisonShoppingPages ?? new List<CspResponse>(), false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Product search failed for {Query}", query);
            return (new List<CspResponse>(), true);
        }
    }

    /// <summary>
    /// Looks up a seller's shop for their feedback count, rating and location.
    /// Returns null when the lookup fails, so a missing seller never blocks a listing.
    /// </summary>
    public async Task<ReverbShop?> GetShopAsync(string slug, CancellationToken cancellationToken = default)
    {
        var url = $"{BaseUrl}/shops/{Uri.EscapeDataString(slug)}";

        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Shop lookup returned HTTP {Status} for {Slug}", (int)response.StatusCode, slug);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<ReverbShop>(content, _jsonOptions);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Shop lookup failed for {Slug}", slug);
            return null;
        }
    }

    /// <summary>
    /// A listing's current Reverb state slug ("live", "sold", "ended"), "deleted" when
    /// Reverb no longer has it, or null when the lookup itself failed.
    /// </summary>
    public async Task<string?> GetListingStateAsync(long listingId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/listings/{listingId}", cancellationToken);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return "deleted";
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Listing state lookup returned HTTP {Status} for {Id}", (int)response.StatusCode, listingId);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<ReverbListing>(content, _jsonOptions)?.State.Slug;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Listing state lookup failed for {Id}", listingId);
            return null;
        }
    }
}

/// <summary>
/// Caches shop lookups - the same sellers show up across many listings in a sweep,
/// and feedback counts don't move fast enough to need re-reading within a day.
/// </summary>
public class SellerCache
{
    private readonly ReverbDealFinderClient _apiClient;
    private readonly int _cacheMinutes;
    private readonly Dictionary<string, (ReverbShop Shop, DateTime ExpiresAt)> _cache = new(StringComparer.OrdinalIgnoreCase);

    public SellerCache(ReverbDealFinderClient apiClient, IConfiguration configuration)
    {
        _apiClient = apiClient;
        _cacheMinutes = configuration.GetValue<int>("DealFinder:SellerCacheMinutes", 1440);
    }

    public async Task<ReverbShop?> GetAsync(string slug, CancellationToken ct = default)
    {
        lock (_cache)
        {
            if (_cache.TryGetValue(slug, out var cached) && cached.ExpiresAt > DateTime.UtcNow)
                return cached.Shop;
        }

        var shop = await _apiClient.GetShopAsync(slug, ct);

        // Failed lookups aren't cached, so the next listing from this seller retries
        if (shop != null)
        {
            lock (_cache) { _cache[slug] = (shop, DateTime.UtcNow.AddMinutes(_cacheMinutes)); }
        }

        return shop;
    }
}
