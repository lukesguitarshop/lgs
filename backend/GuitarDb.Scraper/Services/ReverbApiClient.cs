using System.Diagnostics;
using System.Text.Json;
using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Reverb;
using Microsoft.Extensions.Logging;

namespace GuitarDb.Scraper.Services;

public class ReverbApiClient
{
    private readonly ILogger<ReverbApiClient> _logger;
    private readonly ReverbApiSettings _settings;
    private readonly JsonSerializerOptions _jsonOptions;

    public ReverbApiClient(
        ReverbApiSettings settings,
        ILogger<ReverbApiClient> logger)
    {
        _settings = settings;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    private async Task<string> ExecuteCurlAsync(string url, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "curl",
            Arguments = $"-s -H \"Authorization: Bearer {_settings.ApiKey}\" -H \"Accept: application/hal+json\" -H \"Accept-Version: 3.0\" \"{url}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };
        process.Start();

        var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        var error = await process.StandardError.ReadToEndAsync(cancellationToken);

        await process.WaitForExitAsync(cancellationToken);

        if (process.ExitCode != 0)
        {
            _logger.LogError("cURL failed with exit code {ExitCode}: {Error}", process.ExitCode, error);
            throw new HttpRequestException($"cURL request failed: {error}");
        }

        return output;
    }

    public async Task<List<ReverbListing>> FetchMyListingsAsync(CancellationToken cancellationToken = default)
    {
        var allListings = new List<ReverbListing>();
        var currentPage = 1;
        string? nextUrl = $"{_settings.BaseUrl}/my/listings?per_page={_settings.PageSize}";

        _logger.LogInformation("Fetching my Reverb listings...");

        while (!string.IsNullOrEmpty(nextUrl))
        {
            try
            {
                _logger.LogDebug("Fetching page {Page}: {Url}", currentPage, nextUrl);

                var content = await ExecuteCurlAsync(nextUrl, cancellationToken);

                var reverbResponse = JsonSerializer.Deserialize<ReverbListingsResponse>(content, _jsonOptions);

                if (reverbResponse == null || reverbResponse.Listings == null)
                {
                    _logger.LogWarning("Received null response from Reverb API");
                    break;
                }

                // Get live listings only
                var liveListings = reverbResponse.Listings
                    .Where(l => l.State.Slug.Equals("live", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                allListings.AddRange(liveListings);

                _logger.LogInformation("Page {Page}: {Count} listings ({Live} live, {Total} total)",
                    currentPage, reverbResponse.Listings.Count, liveListings.Count, allListings.Count);

                nextUrl = reverbResponse.Links?.Next?.Href;

                if (!string.IsNullOrEmpty(nextUrl))
                {
                    await Task.Delay(_settings.RateLimitDelayMs, cancellationToken);
                }

                currentPage++;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP error while fetching page {Page}", currentPage);
                throw;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse JSON response from page {Page}", currentPage);
                throw;
            }
        }

        _logger.LogInformation("Fetched {Total} live listings", allListings.Count);

        return allListings;
    }

    public async Task<ReverbListing?> FetchListingDetailsAsync(long listingId, CancellationToken cancellationToken = default)
    {
        var url = $"{_settings.BaseUrl}/listings/{listingId}";

        try
        {
            var content = await ExecuteCurlAsync(url, cancellationToken);
            // Individual listing endpoint returns the listing directly (not wrapped)
            return JsonSerializer.Deserialize<ReverbListing>(content, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch details for listing {ListingId}", listingId);
            return null;
        }
    }

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
        var baseUrl = $"{_settings.BaseUrl}/listings/all?{makeParams}&price_max={priceMax}&accepts_offers={acceptsOffers.ToString().ToLower()}&sort=created_at-desc&per_page={perPage}";

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
                _logger.LogInformation("Fetching page {Page}: {Url}", page, nextUrl);

                var content = await ExecuteCurlAsync(nextUrl, cancellationToken);
                var response = JsonSerializer.Deserialize<ReverbListingsResponse>(content, _jsonOptions);

                if (response?.Listings == null || response.Listings.Count == 0)
                {
                    _logger.LogInformation("No more listings on page {Page}", page);
                    break;
                }

                var liveListings = response.Listings
                    .Where(l => l.State.Slug.Equals("live", StringComparison.OrdinalIgnoreCase))
                    .Where(l => l.OffersEnabled)
                    .Where(l => allowedMakes.Contains(l.Make))
                    .ToList();

                allListings.AddRange(liveListings);
                _logger.LogInformation("Page {Page}: {Count} live offer-enabled listings (total: {Total})", page, liveListings.Count, allListings.Count);

                // Check if we've reached the max
                if (allListings.Count >= maxListings)
                {
                    allListings = allListings.Take(maxListings).ToList();
                    break;
                }

                // Get next page URL
                nextUrl = response.Links?.Next?.Href;
                if (!string.IsNullOrEmpty(nextUrl))
                {
                    await Task.Delay(_settings.RateLimitDelayMs, cancellationToken);
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
    /// Like ExecuteCurlAsync but also returns the HTTP status code, so callers can
    /// distinguish API failures (e.g. 403 from a retired endpoint) from empty results —
    /// curl itself exits 0 on any HTTP status.
    /// </summary>
    private async Task<(string Body, int StatusCode)> ExecuteCurlWithStatusAsync(string url, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "curl",
            Arguments = $"-s -w \"\\n%{{http_code}}\" -H \"Authorization: Bearer {_settings.ApiKey}\" -H \"Accept: application/hal+json\" -H \"Accept-Version: 3.0\" \"{url}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };
        process.Start();

        var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        var error = await process.StandardError.ReadToEndAsync(cancellationToken);

        await process.WaitForExitAsync(cancellationToken);

        if (process.ExitCode != 0)
        {
            _logger.LogError("cURL failed with exit code {ExitCode}: {Error}", process.ExitCode, error);
            throw new HttpRequestException($"cURL request failed: {error}");
        }

        var idx = output.LastIndexOf('\n');
        var statusCode = idx >= 0 && int.TryParse(output[(idx + 1)..].Trim(), out var code) ? code : 0;
        var body = idx >= 0 ? output[..idx] : output;
        return (body, statusCode);
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
        var url = $"{_settings.BaseUrl}/csps?query={query}&per_page=24";

        try
        {
            var (body, statusCode) = await ExecuteCurlWithStatusAsync(url, cancellationToken);
            if (statusCode < 200 || statusCode >= 300)
            {
                _logger.LogWarning("CSP search returned HTTP {Status} for {Make} {Model}", statusCode, make, model);
                return new CspPriceResult { LookupError = true };
            }

            var searchResponse = JsonSerializer.Deserialize<CspSearchResponse>(body, _jsonOptions);

            var candidates = (searchResponse?.ComparisonShoppingPages ?? new List<CspResponse>())
                .Where(c => c.UsedLowPrice?.Amount > 0)
                .ToList();

            if (candidates.Count == 0)
            {
                _logger.LogDebug("No CSPs with used prices found for {Make} {Model}", make, model);
                return new CspPriceResult();
            }

            // Makes may be configured as slugs (e.g. "esp-ltd" for brand "ESP LTD")
            var makeName = make.Replace('-', ' ');
            var brandMatches = candidates
                .Where(c => c.Brand != null && c.Brand.Name.Replace('-', ' ').Equals(makeName, StringComparison.OrdinalIgnoreCase))
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
