using System.Text.Json;
using GuitarDb.API.Helpers;
using GuitarDb.API.Models;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

public class ScraperService
{
    private readonly HttpClient _httpClient;
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<ScraperService> _logger;
    private readonly string _baseUrl;
    private readonly int _pageSize;
    private readonly int _rateLimitDelayMs;
    private readonly JsonSerializerOptions _jsonOptions;

    public ScraperService(
        HttpClient httpClient,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<ScraperService> logger)
    {
        _httpClient = httpClient;
        _mongoDbService = mongoDbService;
        _logger = logger;

        var apiKey = configuration["ReverbApi:ApiKey"]
            ?? throw new ArgumentNullException("ReverbApi:ApiKey", "Reverb API key is not configured");
        _baseUrl = configuration["ReverbApi:BaseUrl"] ?? "https://api.reverb.com/api";
        _pageSize = 50;
        _rateLimitDelayMs = 500;

        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/hal+json");
        _httpClient.DefaultRequestHeaders.Add("Accept-Version", "3.0");

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<ScraperResult> RunAsync(CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        var result = new ScraperResult();

        _logger.LogInformation("===== Starting Scraper Service =====");
        _logger.LogInformation("Start Time: {Time:yyyy-MM-dd HH:mm:ss} UTC", startTime);

        try
        {
            // Step 1: Get existing listings from database
            _logger.LogInformation("Step 1: Fetching existing listings from database...");
            var existingListings = await _mongoDbService.GetAllListingsForAdminAsync();
            var existingReverbLinks = existingListings
                .Where(l => !string.IsNullOrEmpty(l.ReverbLink))
                .Select(l => UrlHelper.NormalizeReverbLink(l.ReverbLink)!)
                .ToHashSet();
            _logger.LogInformation("Found {Count} existing listings in database", existingListings.Count);
            result.OutputLines.Add($"Found {existingListings.Count} existing listings in database");

            // Step 2: Fetch my listings from Reverb (summary data)
            _logger.LogInformation("Step 2: Fetching my listings from Reverb...");
            result.OutputLines.Add("Fetching listings from Reverb...");
            var reverbListings = await FetchMyListingsAsync(cancellationToken);
            result.OutputLines.Add($"Fetched {reverbListings.Count} live listings from Reverb");

            // Step 3: Disable listings no longer on Reverb
            var liveReverbLinks = reverbListings
                .Where(l => !string.IsNullOrEmpty(l.ListingUrl))
                .Select(l => UrlHelper.NormalizeReverbLink(l.ListingUrl)!)
                .ToHashSet();

            var linksToDisable = existingReverbLinks
                .Where(link => !liveReverbLinks.Contains(link))
                .ToList();

            if (linksToDisable.Count > 0)
            {
                _logger.LogInformation("Step 3: Disabling {Count} listings no longer on Reverb...", linksToDisable.Count);
                await DisableByReverbLinksAsync(linksToDisable, cancellationToken);
                result.ListingsDisabled = linksToDisable.Count;
                result.OutputLines.Add($"Disabled {linksToDisable.Count} listings no longer on Reverb");
            }
            else
            {
                _logger.LogInformation("Step 3: No listings to disable");
                result.OutputLines.Add("No listings to disable");
            }

            if (reverbListings.Count == 0)
            {
                _logger.LogWarning("No live listings found on Reverb");
                result.OutputLines.Add("No live listings found on Reverb");
                result.Duration = DateTime.UtcNow - startTime;
                return result;
            }

            // Step 4: Fetch full details for each listing to get all photos
            _logger.LogInformation("Step 4: Fetching full details for {Count} listings...", reverbListings.Count);
            result.OutputLines.Add($"Fetching full details for {reverbListings.Count} listings...");
            var myListings = new List<MyListing>();
            var totalPhotos = 0;

            for (var i = 0; i < reverbListings.Count; i++)
            {
                var listing = reverbListings[i];
                _logger.LogInformation("  [{Current}/{Total}] Fetching details for: {Title}",
                    i + 1, reverbListings.Count, listing.Title);

                var detailedListing = await FetchListingDetailsAsync(listing.Id, cancellationToken);

                if (detailedListing != null)
                {
                    var myListing = ConvertToMyListing(detailedListing);
                    myListings.Add(myListing);
                    totalPhotos += myListing.Images.Count;
                }
                else
                {
                    // Fall back to summary data if detail fetch fails
                    var myListing = ConvertToMyListing(listing);
                    myListings.Add(myListing);
                    totalPhotos += myListing.Images.Count;
                }

                // Rate limit between requests
                if (i < reverbListings.Count - 1)
                {
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                }
            }

            // Step 5: Upsert listings to database (update existing, insert new)
            _logger.LogInformation("Step 5: Upserting {Count} listings to database...", myListings.Count);
            result.OutputLines.Add($"Upserting {myListings.Count} listings to database...");
            foreach (var listing in myListings)
            {
                await UpsertByReverbLinkAsync(listing, cancellationToken);
            }

            result.ListingsScraped = myListings.Count;
            result.TotalPhotos = totalPhotos;
            result.Duration = DateTime.UtcNow - startTime;
            result.OutputLines.Add($"Scraper completed: {myListings.Count} listings, {totalPhotos} photos");

            _logger.LogInformation("===== SCRAPER SUMMARY =====");
            _logger.LogInformation("Listings Scraped: {Count}", myListings.Count);
            _logger.LogInformation("Total Photos: {Photos}", totalPhotos);
            _logger.LogInformation("Listings Disabled: {Disabled}", result.ListingsDisabled);
            _logger.LogInformation("Duration: {Duration}", result.Duration);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scraper failed with error");
            result.Error = ex.Message;
            result.Duration = DateTime.UtcNow - startTime;
            throw;
        }
    }

    private async Task<List<ReverbListing>> FetchMyListingsAsync(CancellationToken cancellationToken)
    {
        var allListings = new List<ReverbListing>();
        var currentPage = 1;
        string? nextUrl = $"{_baseUrl}/my/listings?per_page={_pageSize}";

        _logger.LogInformation("Fetching my Reverb listings...");

        while (!string.IsNullOrEmpty(nextUrl))
        {
            try
            {
                _logger.LogDebug("Fetching page {Page}: {Url}", currentPage, nextUrl);

                var response = await _httpClient.GetAsync(nextUrl, cancellationToken);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
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
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
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

    private async Task<ReverbListing?> FetchListingDetailsAsync(long listingId, CancellationToken cancellationToken)
    {
        var url = $"{_baseUrl}/listings/{listingId}";

        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            // Individual listing endpoint returns the listing directly (not wrapped)
            return JsonSerializer.Deserialize<ReverbListing>(content, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch details for listing {ListingId}", listingId);
            return null;
        }
    }

    private MyListing ConvertToMyListing(ReverbListing reverb)
    {
        return new MyListing
        {
            ListingTitle = reverb.Title,
            Description = reverb.Description,
            Images = reverb.AllImageUrls,
            ReverbLink = UrlHelper.NormalizeReverbLink(reverb.ListingUrl),
            Condition = reverb.Condition?.DisplayName,
            Price = reverb.Price?.Amount ?? 0,
            Currency = reverb.Price?.Currency ?? "USD",
            ScrapedAt = DateTime.UtcNow,
            ListedAt = reverb.PublishedAt
        };
    }

    private async Task UpsertByReverbLinkAsync(MyListing listing, CancellationToken cancellationToken)
    {
        // Check if listing exists
        var existing = await _mongoDbService.GetMyListingByReverbLinkAsync(listing.ReverbLink);

        if (existing != null)
        {
            // Update existing - preserve Id and Disabled status
            listing.Id = existing.Id;
            listing.Disabled = existing.Disabled;
            await _mongoDbService.UpdateMyListingAsync(existing.Id!, listing);
        }
        else
        {
            // Insert new
            await _mongoDbService.CreateMyListingAsync(listing);
        }
    }

    private async Task DisableByReverbLinksAsync(List<string> reverbLinks, CancellationToken cancellationToken)
    {
        await _mongoDbService.DisableByReverbLinksAsync(reverbLinks);
    }
}

public class ScraperResult
{
    public int ListingsScraped { get; set; }
    public int TotalPhotos { get; set; }
    public int ListingsDisabled { get; set; }
    public TimeSpan Duration { get; set; }
    public string? Error { get; set; }
    public List<string> OutputLines { get; set; } = new();
}
