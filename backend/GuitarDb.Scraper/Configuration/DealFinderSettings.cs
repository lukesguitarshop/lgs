namespace GuitarDb.Scraper.Configuration;

public class DealFinderSettings
{
    public SearchFilters SearchFilters { get; set; } = new();
    public decimal DealThresholdPercent { get; set; } = 10;
    public int PriceGuideCacheMinutes { get; set; } = 1440;
    public CleanupSettings Cleanup { get; set; } = new();
}

public class CleanupSettings
{
    /// <summary>
    /// Whether to automatically remove listings no longer on Reverb after each scrape.
    /// </summary>
    public bool RemoveStaleListings { get; set; } = true;

    /// <summary>
    /// Days to keep dismissed/purchased records before auto-deleting (0 = keep forever).
    /// </summary>
    public int KeepResolvedDays { get; set; } = 30;
}

public class SearchFilters
{
    public List<string> Makes { get; set; } = new();
    public decimal PriceMax { get; set; } = 3500;
    public bool AcceptsOffers { get; set; } = true;
    public int PerPage { get; set; } = 50;
    public int MaxListings { get; set; } = 500;
    public string Category { get; set; } = "solid-body";
    public string ProductType { get; set; } = "electric-guitars";
    public string? ShipFromCountryCode { get; set; } = "US";
}
