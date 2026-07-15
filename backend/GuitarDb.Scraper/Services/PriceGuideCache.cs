using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Reverb;
using Microsoft.Extensions.Logging;

namespace GuitarDb.Scraper.Services;

public class PriceGuideCache
{
    private readonly ReverbApiClient _apiClient;
    private readonly ILogger<PriceGuideCache> _logger;
    private readonly int _cacheMinutes;
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

    public async Task<CspPriceResult> SearchAsync(
        string make,
        string model,
        CancellationToken ct = default)
    {
        var cacheKey = $"csp:{make.ToLowerInvariant()}:{model.ToLowerInvariant()}";

        if (_resultCache.TryGetValue(cacheKey, out var cached))
        {
            if (cached.ExpiresAt > DateTime.UtcNow)
            {
                _logger.LogDebug("CSP price search cached for {Make} {Model}", make, model);
                return cached.Data;
            }
            _resultCache.Remove(cacheKey);
        }

        _logger.LogDebug("Searching CSP prices for {Make} {Model}", make, model);
        var result = await _apiClient.SearchCspPriceAsync(make, model, ct);

        // Don't cache transient HTTP failures; do cache legitimate "no match" results
        if (!result.LookupError)
        {
            _resultCache[cacheKey] = new CachedPriceGuideResult
            {
                Data = result,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_cacheMinutes)
            };
        }

        return result;
    }

    public int CacheSize => _resultCache.Count;

    private class CachedPriceGuideResult
    {
        public CspPriceResult Data { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}
