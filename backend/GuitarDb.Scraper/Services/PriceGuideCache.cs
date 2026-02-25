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
    private readonly Dictionary<string, CachedPriceGuideResult> _resultCache = new();

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

    public async Task<PriceGuideResult> SearchAsync(
        string make,
        string model,
        string? finish,
        string? cspId,
        int? year = null,
        CancellationToken ct = default)
    {
        // Create cache key from make/model/cspId/year
        var cacheKey = $"search:{make}:{model}:{cspId ?? "none"}:{year?.ToString() ?? "none"}";

        if (_resultCache.TryGetValue(cacheKey, out var cached))
        {
            if (cached.ExpiresAt > DateTime.UtcNow)
            {
                _logger.LogDebug("Price guide search cached for {Make} {Model} {Year}", make, model, year);
                return cached.Data;
            }
            _resultCache.Remove(cacheKey);
        }

        _logger.LogDebug("Searching price guide for {Make} {Model} {Year}", make, model, year);
        var result = await _apiClient.SearchPriceGuideAsync(make, model, finish, cspId, year, ct);

        _resultCache[cacheKey] = new CachedPriceGuideResult
        {
            Data = result,
            ExpiresAt = DateTime.UtcNow.AddMinutes(_cacheMinutes)
        };

        return result;
    }

    public int CacheSize => _cache.Count + _resultCache.Count;

    private class CachedPriceGuide
    {
        public PriceGuideResponse Data { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }

    private class CachedPriceGuideResult
    {
        public PriceGuideResult Data { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}
