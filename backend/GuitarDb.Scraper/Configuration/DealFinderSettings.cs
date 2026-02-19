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
