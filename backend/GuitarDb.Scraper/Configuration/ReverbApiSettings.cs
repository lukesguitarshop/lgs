namespace GuitarDb.Scraper.Configuration;

public class ReverbApiSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.reverb.com/api";
    public string ShopSlug { get; set; } = "lukes-gear-depot-472";
    public int PageSize { get; set; } = 50;
    public int RateLimitDelayMs { get; set; } = 500;
}
