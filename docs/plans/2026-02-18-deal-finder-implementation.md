# Deal Finder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Reverb marketplace scraper that finds guitars priced below their Price Guide estimated value and displays them in the admin portal.

**Architecture:** Extends the existing GuitarDb.Scraper with a new `DealFinderOrchestrator` that searches public listings, fetches price guide data, and upserts potential deals to MongoDB. The API exposes CRUD endpoints, and the admin portal gets a new "Deal Finder" tab.

**Tech Stack:** .NET 9.0, MongoDB, Next.js 16, React 19, TypeScript, TailwindCSS

---

## Phase 1: Backend Scraper (GuitarDb.Scraper)

### Task 1: Create PotentialBuy Model

**Files:**
- Create: `backend/GuitarDb.Scraper/Models/Domain/PotentialBuy.cs`

**Step 1: Create the model file**

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.Scraper.Models.Domain;

public class PotentialBuy
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("listing_title")]
    public string ListingTitle { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("images")]
    public List<string> Images { get; set; } = new();

    [BsonElement("reverb_link")]
    public string? ReverbLink { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("reverb_listing_id")]
    public long ReverbListingId { get; set; }

    [BsonElement("price_guide_id")]
    public string? PriceGuideId { get; set; }

    [BsonElement("price_guide_low")]
    public decimal? PriceGuideLow { get; set; }

    [BsonElement("price_guide_high")]
    public decimal? PriceGuideHigh { get; set; }

    [BsonElement("discount_percent")]
    public decimal? DiscountPercent { get; set; }

    [BsonElement("is_deal")]
    public bool IsDeal { get; set; }

    [BsonElement("has_price_guide")]
    public bool HasPriceGuide { get; set; }

    [BsonElement("first_seen_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;

    [BsonElement("last_checked_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime LastCheckedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("listing_created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ListingCreatedAt { get; set; }

    [BsonElement("dismissed")]
    public bool Dismissed { get; set; } = false;

    [BsonElement("purchased")]
    public bool Purchased { get; set; } = false;
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.Scraper/Models/Domain/PotentialBuy.cs
git commit -m "feat(scraper): add PotentialBuy model"
```

---

### Task 2: Create DealFinderSettings Configuration

**Files:**
- Create: `backend/GuitarDb.Scraper/Configuration/DealFinderSettings.cs`
- Modify: `backend/GuitarDb.Scraper/appsettings.json`
- Modify: `backend/GuitarDb.Scraper/appsettings.Example.json`

**Step 1: Create settings class**

```csharp
namespace GuitarDb.Scraper.Configuration;

public class DealFinderSettings
{
    public SearchFilters SearchFilters { get; set; } = new();
    public decimal DealThresholdPercent { get; set; } = 10;
    public int PriceGuideCacheMinutes { get; set; } = 1440;
}

public class SearchFilters
{
    public List<string> Makes { get; set; } = new()
    {
        "gibson", "prs", "fender", "ibanez", "jackson", "schecter", "esp-ltd", "esp"
    };
    public decimal PriceMax { get; set; } = 3500;
    public bool AcceptsOffers { get; set; } = true;
    public int PerPage { get; set; } = 100;
}
```

**Step 2: Update appsettings.json**

Add after the `ReverbApi` section:

```json
  "DealFinder": {
    "SearchFilters": {
      "Makes": ["gibson", "prs", "fender", "ibanez", "jackson", "schecter", "esp-ltd", "esp"],
      "PriceMax": 3500,
      "AcceptsOffers": true,
      "PerPage": 100
    },
    "DealThresholdPercent": 10,
    "PriceGuideCacheMinutes": 1440
  }
```

**Step 3: Update appsettings.Example.json**

Add the same `DealFinder` section.

**Step 4: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 5: Commit**

```bash
git add backend/GuitarDb.Scraper/Configuration/DealFinderSettings.cs
git add backend/GuitarDb.Scraper/appsettings.json
git add backend/GuitarDb.Scraper/appsettings.Example.json
git commit -m "feat(scraper): add DealFinder configuration"
```

---

### Task 3: Create PriceGuide API Response Models

**Files:**
- Create: `backend/GuitarDb.Scraper/Models/Reverb/PriceGuideResponse.cs`

**Step 1: Create the model**

```csharp
using System.Text.Json.Serialization;

namespace GuitarDb.Scraper.Models.Reverb;

public class PriceGuideResponse
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("make")]
    public string Make { get; set; } = string.Empty;

    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("year")]
    public string? Year { get; set; }

    [JsonPropertyName("estimated_value")]
    public EstimatedValue? EstimatedValue { get; set; }
}

public class EstimatedValue
{
    [JsonPropertyName("price_low")]
    public ReverbPrice? PriceLow { get; set; }

    [JsonPropertyName("price_high")]
    public ReverbPrice? PriceHigh { get; set; }
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.Scraper/Models/Reverb/PriceGuideResponse.cs
git commit -m "feat(scraper): add PriceGuide response model"
```

---

### Task 4: Create PotentialBuyRepository

**Files:**
- Create: `backend/GuitarDb.Scraper/Services/PotentialBuyRepository.cs`

**Step 1: Create the repository**

```csharp
using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Domain;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace GuitarDb.Scraper.Services;

public class PotentialBuyRepository
{
    private readonly IMongoCollection<PotentialBuy> _collection;
    private readonly ILogger<PotentialBuyRepository> _logger;

    public PotentialBuyRepository(MongoDbSettings settings, ILogger<PotentialBuyRepository> logger)
    {
        var client = new MongoClient(settings.ConnectionString);
        var database = client.GetDatabase(settings.DatabaseName);
        _collection = database.GetCollection<PotentialBuy>("potential_buys");
        _logger = logger;

        CreateIndexes();
    }

    private void CreateIndexes()
    {
        var indexModels = new List<CreateIndexModel<PotentialBuy>>
        {
            new(Builders<PotentialBuy>.IndexKeys.Ascending(x => x.ReverbListingId),
                new CreateIndexOptions { Unique = true, Name = "reverb_listing_id_unique" }),
            new(Builders<PotentialBuy>.IndexKeys
                .Ascending(x => x.IsDeal)
                .Ascending(x => x.Dismissed),
                new CreateIndexOptions { Name = "is_deal_dismissed_idx" }),
            new(Builders<PotentialBuy>.IndexKeys.Descending(x => x.FirstSeenAt),
                new CreateIndexOptions { Name = "first_seen_at_idx" })
        };

        _collection.Indexes.CreateMany(indexModels);
    }

    public async Task<PotentialBuy?> GetByReverbListingIdAsync(long reverbListingId, CancellationToken ct = default)
    {
        return await _collection
            .Find(x => x.ReverbListingId == reverbListingId)
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpsertAsync(PotentialBuy potentialBuy, CancellationToken ct = default)
    {
        var existing = await GetByReverbListingIdAsync(potentialBuy.ReverbListingId, ct);

        if (existing != null)
        {
            potentialBuy.Id = existing.Id;
            potentialBuy.FirstSeenAt = existing.FirstSeenAt;
            potentialBuy.Dismissed = existing.Dismissed;
            potentialBuy.Purchased = existing.Purchased;
        }

        var filter = Builders<PotentialBuy>.Filter.Eq(x => x.ReverbListingId, potentialBuy.ReverbListingId);
        var options = new ReplaceOptions { IsUpsert = true };

        await _collection.ReplaceOneAsync(filter, potentialBuy, options, ct);
        _logger.LogDebug("Upserted potential buy: {Title}", potentialBuy.ListingTitle);
    }

    public async Task<List<PotentialBuy>> GetAllAsync(CancellationToken ct = default)
    {
        return await _collection.Find(_ => true).ToListAsync(ct);
    }

    public async Task<int> GetDealCountAsync(CancellationToken ct = default)
    {
        return (int)await _collection.CountDocumentsAsync(
            x => x.IsDeal && !x.Dismissed && !x.Purchased,
            cancellationToken: ct);
    }
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.Scraper/Services/PotentialBuyRepository.cs
git commit -m "feat(scraper): add PotentialBuyRepository"
```

---

### Task 5: Extend ReverbApiClient with Search and PriceGuide Methods

**Files:**
- Modify: `backend/GuitarDb.Scraper/Services/ReverbApiClient.cs`

**Step 1: Add FetchPublicListingsAsync method**

Add after the existing `FetchListingDetailsAsync` method:

```csharp
public async Task<List<ReverbListing>> FetchPublicListingsAsync(
    List<string> makes,
    decimal priceMax,
    bool acceptsOffers,
    int perPage,
    CancellationToken cancellationToken = default)
{
    var makeParams = string.Join("&", makes.Select(m => $"make[]={Uri.EscapeDataString(m)}"));
    var url = $"{_settings.BaseUrl}/listings/all?{makeParams}&price_max={priceMax}&accepts_offers={acceptsOffers.ToString().ToLower()}&sort=created_at-desc&per_page={perPage}";

    _logger.LogInformation("Fetching public listings: {Url}", url);

    try
    {
        var content = await ExecuteCurlAsync(url, cancellationToken);
        var response = JsonSerializer.Deserialize<ReverbListingsResponse>(content, _jsonOptions);

        if (response?.Listings == null)
        {
            _logger.LogWarning("No listings returned from public search");
            return new List<ReverbListing>();
        }

        var liveListings = response.Listings
            .Where(l => l.State.Slug.Equals("live", StringComparison.OrdinalIgnoreCase))
            .ToList();

        _logger.LogInformation("Fetched {Count} live listings", liveListings.Count);
        return liveListings;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to fetch public listings");
        throw;
    }
}
```

**Step 2: Add FetchPriceGuideAsync method**

Add after the new method:

```csharp
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
```

**Step 3: Add using statement at top of file**

```csharp
using GuitarDb.Scraper.Models.Reverb;
```

(It should already be there, but verify)

**Step 4: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 5: Commit**

```bash
git add backend/GuitarDb.Scraper/Services/ReverbApiClient.cs
git commit -m "feat(scraper): add public listings search and price guide API methods"
```

---

### Task 6: Add price_guide_id to ReverbListing Model

**Files:**
- Modify: `backend/GuitarDb.Scraper/Models/Reverb/ReverbListing.cs`

**Step 1: Add PriceGuideId property**

Add after the `Shipping` property:

```csharp
[JsonPropertyName("price_guide_id")]
public string? PriceGuideId { get; set; }
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.Scraper/Models/Reverb/ReverbListing.cs
git commit -m "feat(scraper): add price_guide_id to ReverbListing model"
```

---

### Task 7: Create PriceGuideCache Service

**Files:**
- Create: `backend/GuitarDb.Scraper/Services/PriceGuideCache.cs`

**Step 1: Create the cache service**

```csharp
using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Reverb;
using Microsoft.Extensions.Logging;

namespace GuitarDb.Scraper.Services;

public class PriceGuideCache
{
    private readonly ReverbApiClient _apiClient;
    private readonly ILogger<PriceGuideCache> _logger;
    private readonly int _cacheMinutes;
    private readonly Dictionary<string, CachedPriceGuide> _cache = new();

    public PriceGuideCache(
        ReverbApiClient apiClient,
        DealFinderSettings settings,
        ILogger<PriceGuideCache> logger)
    {
        _apiClient = apiClient;
        _logger = logger;
        _cacheMinutes = settings.PriceGuideCacheMinutes;
    }

    public async Task<PriceGuideResponse?> GetAsync(string priceGuideId, CancellationToken ct = default)
    {
        if (_cache.TryGetValue(priceGuideId, out var cached))
        {
            if (cached.ExpiresAt > DateTime.UtcNow)
            {
                _logger.LogDebug("Price guide {Id} found in cache", priceGuideId);
                return cached.Data;
            }
            _cache.Remove(priceGuideId);
        }

        _logger.LogDebug("Fetching price guide {Id} from API", priceGuideId);
        var priceGuide = await _apiClient.FetchPriceGuideAsync(priceGuideId, ct);

        if (priceGuide != null)
        {
            _cache[priceGuideId] = new CachedPriceGuide
            {
                Data = priceGuide,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_cacheMinutes)
            };
        }

        return priceGuide;
    }

    public int CacheSize => _cache.Count;

    private class CachedPriceGuide
    {
        public PriceGuideResponse Data { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.Scraper/Services/PriceGuideCache.cs
git commit -m "feat(scraper): add PriceGuideCache service"
```

---

### Task 8: Create DealFinderOrchestrator

**Files:**
- Create: `backend/GuitarDb.Scraper/Services/DealFinderOrchestrator.cs`

**Step 1: Create the orchestrator**

```csharp
using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Domain;
using GuitarDb.Scraper.Models.Reverb;
using Microsoft.Extensions.Logging;

namespace GuitarDb.Scraper.Services;

public class DealFinderOrchestrator
{
    private readonly ReverbApiClient _apiClient;
    private readonly PotentialBuyRepository _repository;
    private readonly PriceGuideCache _priceGuideCache;
    private readonly DealFinderSettings _settings;
    private readonly ILogger<DealFinderOrchestrator> _logger;

    public DealFinderOrchestrator(
        ReverbApiClient apiClient,
        PotentialBuyRepository repository,
        PriceGuideCache priceGuideCache,
        DealFinderSettings settings,
        ILogger<DealFinderOrchestrator> logger)
    {
        _apiClient = apiClient;
        _repository = repository;
        _priceGuideCache = priceGuideCache;
        _settings = settings;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        _logger.LogInformation("===== Starting Deal Finder =====");
        _logger.LogInformation("Threshold: {Threshold}% below price guide low", _settings.DealThresholdPercent);

        var stats = new DealFinderStats();

        try
        {
            var filters = _settings.SearchFilters;
            var listings = await _apiClient.FetchPublicListingsAsync(
                filters.Makes,
                filters.PriceMax,
                filters.AcceptsOffers,
                filters.PerPage,
                cancellationToken);

            stats.ListingsChecked = listings.Count;
            _logger.LogInformation("Fetched {Count} listings to analyze", listings.Count);

            foreach (var listing in listings)
            {
                try
                {
                    var potentialBuy = await ProcessListingAsync(listing, cancellationToken);
                    await _repository.UpsertAsync(potentialBuy, cancellationToken);

                    if (potentialBuy.HasPriceGuide)
                    {
                        stats.WithPriceGuide++;
                        if (potentialBuy.IsDeal) stats.DealsFound++;
                    }
                    else
                    {
                        stats.WithoutPriceGuide++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to process listing {Id}", listing.Id);
                    stats.Errors++;
                }

                await Task.Delay(200, cancellationToken); // Rate limiting
            }

            PrintSummary(startTime, stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deal finder failed");
            throw;
        }
    }

    private async Task<PotentialBuy> ProcessListingAsync(ReverbListing listing, CancellationToken ct)
    {
        var potentialBuy = new PotentialBuy
        {
            ListingTitle = listing.Title,
            Description = listing.Description,
            Images = listing.AllImageUrls,
            ReverbLink = listing.ListingUrl,
            Condition = listing.Condition?.DisplayName,
            Price = listing.Price?.Amount ?? 0,
            Currency = listing.Price?.Currency ?? "USD",
            ReverbListingId = listing.Id,
            PriceGuideId = listing.PriceGuideId,
            LastCheckedAt = DateTime.UtcNow,
            ListingCreatedAt = ParseCreatedAt(listing)
        };

        if (!string.IsNullOrEmpty(listing.PriceGuideId))
        {
            var priceGuide = await _priceGuideCache.GetAsync(listing.PriceGuideId, ct);

            if (priceGuide?.EstimatedValue != null)
            {
                potentialBuy.HasPriceGuide = true;
                potentialBuy.PriceGuideLow = priceGuide.EstimatedValue.PriceLow?.Amount;
                potentialBuy.PriceGuideHigh = priceGuide.EstimatedValue.PriceHigh?.Amount;

                if (potentialBuy.PriceGuideLow.HasValue && potentialBuy.PriceGuideLow > 0)
                {
                    potentialBuy.DiscountPercent =
                        (potentialBuy.PriceGuideLow.Value - potentialBuy.Price)
                        / potentialBuy.PriceGuideLow.Value * 100;

                    potentialBuy.IsDeal = potentialBuy.DiscountPercent >= _settings.DealThresholdPercent;

                    _logger.LogDebug(
                        "Listing {Title}: ${Price} vs ${Low}-${High} guide = {Discount:F1}% {Deal}",
                        listing.Title,
                        potentialBuy.Price,
                        potentialBuy.PriceGuideLow,
                        potentialBuy.PriceGuideHigh,
                        potentialBuy.DiscountPercent,
                        potentialBuy.IsDeal ? "DEAL!" : "");
                }
            }
        }

        return potentialBuy;
    }

    private DateTime? ParseCreatedAt(ReverbListing listing)
    {
        // The created_at field is in the JSON but not in our model yet
        // We'll parse it from the raw response if needed
        return null;
    }

    private void PrintSummary(DateTime startTime, DealFinderStats stats)
    {
        var duration = DateTime.UtcNow - startTime;
        _logger.LogInformation("");
        _logger.LogInformation("===== DEAL FINDER SUMMARY =====");
        _logger.LogInformation("Listings Checked: {Count}", stats.ListingsChecked);
        _logger.LogInformation("With Price Guide: {Count}", stats.WithPriceGuide);
        _logger.LogInformation("Without Price Guide: {Count}", stats.WithoutPriceGuide);
        _logger.LogInformation("Deals Found: {Count}", stats.DealsFound);
        _logger.LogInformation("Errors: {Count}", stats.Errors);
        _logger.LogInformation("Price Guides Cached: {Count}", _priceGuideCache.CacheSize);
        _logger.LogInformation("Duration: {Duration}", duration);
        _logger.LogInformation("===============================");
    }

    private class DealFinderStats
    {
        public int ListingsChecked { get; set; }
        public int WithPriceGuide { get; set; }
        public int WithoutPriceGuide { get; set; }
        public int DealsFound { get; set; }
        public int Errors { get; set; }
    }
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.Scraper/Services/DealFinderOrchestrator.cs
git commit -m "feat(scraper): add DealFinderOrchestrator"
```

---

### Task 9: Update Program.cs with --deal-finder Flag

**Files:**
- Modify: `backend/GuitarDb.Scraper/Program.cs`

**Step 1: Add DealFinder settings and services registration**

After the existing services registration (around line 36), add:

```csharp
var dealFinderSettings = configuration.GetSection("DealFinder").Get<DealFinderSettings>();
if (dealFinderSettings != null)
{
    services.AddSingleton(dealFinderSettings);
    services.AddSingleton<PotentialBuyRepository>();
    services.AddSingleton<PriceGuideCache>();
    services.AddSingleton<DealFinderOrchestrator>();
}
```

**Step 2: Add using statement**

```csharp
using GuitarDb.Scraper.Configuration;
```

**Step 3: Update help text and add --deal-finder handling**

Replace the main execution block (after `var host = ...`) with:

```csharp
var logger = host.Services.GetRequiredService<ILogger<Program>>();

// Check for --help flag
if (args.Contains("--help") || args.Contains("-h"))
{
    PrintHelp();
    return 0;
}

// Check for --deal-finder flag
var runDealFinder = args.Contains("--deal-finder");

try
{
    if (runDealFinder)
    {
        logger.LogInformation("Running Deal Finder mode");
        var dealFinder = host.Services.GetRequiredService<DealFinderOrchestrator>();
        await dealFinder.RunAsync();
    }
    else
    {
        // Existing scraper logic
        var clearExisting = !args.Contains("--keep");
        logger.LogInformation("Shop Listing Scraper");
        logger.LogInformation("Clear existing: {Clear}", clearExisting);

        var orchestrator = host.Services.GetRequiredService<ScraperOrchestrator>();
        await orchestrator.RunAsync(clearExisting);
    }

    logger.LogInformation("Completed successfully");
    return 0;
}
catch (Exception ex)
{
    logger.LogError(ex, "Failed");
    return 1;
}
```

**Step 4: Update PrintHelp function**

```csharp
static void PrintHelp()
{
    Console.WriteLine();
    Console.WriteLine("GuitarDb Scraper - Usage:");
    Console.WriteLine();
    Console.WriteLine("  dotnet run [options]");
    Console.WriteLine();
    Console.WriteLine("Modes:");
    Console.WriteLine("  (default)        Scrape your own Reverb listings");
    Console.WriteLine("  --deal-finder    Search marketplace for deals below price guide");
    Console.WriteLine();
    Console.WriteLine("Options:");
    Console.WriteLine("  --keep           Don't clear existing listings before scraping");
    Console.WriteLine("  --help, -h       Show this help message");
    Console.WriteLine();
    Console.WriteLine("Examples:");
    Console.WriteLine("  dotnet run                   # Scrape your listings");
    Console.WriteLine("  dotnet run --deal-finder     # Find marketplace deals");
    Console.WriteLine();
}
```

**Step 5: Verify it compiles**

Run: `dotnet build backend/GuitarDb.Scraper/GuitarDb.Scraper.csproj`
Expected: Build succeeded

**Step 6: Test --help flag**

Run: `dotnet run --project backend/GuitarDb.Scraper -- --help`
Expected: Shows updated help with --deal-finder option

**Step 7: Commit**

```bash
git add backend/GuitarDb.Scraper/Program.cs
git commit -m "feat(scraper): add --deal-finder CLI flag"
```

---

### Task 10: Test Deal Finder End-to-End

**Step 1: Run the deal finder**

Run: `dotnet run --project backend/GuitarDb.Scraper -- --deal-finder`
Expected: Logs showing listings fetched, price guides checked, deals found

**Step 2: Verify MongoDB collection**

Run: `mongosh GuitarDb --eval "db.potential_buys.find().limit(3).pretty()"`
Expected: Shows potential buy documents with price guide data

**Step 3: Commit any fixes if needed**

---

## Phase 2: Backend API (GuitarDb.API)

### Task 11: Copy PotentialBuy Model to API Project

**Files:**
- Create: `backend/GuitarDb.API/Models/PotentialBuy.cs`

**Step 1: Copy the model**

Copy the same `PotentialBuy.cs` from the Scraper project, but update the namespace:

```csharp
namespace GuitarDb.API.Models;

// ... rest of the model is identical
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/PotentialBuy.cs
git commit -m "feat(api): add PotentialBuy model"
```

---

### Task 12: Add PotentialBuy Methods to MongoDbService

**Files:**
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs`

**Step 1: Add collection field**

Add after other collection declarations:

```csharp
private readonly IMongoCollection<PotentialBuy> _potentialBuysCollection;
```

**Step 2: Initialize collection in constructor**

Add in constructor:

```csharp
_potentialBuysCollection = database.GetCollection<PotentialBuy>("potential_buys");
```

**Step 3: Add CRUD methods**

Add at end of class:

```csharp
// Potential Buys
public async Task<List<PotentialBuy>> GetPotentialBuysAsync(
    string? status = null,
    string? sort = null,
    int page = 1,
    int perPage = 20,
    CancellationToken ct = default)
{
    var filter = Builders<PotentialBuy>.Filter.Empty;

    switch (status?.ToLower())
    {
        case "deals":
            filter = Builders<PotentialBuy>.Filter.And(
                Builders<PotentialBuy>.Filter.Eq(x => x.IsDeal, true),
                Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, false),
                Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, false));
            break;
        case "no-price-guide":
            filter = Builders<PotentialBuy>.Filter.Eq(x => x.HasPriceGuide, false);
            break;
        case "dismissed":
            filter = Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, true);
            break;
        case "purchased":
            filter = Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, true);
            break;
    }

    var sortDef = sort?.ToLower() switch
    {
        "best-deal" => Builders<PotentialBuy>.Sort.Descending(x => x.DiscountPercent),
        "price-low" => Builders<PotentialBuy>.Sort.Ascending(x => x.Price),
        "price-high" => Builders<PotentialBuy>.Sort.Descending(x => x.Price),
        _ => Builders<PotentialBuy>.Sort.Descending(x => x.FirstSeenAt)
    };

    return await _potentialBuysCollection
        .Find(filter)
        .Sort(sortDef)
        .Skip((page - 1) * perPage)
        .Limit(perPage)
        .ToListAsync(ct);
}

public async Task<PotentialBuyStats> GetPotentialBuyStatsAsync(CancellationToken ct = default)
{
    var total = await _potentialBuysCollection.CountDocumentsAsync(_ => true, cancellationToken: ct);
    var deals = await _potentialBuysCollection.CountDocumentsAsync(
        x => x.IsDeal && !x.Dismissed && !x.Purchased, cancellationToken: ct);
    var lastChecked = await _potentialBuysCollection
        .Find(_ => true)
        .SortByDescending(x => x.LastCheckedAt)
        .Limit(1)
        .FirstOrDefaultAsync(ct);

    return new PotentialBuyStats
    {
        Total = (int)total,
        Deals = (int)deals,
        LastRunAt = lastChecked?.LastCheckedAt
    };
}

public async Task<bool> UpdatePotentialBuyDismissedAsync(string id, bool dismissed, CancellationToken ct = default)
{
    var update = Builders<PotentialBuy>.Update.Set(x => x.Dismissed, dismissed);
    var result = await _potentialBuysCollection.UpdateOneAsync(
        x => x.Id == id, update, cancellationToken: ct);
    return result.ModifiedCount > 0;
}

public async Task<bool> UpdatePotentialBuyPurchasedAsync(string id, bool purchased, CancellationToken ct = default)
{
    var update = Builders<PotentialBuy>.Update.Set(x => x.Purchased, purchased);
    var result = await _potentialBuysCollection.UpdateOneAsync(
        x => x.Id == id, update, cancellationToken: ct);
    return result.ModifiedCount > 0;
}

public async Task<bool> DeletePotentialBuyAsync(string id, CancellationToken ct = default)
{
    var result = await _potentialBuysCollection.DeleteOneAsync(x => x.Id == id, ct);
    return result.DeletedCount > 0;
}
```

**Step 4: Add stats class**

Add at end of file or in Models folder:

```csharp
public class PotentialBuyStats
{
    public int Total { get; set; }
    public int Deals { get; set; }
    public DateTime? LastRunAt { get; set; }
}
```

**Step 5: Add using statement**

```csharp
using GuitarDb.API.Models;
```

**Step 6: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: Build succeeded

**Step 7: Commit**

```bash
git add backend/GuitarDb.API/Services/MongoDbService.cs
git commit -m "feat(api): add PotentialBuy MongoDB operations"
```

---

### Task 13: Add Deal Finder Endpoints to AdminController

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs`

**Step 1: Add endpoints**

Add after existing admin endpoints:

```csharp
// Deal Finder endpoints

[HttpGet("potential-buys")]
public async Task<IActionResult> GetPotentialBuys(
    [FromQuery] string? status,
    [FromQuery] string? sort,
    [FromQuery] int page = 1,
    [FromQuery] int perPage = 20,
    CancellationToken ct = default)
{
    var potentialBuys = await _mongoDbService.GetPotentialBuysAsync(status, sort, page, perPage, ct);
    return Ok(potentialBuys);
}

[HttpGet("potential-buys/stats")]
public async Task<IActionResult> GetPotentialBuyStats(CancellationToken ct = default)
{
    var stats = await _mongoDbService.GetPotentialBuyStatsAsync(ct);
    return Ok(stats);
}

[HttpPatch("potential-buys/{id}/dismiss")]
public async Task<IActionResult> DismissPotentialBuy(string id, CancellationToken ct = default)
{
    var success = await _mongoDbService.UpdatePotentialBuyDismissedAsync(id, true, ct);
    if (!success) return NotFound();
    return Ok(new { message = "Dismissed" });
}

[HttpPatch("potential-buys/{id}/purchased")]
public async Task<IActionResult> MarkPotentialBuyPurchased(string id, CancellationToken ct = default)
{
    var success = await _mongoDbService.UpdatePotentialBuyPurchasedAsync(id, true, ct);
    if (!success) return NotFound();
    return Ok(new { message = "Marked as purchased" });
}

[HttpDelete("potential-buys/{id}")]
public async Task<IActionResult> DeletePotentialBuy(string id, CancellationToken ct = default)
{
    var success = await _mongoDbService.DeletePotentialBuyAsync(id, ct);
    if (!success) return NotFound();
    return Ok(new { message = "Deleted" });
}
```

**Step 2: Verify it compiles**

Run: `dotnet build backend/GuitarDb.API/GuitarDb.API.csproj`
Expected: Build succeeded

**Step 3: Test an endpoint**

Run: `curl http://localhost:5000/api/admin/potential-buys/stats`
Expected: JSON with stats (requires API running and auth)

**Step 4: Commit**

```bash
git add backend/GuitarDb.API/Controllers/AdminController.cs
git commit -m "feat(api): add Deal Finder admin endpoints"
```

---

## Phase 3: Frontend (Next.js)

### Task 14: Create TypeScript Types

**Files:**
- Create: `frontend/lib/types/potential-buy.ts`

**Step 1: Create the types file**

```typescript
export interface PotentialBuy {
  _id: string;
  listing_title: string;
  description?: string;
  images: string[];
  reverb_link?: string;
  condition?: string;
  price: number;
  currency: string;
  reverb_listing_id: number;
  price_guide_id?: string;
  price_guide_low?: number;
  price_guide_high?: number;
  discount_percent?: number;
  is_deal: boolean;
  has_price_guide: boolean;
  first_seen_at: string;
  last_checked_at: string;
  listing_created_at?: string;
  dismissed: boolean;
  purchased: boolean;
}

export interface PotentialBuyStats {
  total: number;
  deals: number;
  lastRunAt?: string;
}
```

**Step 2: Commit**

```bash
git add frontend/lib/types/potential-buy.ts
git commit -m "feat(frontend): add PotentialBuy TypeScript types"
```

---

### Task 15: Create API Functions

**Files:**
- Modify: `frontend/lib/api.ts`

**Step 1: Add API functions**

Add at end of file:

```typescript
// Deal Finder API
export async function getPotentialBuys(
  status?: string,
  sort?: string,
  page = 1,
  perPage = 20
) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  params.set('page', String(page));
  params.set('perPage', String(perPage));

  return authGet(`/admin/potential-buys?${params}`);
}

export async function getPotentialBuyStats() {
  return authGet('/admin/potential-buys/stats');
}

export async function dismissPotentialBuy(id: string) {
  return authPatch(`/admin/potential-buys/${id}/dismiss`);
}

export async function markPotentialBuyPurchased(id: string) {
  return authPatch(`/admin/potential-buys/${id}/purchased`);
}

export async function deletePotentialBuy(id: string) {
  return authDelete(`/admin/potential-buys/${id}`);
}
```

**Step 2: Add authPatch and authDelete if not present**

Check if these exist; if not, add:

```typescript
export async function authPatch(endpoint: string, data?: any) {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

export async function authDelete(endpoint: string) {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}
```

**Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(frontend): add Deal Finder API functions"
```

---

### Task 16: Create DealFinderTab Component

**Files:**
- Create: `frontend/components/admin/DealFinderTab.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getPotentialBuys,
  getPotentialBuyStats,
  dismissPotentialBuy,
  markPotentialBuyPurchased,
} from '@/lib/api';
import type { PotentialBuy, PotentialBuyStats } from '@/lib/types/potential-buy';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'deals', label: 'Deals Only' },
  { value: 'no-price-guide', label: 'No Price Guide' },
  { value: 'dismissed', label: 'Dismissed' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'best-deal', label: 'Best Deal' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

export function DealFinderTab() {
  const [potentialBuys, setPotentialBuys] = useState<PotentialBuy[]>([]);
  const [stats, setStats] = useState<PotentialBuyStats | null>(null);
  const [status, setStatus] = useState('deals');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [buysRes, statsRes] = await Promise.all([
        getPotentialBuys(status, sort),
        getPotentialBuyStats(),
      ]);
      setPotentialBuys(buysRes);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to fetch potential buys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [status, sort]);

  const handleDismiss = async (id: string) => {
    await dismissPotentialBuy(id);
    fetchData();
  };

  const handlePurchased = async (id: string) => {
    await markPotentialBuyPurchased(id);
    fetchData();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getDealIndicator = (buy: PotentialBuy) => {
    if (!buy.has_price_guide) return null;
    if (buy.is_deal) return <span className="text-orange-500">🔥</span>;
    if (buy.discount_percent && buy.discount_percent > 0) return <span className="text-yellow-500">⚠️</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Deal Finder</h2>
          {stats && (
            <p className="text-sm text-muted-foreground">
              {stats.total} listings tracked | {stats.deals} deals found
              {stats.lastRunAt && ` | Last run: ${formatTimeAgo(stats.lastRunAt)}`}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={status === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border rounded px-3 py-1 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Listings */}
      {loading ? (
        <p>Loading...</p>
      ) : potentialBuys.length === 0 ? (
        <p className="text-muted-foreground">No potential buys found.</p>
      ) : (
        <div className="grid gap-4">
          {potentialBuys.map((buy) => (
            <Card key={buy._id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-24 h-24 flex-shrink-0">
                    {buy.images[0] ? (
                      <img
                        src={buy.images[0]}
                        alt={buy.listing_title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted rounded" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{buy.listing_title}</h3>
                    <p className="text-lg font-bold">
                      ${buy.price.toLocaleString()}
                      {buy.has_price_guide && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (guide: ${buy.price_guide_low?.toLocaleString()} - ${buy.price_guide_high?.toLocaleString()})
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getDealIndicator(buy)}
                      {buy.discount_percent !== undefined && buy.discount_percent !== null && (
                        <span className={buy.is_deal ? 'text-green-600 font-medium' : ''}>
                          {buy.discount_percent > 0 ? `${buy.discount_percent.toFixed(0)}% below` : `${Math.abs(buy.discount_percent).toFixed(0)}% above`} guide low
                        </span>
                      )}
                      {!buy.has_price_guide && <span>No price guide</span>}
                      <span>|</span>
                      <span>{buy.condition}</span>
                      <span>|</span>
                      <span>{formatTimeAgo(buy.first_seen_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a href={buy.reverb_link || '#'} target="_blank" rel="noopener noreferrer">
                        View on Reverb
                      </a>
                    </Button>
                    {!buy.dismissed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismiss(buy._id)}
                      >
                        Dismiss
                      </Button>
                    )}
                    {!buy.purchased && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePurchased(buy._id)}
                      >
                        Purchased
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/admin/DealFinderTab.tsx
git commit -m "feat(frontend): add DealFinderTab component"
```

---

### Task 17: Add Deal Finder Tab to Admin Page

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Import DealFinderTab**

Add import at top:

```typescript
import { DealFinderTab } from '@/components/admin/DealFinderTab';
```

**Step 2: Add tab to tabs list**

Find the tabs array/definition and add:

```typescript
{ id: 'deal-finder', label: 'Deal Finder' }
```

**Step 3: Add tab content**

In the tab content rendering section, add:

```typescript
{activeTab === 'deal-finder' && <DealFinderTab />}
```

**Step 4: Verify it builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 5: Test visually**

Run: `npm run dev`
Navigate to: `http://localhost:3000/admin`
Expected: "Deal Finder" tab appears and shows listings

**Step 6: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat(frontend): add Deal Finder tab to admin page"
```

---

## Phase 4: Final Integration

### Task 18: Create Windows Task Scheduler Setup Script

**Files:**
- Create: `backend/GuitarDb.Scraper/setup-scheduler.ps1`

**Step 1: Create PowerShell script**

```powershell
# Setup Windows Task Scheduler for Deal Finder
# Run as Administrator

$taskName = "LGS Deal Finder"
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $projectPath "logs"

# Create logs directory if it doesn't exist
if (!(Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath
}

$action = New-ScheduledTaskAction `
    -Execute "dotnet" `
    -Argument "run --deal-finder" `
    -WorkingDirectory $projectPath

$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 1)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Runs Deal Finder hourly to find guitar deals on Reverb"

Write-Host "Task '$taskName' created successfully!"
Write-Host "It will run every hour starting now."
```

**Step 2: Commit**

```bash
git add backend/GuitarDb.Scraper/setup-scheduler.ps1
git commit -m "chore(scraper): add Windows Task Scheduler setup script"
```

---

### Task 19: Update codebase.md Documentation

**Files:**
- Modify: `codebase.md`

**Step 1: Add Deal Finder section**

Add under Key Features:

```markdown
- [x] Deal Finder (marketplace price tracking)
  - Scrapes recent Reverb marketplace listings (configurable brands/price)
  - Compares listing prices to Reverb Price Guide estimates
  - Flags deals at/below configurable threshold (default: 10% below guide low)
  - Admin portal tab for reviewing potential buys
  - Dismiss/Mark Purchased actions
  - Runs hourly via Windows Task Scheduler
```

Add new controller entry:

```markdown
| `Controllers/AdminController.cs` | ... includes Deal Finder endpoints (potential-buys CRUD) |
```

Add new endpoint table:

```markdown
GET    /api/admin/potential-buys       - List potential buys (filters: status, sort, page)
GET    /api/admin/potential-buys/stats - Get deal finder statistics
PATCH  /api/admin/potential-buys/{id}/dismiss - Mark potential buy as dismissed
PATCH  /api/admin/potential-buys/{id}/purchased - Mark potential buy as purchased
DELETE /api/admin/potential-buys/{id}  - Remove potential buy
```

**Step 2: Commit**

```bash
git add codebase.md
git commit -m "docs: add Deal Finder to codebase.md"
```

---

### Task 20: Final Test

**Step 1: Run deal finder scraper**

```bash
cd backend/GuitarDb.Scraper
dotnet run -- --deal-finder
```

Expected: Logs show listings checked, deals found

**Step 2: Start API**

```bash
cd backend/GuitarDb.API
dotnet run
```

**Step 3: Start frontend**

```bash
cd frontend
npm run dev
```

**Step 4: Test in browser**

1. Navigate to `http://localhost:3000/admin`
2. Click "Deal Finder" tab
3. Verify listings appear with price guide comparisons
4. Test Dismiss and Purchased buttons
5. Test filter tabs

**Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: final Deal Finder integration fixes"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | Tasks 1-10 | Backend Scraper: Models, services, orchestrator, CLI |
| 2 | Tasks 11-13 | Backend API: Model, MongoDb operations, endpoints |
| 3 | Tasks 14-17 | Frontend: Types, API functions, component, admin tab |
| 4 | Tasks 18-20 | Integration: Scheduler, docs, final test |

**Total Tasks:** 20
**Estimated Commits:** ~20
