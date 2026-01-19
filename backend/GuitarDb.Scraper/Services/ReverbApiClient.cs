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
}
