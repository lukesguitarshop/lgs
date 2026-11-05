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

    private static readonly List<string> GuitarCategories = new()
    {
        "cat_lvl_1:Guitars >> Electric Guitars",
        "cat_lvl_1:Guitars >> Acoustic Guitars",
    };
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
                    // Guitars only, like the Reverb scan - parts, amps, pedals and accessories
                    // share these brands and can never match a guitar's sold price
                    facetFilters = new[] { brandFilters, GuitarCategories },
                    // user_id isn't in the index's default attributes - ask for everything
                    attributesToRetrieve = new[] { "*" }
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

        try
        {
            await AddSellerDetailsAsync(allListings, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Seller details are nice-to-have; a failed lookup shouldn't sink the sweep
            _logger.LogWarning(ex, "Failed to look up Sweetwater seller details");
        }

        return allListings;
    }

    // Algolia caps a multi-query at 50 requests; storefront lookups batch the same way
    private const int SellerBatchSize = 50;

    /// <summary>
    /// Fills in each listing's seller name/storefront (from the storefronts index) and how
    /// many listings that seller has up across Gear Exchange. Sweetwater's review counts
    /// sit behind bot protection, so the listing count is what separates shops (100+)
    /// from private sellers (a handful).
    /// </summary>
    private async Task AddSellerDetailsAsync(List<SweetwaterListing> listings, CancellationToken ct)
    {
        var userIds = listings.Where(l => l.SellerUserId.HasValue).Select(l => l.SellerUserId!.Value).Distinct().ToList();
        if (userIds.Count == 0) return;

        var storefronts = new Dictionary<long, AlgoliaStorefront>();
        var listingCounts = new Dictionary<long, int>();

        foreach (var batch in userIds.Chunk(SellerBatchSize))
        {
            var storefrontQuery = new
            {
                query = "",
                hitsPerPage = batch.Length,
                filters = string.Join(" OR ", batch.Select(id => $"user_id={id}"))
            };
            var storefrontResponse = await PostAlgoliaAsync<AlgoliaStorefrontResponse>(
                $"https://{AlgoliaAppId}-dsn.algolia.net/1/indexes/production_storefronts/query", storefrontQuery, ct);
            foreach (var sf in storefrontResponse?.Hits ?? new())
                storefronts[sf.UserId] = sf;

            var countQuery = new
            {
                requests = batch.Select(id => new
                {
                    indexName = AlgoliaIndex,
                    @params = $"hitsPerPage=0&filters=user_id%3D{id}"
                })
            };
            var countResponse = await PostAlgoliaAsync<AlgoliaMultiQueryResponse>(
                $"https://{AlgoliaAppId}-dsn.algolia.net/1/indexes/*/queries", countQuery, ct);
            var results = countResponse?.Results ?? new();
            for (var i = 0; i < Math.Min(batch.Length, results.Count); i++)
                listingCounts[batch[i]] = results[i].NbHits;
        }

        foreach (var listing in listings)
        {
            if (listing.SellerUserId is not long userId) continue;
            if (storefronts.TryGetValue(userId, out var sf))
            {
                listing.SellerName = sf.Name;
                listing.SellerSlug = sf.Slug;
            }
            if (listingCounts.TryGetValue(userId, out var count))
                listing.SellerListingCount = count;
        }

        _logger.LogInformation("Looked up {Sellers} Sweetwater sellers ({Storefronts} storefronts)",
            userIds.Count, storefronts.Count);
    }

    private async Task<T?> PostAlgoliaAsync<T>(string url, object body, CancellationToken ct)
    {
        using var content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content, ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Algolia returned {StatusCode} for {Url}", response.StatusCode, url);
            return default;
        }
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<T>(json, _jsonOptions);
    }

    private static readonly Regex ShippingAmountRegex = new(@"\$\s*([\d,]+(?:\.\d{1,2})?)", RegexOptions.Compiled);

    /// <summary>"$99.00 Shipping" → 99, free shipping → 0, anything else → null.</summary>
    private static decimal? ParseShippingPrice(AlgoliaHit hit)
    {
        if (hit.FreeShipping == 1) return 0m;
        var message = hit.ShippingMessage;
        if (string.IsNullOrWhiteSpace(message)) return null;
        if (message.Contains("free", StringComparison.OrdinalIgnoreCase)) return 0m;
        var match = ShippingAmountRegex.Match(message);
        return match.Success && decimal.TryParse(match.Groups[1].Value.Replace(",", ""),
            System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var amount)
            ? amount
            : null;
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
            ShippingPrice = ParseShippingPrice(hit),
            PublishedAt = hit.PublishedAt is long ts ? DateTimeOffset.FromUnixTimeSeconds(ts).UtcDateTime : null,
            SellerUserId = hit.UserId,
            SellerLocation = hit.Location,
            Make = hit.Brand ?? "",
            Model = model,
            Finish = finish,
            Year = year,
            MadeYear = hit.MadeYear is > 0 ? hit.MadeYear : null,
            MadeDecade = string.IsNullOrWhiteSpace(hit.MadeDecade) ? null : hit.MadeDecade
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

    [JsonPropertyName("user_id")]
    public long? UserId { get; set; }

    /// <summary>Year the seller says it was made - set on some listings.</summary>
    [JsonPropertyName("made_year")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int? MadeYear { get; set; }

    /// <summary>"2010s" - set on more listings than made_year.</summary>
    [JsonPropertyName("made_decade")]
    public string? MadeDecade { get; set; }

    [JsonPropertyName("location")]
    public string? Location { get; set; }
}

public class AlgoliaStorefrontResponse
{
    [JsonPropertyName("hits")]
    public List<AlgoliaStorefront> Hits { get; set; } = new();
}

public class AlgoliaStorefront
{
    [JsonPropertyName("user_id")]
    public long UserId { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("slug")]
    public string? Slug { get; set; }
}

public class AlgoliaMultiQueryResponse
{
    [JsonPropertyName("results")]
    public List<AlgoliaSearchResponse> Results { get; set; } = new();
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
