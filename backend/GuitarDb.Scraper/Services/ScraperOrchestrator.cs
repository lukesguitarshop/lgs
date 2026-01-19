using GuitarDb.Scraper.Models.Domain;
using GuitarDb.Scraper.Models.Reverb;
using Microsoft.Extensions.Logging;

namespace GuitarDb.Scraper.Services;

public class ScraperOrchestrator
{
    private readonly ReverbApiClient _apiClient;
    private readonly MyListingRepository _repository;
    private readonly ILogger<ScraperOrchestrator> _logger;
    private readonly int _rateLimitDelayMs;

    public ScraperOrchestrator(
        ReverbApiClient apiClient,
        MyListingRepository repository,
        ILogger<ScraperOrchestrator> logger)
    {
        _apiClient = apiClient;
        _repository = repository;
        _logger = logger;
        _rateLimitDelayMs = 500;
    }

    public async Task RunAsync(bool clearExisting = true, CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;

        _logger.LogInformation("===== Starting My Listings Scraper =====");
        _logger.LogInformation("Start Time: {Time:yyyy-MM-dd HH:mm:ss} UTC", startTime);

        try
        {
            // Step 1: Clear existing listings if requested
            if (clearExisting)
            {
                _logger.LogInformation("Step 1: Clearing existing listings...");
                await _repository.ClearAllAsync(cancellationToken);
            }

            // Step 2: Fetch my listings from Reverb (summary data)
            _logger.LogInformation("Step 2: Fetching my listings from Reverb...");
            var reverbListings = await _apiClient.FetchMyListingsAsync(cancellationToken);

            if (reverbListings.Count == 0)
            {
                _logger.LogWarning("No live listings found");
                PrintSummary(startTime, 0, 0);
                return;
            }

            // Step 3: Fetch full details for each listing to get all photos
            _logger.LogInformation("Step 3: Fetching full details for {Count} listings...", reverbListings.Count);
            var myListings = new List<MyListing>();
            var totalPhotos = 0;

            for (var i = 0; i < reverbListings.Count; i++)
            {
                var listing = reverbListings[i];
                _logger.LogInformation("  [{Current}/{Total}] Fetching details for: {Title}",
                    i + 1, reverbListings.Count, listing.Title);

                var detailedListing = await _apiClient.FetchListingDetailsAsync(listing.Id, cancellationToken);

                if (detailedListing != null)
                {
                    var myListing = ConvertToMyListing(detailedListing);
                    myListings.Add(myListing);
                    totalPhotos += myListing.Images.Count;
                    _logger.LogDebug("    Found {PhotoCount} photos", myListing.Images.Count);
                }
                else
                {
                    // Fall back to summary data if detail fetch fails
                    var myListing = ConvertToMyListing(listing);
                    myListings.Add(myListing);
                    totalPhotos += myListing.Images.Count;
                    _logger.LogWarning("    Using summary data ({PhotoCount} photos)", myListing.Images.Count);
                }

                // Rate limit between requests
                if (i < reverbListings.Count - 1)
                {
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                }
            }

            // Step 4: Save to database
            _logger.LogInformation("Step 4: Saving {Count} listings to database...", myListings.Count);
            await _repository.InsertManyAsync(myListings, cancellationToken);

            PrintSummary(startTime, myListings.Count, totalPhotos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scraper failed with error");
            throw;
        }
    }

    private MyListing ConvertToMyListing(ReverbListing reverb)
    {
        return new MyListing
        {
            ListingTitle = reverb.Title,
            Description = reverb.Description,
            Images = reverb.AllImageUrls,
            ReverbLink = reverb.ListingUrl,
            Condition = reverb.Condition?.DisplayName,
            Price = reverb.Price?.Amount ?? 0,
            Currency = reverb.Price?.Currency ?? "USD",
            ScrapedAt = DateTime.UtcNow
        };
    }

    private void PrintSummary(DateTime startTime, int listingsCount, int totalPhotos)
    {
        var duration = DateTime.UtcNow - startTime;
        _logger.LogInformation("");
        _logger.LogInformation("===== SCRAPER SUMMARY =====");
        _logger.LogInformation("Listings Scraped: {Count}", listingsCount);
        _logger.LogInformation("Total Photos: {Photos}", totalPhotos);
        _logger.LogInformation("Duration: {Duration}", duration);
        _logger.LogInformation("===========================");
    }
}
