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
                    .ToList();

                allListings.AddRange(liveListings);
                _logger.LogInformation("Page {Page}: {Count} live listings (total: {Total})", page, liveListings.Count, allListings.Count);

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

    public async Task<PriceGuideResponse?> FetchPriceGuideAsync(string priceGuideId, CancellationToken cancellationToken = default)
    {
        var url = $"{_settings.BaseUrl}/priceguide/{priceGuideId}";

        try
        {
            var content = await ExecuteCurlAsync(url, cancellationToken);
            return JsonSerializer.Deserialize<PriceGuideResponse>(content, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch price guide {Id}", priceGuideId);
            return null;
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
        var url = $"{_settings.BaseUrl}/priceguide?query={query}&per_page=50";

        try
        {
            var content = await ExecuteCurlAsync(url, cancellationToken);
            var response = JsonSerializer.Deserialize<PriceGuideSearchResponse>(content, _jsonOptions);

            if (response?.PriceGuides == null || response.PriceGuides.Count == 0)
            {
                _logger.LogDebug("No price guides found for {Make} {Model}", make, model);
                return new PriceGuideResult { PriceGuide = null, MatchType = PriceGuideMatchType.Fallback };
            }

            // Filter to only guides with estimated values
            var guidesWithValues = response.PriceGuides
                .Where(g => g.EstimatedValue?.PriceLow != null)
                .ToList();

            if (guidesWithValues.Count == 0)
            {
                _logger.LogDebug("No price guides with values for {Make} {Model}", make, model);
                return new PriceGuideResult { PriceGuide = null, MatchType = PriceGuideMatchType.Fallback };
            }

            _logger.LogDebug("Found {Count} price guides for {Make} {Model}", guidesWithValues.Count, make, model);

            // Priority 1: Match by CSP ID (most reliable)
            if (!string.IsNullOrEmpty(cspId))
            {
                var cspMatches = guidesWithValues.Where(g => g.ComparisonShoppingPageId == cspId).ToList();

                if (cspMatches.Count > 0)
                {
                    // If year provided, try to find matching year range
                    if (year.HasValue)
                    {
                        var yearMatch = cspMatches.FirstOrDefault(g => IsYearInRange(year.Value, g.Year));
                        if (yearMatch != null)
                        {
                            _logger.LogInformation("Price guide match: CSP+Year for {Make} {Model} {Year} -> {Title} ({GuideYear}) ${Low}-${High}",
                                make, model, year, yearMatch.Title, yearMatch.Year,
                                yearMatch.EstimatedValue?.PriceLow?.Amount, yearMatch.EstimatedValue?.PriceHigh?.Amount);
                            return new PriceGuideResult { PriceGuide = yearMatch, MatchType = PriceGuideMatchType.CspAndYear };
                        }
                    }

                    // Return first CSP match
                    var cspMatch = cspMatches.First();
                    _logger.LogInformation("Price guide match: CSP for {Make} {Model} -> {Title} ({GuideYear}) ${Low}-${High}",
                        make, model, cspMatch.Title, cspMatch.Year,
                        cspMatch.EstimatedValue?.PriceLow?.Amount, cspMatch.EstimatedValue?.PriceHigh?.Amount);
                    return new PriceGuideResult { PriceGuide = cspMatch, MatchType = PriceGuideMatchType.Csp };
                }
            }

            // Priority 2: Match by model name (model accuracy is more important than year)
            var modelMatches = guidesWithValues
                .Where(g => g.Model.Equals(model, StringComparison.OrdinalIgnoreCase) ||
                           g.Title.Contains(model, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (modelMatches.Count > 0)
            {
                // If we have year, prefer model matches that also match year
                if (year.HasValue)
                {
                    var modelYearMatch = modelMatches.FirstOrDefault(g => IsYearInRange(year.Value, g.Year));
                    if (modelYearMatch != null)
                    {
                        _logger.LogInformation("Price guide match: Model+Year for {Make} {Model} {Year} -> {Title} ({GuideYear}) ${Low}-${High}",
                            make, model, year, modelYearMatch.Title, modelYearMatch.Year,
                            modelYearMatch.EstimatedValue?.PriceLow?.Amount, modelYearMatch.EstimatedValue?.PriceHigh?.Amount);
                        return new PriceGuideResult { PriceGuide = modelYearMatch, MatchType = PriceGuideMatchType.ModelAndYear };
                    }
                }

                // Return best model match (prefer exact model match over title contains)
                var exactModelMatch = modelMatches.FirstOrDefault(g => g.Model.Equals(model, StringComparison.OrdinalIgnoreCase));
                var match = exactModelMatch ?? modelMatches.First();
                _logger.LogInformation("Price guide match: Model for {Make} {Model} -> {Title} ({GuideYear}) ${Low}-${High}",
                    make, model, match.Title, match.Year,
                    match.EstimatedValue?.PriceLow?.Amount, match.EstimatedValue?.PriceHigh?.Amount);
                return new PriceGuideResult { PriceGuide = match, MatchType = PriceGuideMatchType.Model };
            }

            // Priority 3: Match by year only (less reliable - may match wrong variant)
            if (year.HasValue)
            {
                var yearMatches = guidesWithValues
                    .Where(g => IsYearInRange(year.Value, g.Year))
                    .ToList();

                if (yearMatches.Count > 0)
                {
                    var match = yearMatches.First();
                    _logger.LogWarning("Price guide match: Year-only for {Make} {Model} {Year} -> {Title} ({GuideYear}) ${Low}-${High} (model mismatch possible)",
                        make, model, year, match.Title, match.Year,
                        match.EstimatedValue?.PriceLow?.Amount, match.EstimatedValue?.PriceHigh?.Amount);
                    return new PriceGuideResult { PriceGuide = match, MatchType = PriceGuideMatchType.YearOnly };
                }
            }

            // Priority 4: First result (least reliable)
            var fallback = guidesWithValues.First();
            _logger.LogWarning("Price guide fallback: Using first result for {Make} {Model} -> {Title} ({GuideYear}) ${Low}-${High}",
                make, model, fallback.Title, fallback.Year,
                fallback.EstimatedValue?.PriceLow?.Amount, fallback.EstimatedValue?.PriceHigh?.Amount);
            return new PriceGuideResult { PriceGuide = fallback, MatchType = PriceGuideMatchType.Fallback };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to search price guide for {Make} {Model}", make, model);
            return new PriceGuideResult { PriceGuide = null, MatchType = PriceGuideMatchType.Fallback };
        }
    }

    private static bool IsYearInRange(int year, string? yearRange)
    {
        if (string.IsNullOrEmpty(yearRange))
            return false;

        // Handle single year (e.g., "1984")
        if (int.TryParse(yearRange, out var singleYear))
            return year == singleYear;

        // Handle year range (e.g., "1981-1984" or "1981 - 1984")
        var parts = yearRange.Split(new[] { '-', '–' }, StringSplitOptions.TrimEntries);
        if (parts.Length == 2 &&
            int.TryParse(parts[0], out var startYear) &&
            int.TryParse(parts[1], out var endYear))
        {
            return year >= startYear && year <= endYear;
        }

        // Handle "Present" (e.g., "2020-Present")
        if (parts.Length == 2 &&
            int.TryParse(parts[0], out var fromYear) &&
            parts[1].Equals("Present", StringComparison.OrdinalIgnoreCase))
        {
            return year >= fromYear;
        }

        return false;
    }
}
