using System.Collections.Concurrent;
using GuitarDb.API.Models;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

/// <summary>What a listing is matched on.</summary>
public class SoldPriceQuery
{
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? Title { get; set; }
    public int? Year { get; set; }

    /// <summary>Reverb listings only - lets the matcher read the listing's own product link.</summary>
    public long? ReverbListingId { get; set; }

    /// <summary>The product link from an earlier sweep, so the single-listing endpoint isn't re-read.</summary>
    public string? KnownListingProductId { get; set; }

    /// <summary>True when an earlier sweep already read the listing's product link (found or not).</summary>
    public bool ListingLinkChecked { get; set; }
}

public class SoldPriceResult
{
    public ProductPrice? Product { get; set; }
    public string? MatchSource { get; set; }

    /// <summary>A Reverb call failed - the listing or product couldn't be priced this time.</summary>
    public bool LookupError { get; set; }

    /// <summary>The cached product couldn't be refreshed, so its sales may be out of date.</summary>
    public bool Stale { get; set; }

    /// <summary>Text search only: the product name and the seller's model agree word for word (see ProductMatcher.IsStrongMatch).</summary>
    public bool StrongTextMatch { get; set; }

    /// <summary>The listing's own product link (Reverb), to store so later sweeps skip the lookup.</summary>
    public string? ListingProductId { get; set; }
    public bool ListingLinkChecked { get; set; }
}

/// <summary>
/// Ties listings to Reverb products and prices them from real sold transactions.
/// Match order: a manual fix, the listing's own product link, a learned alias for the
/// seller's make + model text, then a scored text search. Products and their sales are
/// cached in Mongo (product_prices) and shared by both deal finders and the sold-history panel.
/// </summary>
public class SoldPriceService
{
    private readonly ReverbDealFinderClient _reverb;
    private readonly ReverbSoldHistoryClient _soldHistory;
    private readonly MongoDbService _mongo;
    private readonly ILogger<SoldPriceService> _logger;
    private readonly TimeSpan _cacheAge;

    // Catalog search results by query - Sweetwater rescans every 30 minutes and the same
    // models come up every sweep, so searches are reused for the cache age like products
    private readonly ConcurrentDictionary<string, (List<CspResponse> Results, DateTime At)> _searchCache = new(StringComparer.OrdinalIgnoreCase);

    public SoldPriceService(
        ReverbDealFinderClient reverb,
        ReverbSoldHistoryClient soldHistory,
        MongoDbService mongo,
        IConfiguration configuration,
        ILogger<SoldPriceService> logger)
    {
        _reverb = reverb;
        _soldHistory = soldHistory;
        _mongo = mongo;
        _logger = logger;
        _cacheAge = TimeSpan.FromMinutes(configuration.GetValue<int>("DealFinder:PriceGuideCacheMinutes", 1440));
    }

    public async Task<SoldPriceResult> ResolveAsync(SoldPriceQuery query, CancellationToken ct = default)
    {
        var result = new SoldPriceResult
        {
            ListingProductId = query.KnownListingProductId,
            ListingLinkChecked = query.ListingLinkChecked,
        };

        var key = SoldPriceMath.OverrideKey(query.Make, query.Model);
        var productOverride = key == null ? null : await _mongo.GetProductOverrideAsync(key, ct);

        // 1. A manual fix always wins
        if (productOverride?.Source == ProductOverrideSources.Manual)
            return await PriceAsync(result, productOverride.ProductId, MatchSources.Manual, ct);

        // 2. The product the seller picked when listing on Reverb
        if (query.ReverbListingId is { } listingId && !query.ListingLinkChecked)
        {
            var (productId, failed) = await _reverb.GetListingProductIdAsync(listingId, ct);
            if (!failed)
            {
                result.ListingProductId = productId;
                result.ListingLinkChecked = true;
            }
        }

        if (result.ListingProductId != null)
        {
            await PriceAsync(result, result.ListingProductId, MatchSources.ListingLink, ct);
            if (key != null && result.Product != null && NamesProduct(query, result.Product))
                await LearnAliasAsync(key, productOverride, result.ListingProductId, ct);
            return result;
        }

        // 3. Another listing with the same make + model text carried a product link - used only
        //    while the text still names the product
        if (productOverride is { Source: ProductOverrideSources.Learned, Ambiguous: false })
        {
            await PriceAsync(result, productOverride.ProductId, MatchSources.Alias, ct);
            if (result.Product == null || NamesProduct(query, result.Product))
                return result;

            result.Product = null;
            result.MatchSource = null;
            result.Stale = false;
            result.LookupError = false;
        }

        // 4. Scored text search
        var (candidate, strong, searchFailed) = await SearchAsync(query, ct);
        if (candidate != null)
        {
            result.StrongTextMatch = strong;
            return await PriceAsync(result, candidate.Id, MatchSources.TextSearch, ct);
        }

        result.LookupError = searchFailed;
        return result;
    }

    /// <summary>
    /// Ties the listing's make + model to a pasted reverb.com/p/... product (or confirms its current
    /// match with <paramref name="confirmProductId"/>) for good and returns the product. Null when
    /// the text isn't a product link; no Product when Reverb has no such product.
    /// </summary>
    public async Task<SoldPriceResult?> SetManualProductAsync(string? make, string? model, string? url, CancellationToken ct = default, string? confirmProductId = null)
    {
        string productId;
        if (!string.IsNullOrEmpty(confirmProductId))
        {
            // "Right product": the listing's current match, confirmed as is
            if (!confirmProductId.All(char.IsDigit)) return null;
            productId = confirmProductId;
        }
        else
        {
            var slug = SoldPriceMath.ParseProductSlug(url);
            if (slug == null) return null;

            var csp = await _reverb.FindCspBySlugAsync(slug, ct);
            if (csp == null) return new SoldPriceResult { LookupError = true };
            productId = csp.Id.ToString();
        }
        var key = SoldPriceMath.OverrideKey(make, model);
        if (key != null)
        {
            await _mongo.UpsertProductOverrideAsync(new ProductOverride
            {
                Key = key,
                ProductId = productId,
                Source = ProductOverrideSources.Manual,
            }, ct);
        }

        return await PriceAsync(new SoldPriceResult(), productId, MatchSources.Manual, ct, forceRefresh: true);
    }

    /// <summary>The cached product with its sales, refreshing it from Reverb when stale.</summary>
    public async Task<(ProductPrice? Product, bool Stale, bool Failed)> GetProductAsync(string productId, CancellationToken ct = default, bool forceRefresh = false)
    {
        var cached = await _mongo.GetProductPriceAsync(productId, ct);
        if (cached != null && !forceRefresh && DateTime.UtcNow - cached.FetchedAt < _cacheAge)
            return (cached, false, false);

        var csp = await _reverb.GetCspAsync(productId, ct);
        if (csp == null)
            return cached != null ? (cached, true, false) : (null, false, true);

        var now = DateTime.UtcNow;
        var cpIds = csp.CanonicalProductIds;
        var sales = await _soldHistory.FetchSalesAsync(cpIds, now.AddMonths(-SoldPriceMath.WindowsMonths[^1]), ct);
        if (sales == null)
            return cached != null ? (cached, true, false) : (null, false, true);

        var stats = SoldPriceMath.Compute(sales, now);
        var brand = csp.Brand?.Name;
        var product = new ProductPrice
        {
            ProductId = productId,
            Title = csp.Title,
            Brand = brand,
            Slug = csp.Slug,
            WebUrl = csp.Links?.Web?.Href ?? (string.IsNullOrEmpty(csp.Slug) ? null : $"https://reverb.com/p/{csp.Slug}"),
            CanonicalProductIds = cpIds,
            UsedLowPrice = csp.UsedLowPrice?.Amount > 0 ? csp.UsedLowPrice.Amount : null,
            NewLowPrice = csp.NewLowPrice?.Amount > 0 ? csp.NewLowPrice.Amount : null,
            Sales = sales,
            Median = stats.Median,
            WindowMonths = stats.WindowMonths,
            SaleCount = stats.SaleCount,
            Low = stats.Low,
            High = stats.High,
            IsBroad = SoldPriceMath.IsBroad(csp.Title, brand),
            FetchedAt = now,
        };

        await _mongo.UpsertProductPriceAsync(product, ct);
        return (product, false, false);
    }

    /// <summary>
    /// Writes the matched product and sold median onto a listing and decides whether it's a deal:
    /// reliable price, delivered at or under the threshold share of the median, median within
    /// budget, and (Reverb) it ships to us. Clears everything when there's no product.
    /// </summary>
    public static void Apply(ISoldPriced buy, SoldPriceResult result, bool canShip, decimal thresholdPercent, decimal budgetCap = 3500)
    {
        buy.ProductId = null;
        buy.ProductTitle = null;
        buy.ProductUrl = null;
        buy.SoldMedian = null;
        buy.SoldSaleCount = null;
        buy.SoldWindowMonths = null;
        buy.MatchSource = null;
        buy.PriceReliable = false;
        buy.UnreliableReason = null;
        buy.PriceGuideLow = null;
        buy.PriceGuideHigh = null;
        buy.DiscountPercent = null;
        buy.IsDeal = false;
        buy.HasPriceGuide = false;

        var product = result.Product;
        if (product == null) return;

        buy.ProductId = product.ProductId;
        buy.ProductTitle = product.Title;
        buy.ProductUrl = product.WebUrl;
        buy.MatchSource = result.MatchSource;
        buy.PriceGuideLow = product.UsedLowPrice;
        buy.PriceGuideHigh = product.NewLowPrice;
        buy.SoldSaleCount = product.SaleCount;
        buy.SoldWindowMonths = product.WindowMonths;
        buy.SoldMedian = product.Median;

        if (product.Median is not { } median || median <= 0)
        {
            buy.UnreliableReason = UnreliableReasons.FewSales;
            return;
        }

        var delivered = buy.TotalPrice ?? buy.Price;
        buy.DiscountPercent = Math.Round((median - delivered) / median * 100, 1);

        buy.UnreliableReason =
            result.MatchSource == MatchSources.TextSearch && !result.StrongTextMatch ? UnreliableReasons.TextMatch :
            product.SaleCount < SoldPriceMath.MinSales ? UnreliableReasons.FewSales :
            // A broad product the admin confirmed by hand is their call
            product.IsBroad && result.MatchSource != MatchSources.Manual ? UnreliableReasons.BroadProduct :
            result.Stale ? UnreliableReasons.Stale :
            null;

        buy.PriceReliable = buy.UnreliableReason == null;
        buy.HasPriceGuide = buy.PriceReliable;
        buy.IsDeal = buy.PriceReliable
            && delivered <= median * thresholdPercent / 100m
            && median <= budgetCap
            && canShip;
    }

    private async Task<(List<CspResponse> Results, bool Failed)> SearchCachedAsync(string query, CancellationToken ct)
    {
        if (_searchCache.TryGetValue(query, out var cached) && DateTime.UtcNow - cached.At < _cacheAge)
            return (cached.Results, false);

        var (results, failed) = await _reverb.SearchCspsAsync(query, ct);
        if (!failed) _searchCache[query] = (results, DateTime.UtcNow);
        return (results, failed);
    }

    private static bool NamesProduct(SoldPriceQuery query, ProductPrice product) =>
        ProductMatcher.NamesProduct(query.Model, query.Year, new ProductCandidate(product.ProductId, product.Title, product.Brand), query.Make);

    private async Task<SoldPriceResult> PriceAsync(SoldPriceResult result, string productId, string matchSource, CancellationToken ct, bool forceRefresh = false)
    {
        var (product, stale, failed) = await GetProductAsync(productId, ct, forceRefresh);
        result.Product = product;
        result.MatchSource = product != null ? matchSource : null;
        result.Stale = stale;
        result.LookupError = failed;
        return result;
    }

    /// <summary>
    /// Remembers make + model text -> product from a listing's own link. Text that has been
    /// linked to two different products is marked ambiguous and never used to match.
    /// </summary>
    private async Task LearnAliasAsync(string key, ProductOverride? existing, string productId, CancellationToken ct)
    {
        if (existing?.Source == ProductOverrideSources.Manual) return;
        if (existing is { Ambiguous: true }) return;
        if (existing != null && existing.ProductId == productId) return;

        await _mongo.UpsertProductOverrideAsync(new ProductOverride
        {
            Key = key,
            ProductId = existing?.ProductId ?? productId,
            Source = ProductOverrideSources.Learned,
            Ambiguous = existing != null,
        }, ct);
    }

    private async Task<(ProductCandidate? Candidate, bool Strong, bool Failed)> SearchAsync(SoldPriceQuery query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.Make)) return (null, false, false);

        var listingText = $"{query.Model} {query.Title}";
        // The seller's model field is the cleanest text to hold the product name against
        var strongText = ProductMatcher.Clean(query.Model, query.Make).Length > 0 ? query.Model : query.Title ?? "";
        var anyFailed = false;

        foreach (var q in ProductMatcher.BuildQueries(query.Make, query.Model, query.Title))
        {
            var (results, failed) = await SearchCachedAsync(q, ct);
            anyFailed |= failed;
            if (results.Count == 0) continue;

            var candidates = results.Select(c => new ProductCandidate(c.Id.ToString(), c.Title, c.Brand?.Name)).ToList();
            // Score against the model field first - titles add colors and extras that blur close
            // products into ties - and fall back to model + title when the model alone can't decide
            var best = (strongText == query.Model ? ProductMatcher.PickBest(query.Model, query.Year, query.Make, candidates) : null)
                ?? ProductMatcher.PickBest(listingText, query.Year, query.Make, candidates);
            _logger.LogDebug("Text search {Query}: {Count} results, picked {Title}", q, results.Count, best?.Title ?? "none");
            if (best != null)
                return (best, ProductMatcher.IsStrongMatch(strongText, query.Year, best, query.Make), false);
        }

        return (null, false, anyFailed);
    }
}
