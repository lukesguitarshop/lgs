using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using GuitarDb.API.Models;
using Microsoft.Extensions.Configuration;

namespace GuitarDb.API.Services;

public class SweetwaterScraperClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SweetwaterScraperClient> _logger;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private readonly JsonSerializerOptions _jsonOptions;
    private static readonly Regex YearRegex = new(@"\b(19[5-9]\d|20[0-2]\d)\b", RegexOptions.Compiled);

    private const string AlgoliaAppId = "E2O5C5M9LS";
    private const string AlgoliaApiKey = "013abf8e573fc605f7b8d69f15711113";
    private const string AlgoliaIndex = "production_listings";
    private const int HitsPerPage = 50;

    public SweetwaterScraperClient(
        HttpClient httpClient,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        ILogger<SweetwaterScraperClient> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        _httpClient.DefaultRequestHeaders.Add("X-Algolia-Application-Id", AlgoliaAppId);
        _httpClient.DefaultRequestHeaders.Add("X-Algolia-API-Key", AlgoliaApiKey);
    }

    public async Task<List<SweetwaterListing>> FetchListingsAsync(
        List<string> makes,
        decimal priceMax,
        int maxListings,
        CancellationToken cancellationToken = default)
    {
        var allListings = new List<SweetwaterListing>();
        var page = 0;
        var rateLimitMs = _configuration.GetValue<int>("DealFinder:SweetwaterRateLimitMs", 200);

        // Build brand facet filter: [["brand:Fender","brand:Gibson",...]] means OR within the array
        var brandFilters = makes.Select(m => $"brand:{m}").ToList();

        _logger.LogInformation("Fetching up to {Max} Sweetwater listings for brands: {Brands}",
            maxListings, string.Join(", ", makes));

        while (allListings.Count < maxListings)
        {
            try
            {
                var requestBody = new
                {
                    query = "",
                    hitsPerPage = HitsPerPage,
                    page,
                    numericFilters = new[] { $"price<={priceMax}" },
                    facetFilters = new[] { brandFilters }
                };

                var url = $"https://{AlgoliaAppId}-dsn.algolia.net/1/indexes/{AlgoliaIndex}/query";
                var content = new StringContent(
                    JsonSerializer.Serialize(requestBody),
                    System.Text.Encoding.UTF8,
                    "application/json");

                _logger.LogInformation("Fetching Sweetwater Algolia page {Page}", page);
                var response = await _httpClient.PostAsync(url, content, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Algolia returned {StatusCode} for page {Page}", response.StatusCode, page);
                    break;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<AlgoliaSearchResponse>(json, _jsonOptions);

                if (result?.Hits == null || result.Hits.Count == 0)
                {
                    _logger.LogInformation("No more hits on page {Page}", page);
                    break;
                }

                var listings = result.Hits
                    .Where(h => !string.IsNullOrEmpty(h.Brand) && !string.IsNullOrEmpty(h.Title))
                    .Select(h => ConvertToListing(h))
                    .ToList();

                allListings.AddRange(listings);
                _logger.LogInformation("Page {Page}: {Count} listings (total: {Total}/{Available})",
                    page, listings.Count, allListings.Count, result.NbHits);

                if (allListings.Count >= maxListings)
                {
                    allListings = allListings.Take(maxListings).ToList();
                    break;
                }

                // Stop if we've exhausted all pages
                if (page >= result.NbPages - 1)
                    break;

                page++;
                await Task.Delay(rateLimitMs, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Failed to fetch Sweetwater Algolia page {Page}", page);
                break;
            }
        }

        _logger.LogInformation("Fetched {Count} total Sweetwater listings", allListings.Count);
        return allListings;
    }

    private SweetwaterListing ConvertToListing(AlgoliaHit hit)
    {
        var fullTitle = $"Used {hit.Brand} {hit.Title}";

        // Parse model and finish from the title
        var (model, finish) = ParseModelAndFinish(hit.Title);

        // Parse year from title
        int? year = null;
        var yearMatch = YearRegex.Match(hit.Title);
        if (yearMatch.Success && int.TryParse(yearMatch.Value, out var parsedYear))
            year = parsedYear;

        var listingUrl = $"https://www.sweetwater.com/used/listings/{hit.ObjectID}-{hit.Slug}";

        return new SweetwaterListing
        {
            ListingId = long.TryParse(hit.ObjectID, out var id) ? id : 0,
            Title = fullTitle,
            Price = hit.Price,
            OriginalPrice = hit.OriginalPrice != hit.Price ? hit.OriginalPrice : null,
            Condition = hit.Condition,
            ImageUrl = hit.PrimaryImage?.ThumbnailUrl ?? hit.PrimaryImage?.MediumUrl,
            ListingUrl = listingUrl,
            Shipping = hit.ShippingMessage ?? (hit.FreeShipping == 1 ? "Free Shipping" : null),
            Make = hit.Brand ?? "",
            Model = model,
            Finish = finish,
            Year = year
        };
    }

    private static (string Model, string? Finish) ParseModelAndFinish(string title)
    {
        // Title format from Algolia: "{Model} {details} - {Finish}"
        // e.g. "Les Paul Standard '50s Plain Top Electric Guitar - Inverness Green"
        // Brand is already in a separate field

        var parts = title.Split(new[] { " - " }, 2, StringSplitOptions.TrimEntries);
        var modelRaw = parts[0];
        var finish = parts.Length > 1 ? parts[1] : null;

        // Clean up model - remove common suffixes
        var suffixes = new[]
        {
            " Electric Guitar", " Acoustic Guitar", " Acoustic-Electric Guitar",
            " Bass Guitar", " Classical Guitar", " Resonator"
        };

        var model = modelRaw;
        foreach (var suffix in suffixes)
        {
            if (model.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                model = model[..^suffix.Length].Trim();
                break;
            }
        }

        return (model, finish);
    }
}

// Algolia response models

public class AlgoliaSearchResponse
{
    [JsonPropertyName("hits")]
    public List<AlgoliaHit> Hits { get; set; } = new();

    [JsonPropertyName("nbHits")]
    public int NbHits { get; set; }

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("nbPages")]
    public int NbPages { get; set; }

    [JsonPropertyName("hitsPerPage")]
    public int HitsPerPage { get; set; }
}

public class AlgoliaHit
{
    [JsonPropertyName("objectID")]
    public string ObjectID { get; set; } = "";

    [JsonPropertyName("slug")]
    public string? Slug { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("brand")]
    public string? Brand { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("original_price")]
    public decimal OriginalPrice { get; set; }

    [JsonPropertyName("condition")]
    public string? Condition { get; set; }

    [JsonPropertyName("free_shipping")]
    public int FreeShipping { get; set; }

    [JsonPropertyName("shipping_message")]
    public string? ShippingMessage { get; set; }

    [JsonPropertyName("primary_image")]
    public AlgoliaImage? PrimaryImage { get; set; }

    [JsonPropertyName("accepts_offers")]
    public int AcceptsOffers { get; set; }

    [JsonPropertyName("published_at")]
    public long? PublishedAt { get; set; }
}

public class AlgoliaImage
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("medium_url")]
    public string? MediumUrl { get; set; }

    [JsonPropertyName("thumbnail_url")]
    public string? ThumbnailUrl { get; set; }
}
