using System.Text.RegularExpressions;
using AngleSharp.Html.Parser;
using GuitarDb.API.Models;
using Microsoft.Extensions.Configuration;

namespace GuitarDb.API.Services;

public class SweetwaterScraperClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SweetwaterScraperClient> _logger;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private static readonly Regex YearRegex = new(@"\b(19[5-9]\d|20[0-2]\d)\b", RegexOptions.Compiled);

    public SweetwaterScraperClient(
        HttpClient httpClient,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        ILogger<SweetwaterScraperClient> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        _httpClient.DefaultRequestHeaders.Add("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Add("Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        _httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.5");
    }

    public async Task<List<SweetwaterListing>> FetchListingsAsync(
        List<string> makes,
        decimal priceMax,
        int maxListings,
        CancellationToken cancellationToken = default)
    {
        var allListings = new List<SweetwaterListing>();
        var page = 1;
        var baseUrl = "https://www.sweetwater.com/used/gear/electric-guitars";
        var rateLimitMs = _configuration.GetValue<int>("DealFinder:SweetwaterRateLimitMs", 500);

        _logger.LogInformation("Fetching up to {Max} Sweetwater listings...", maxListings);

        while (allListings.Count < maxListings)
        {
            try
            {
                var url = $"{baseUrl}?page={page}&radius=all";
                _logger.LogInformation("Fetching Sweetwater page {Page}: {Url}", page, url);

                var response = await _httpClient.GetAsync(url, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Sweetwater returned {StatusCode} for page {Page}", response.StatusCode, page);
                    break;
                }

                var html = await response.Content.ReadAsStringAsync(cancellationToken);
                var listings = ParseListingsFromHtml(html, makes, priceMax);

                if (listings.Count == 0)
                {
                    _logger.LogInformation("No more listings on page {Page}", page);
                    break;
                }

                allListings.AddRange(listings);
                _logger.LogInformation("Page {Page}: {Count} matching listings (total: {Total})",
                    page, listings.Count, allListings.Count);

                if (allListings.Count >= maxListings)
                {
                    allListings = allListings.Take(maxListings).ToList();
                    break;
                }

                page++;
                await Task.Delay(rateLimitMs, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Failed to fetch Sweetwater page {Page}", page);
                break;
            }
        }

        _logger.LogInformation("Fetched {Count} total Sweetwater listings", allListings.Count);
        return allListings;
    }

    private List<SweetwaterListing> ParseListingsFromHtml(string html, List<string> makes, decimal priceMax)
    {
        var listings = new List<SweetwaterListing>();

        var parser = new HtmlParser();
        var document = parser.ParseDocument(html);

        // Find all listing card links - they link to /used/listings/{id}-{slug}
        var listingLinks = document.QuerySelectorAll("a[href*='/used/listings/']");

        foreach (var link in listingLinks)
        {
            try
            {
                var href = link.GetAttribute("href") ?? "";
                if (string.IsNullOrEmpty(href) || !href.Contains("/used/listings/"))
                    continue;

                // Extract listing ID from URL path like /used/listings/432926-used-gibson-...
                var pathSegment = href.Split("/used/listings/").LastOrDefault() ?? "";
                var idStr = pathSegment.Split('-').FirstOrDefault();
                if (!long.TryParse(idStr, out var listingId))
                    continue;

                // Extract title from heading inside the link
                var heading = link.QuerySelector("h2, h3, [class*='heading']");
                var title = heading?.TextContent?.Trim() ?? link.TextContent?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(title) || !title.StartsWith("Used ", StringComparison.OrdinalIgnoreCase))
                    continue;

                // Parse make from title - check against configured makes
                var titleWithoutUsed = title.Substring(5); // Remove "Used "
                var make = makes.FirstOrDefault(m =>
                    titleWithoutUsed.StartsWith(m, StringComparison.OrdinalIgnoreCase));

                if (make == null)
                    continue; // Not a brand we're looking for

                // Parse price - look for price elements inside the card
                var priceText = ExtractPrice(link);
                if (priceText == null || !decimal.TryParse(priceText, out var price))
                    continue;

                if (price > priceMax)
                    continue;

                // Parse original price (was price)
                decimal? originalPrice = null;
                var wasPriceText = ExtractOriginalPrice(link);
                if (wasPriceText != null && decimal.TryParse(wasPriceText, out var origPrice))
                    originalPrice = origPrice;

                // Parse condition
                var condition = ExtractTextContaining(link, "Condition");

                // Parse shipping
                var shipping = ExtractShipping(link);

                // Parse image
                var img = link.QuerySelector("img");
                var imageUrl = img?.GetAttribute("src") ?? img?.GetAttribute("data-src");

                // Parse model from title
                var (model, finish) = ParseModelAndFinish(titleWithoutUsed, make);

                // Parse year from title
                int? year = null;
                var yearMatch = YearRegex.Match(title);
                if (yearMatch.Success && int.TryParse(yearMatch.Value, out var parsedYear))
                    year = parsedYear;

                var listing = new SweetwaterListing
                {
                    ListingId = listingId,
                    Title = title,
                    Price = price,
                    OriginalPrice = originalPrice,
                    Condition = condition,
                    ImageUrl = imageUrl,
                    ListingUrl = href.StartsWith("http")
                        ? href
                        : $"https://www.sweetwater.com{href}",
                    Shipping = shipping,
                    Make = make,
                    Model = model,
                    Finish = finish,
                    Year = year
                };

                // Deduplicate by listing ID
                if (!listings.Any(l => l.ListingId == listing.ListingId))
                    listings.Add(listing);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to parse a listing card");
            }
        }

        return listings;
    }

    private static string? ExtractPrice(AngleSharp.Dom.IElement link)
    {
        // The price structure has dollar amounts split across elements
        // Look for text that contains a price pattern
        var allText = link.TextContent ?? "";

        // Find price patterns like $1,200.00 or 1,200.00
        var priceMatch = Regex.Match(allText, @"\$?([\d,]+\.\d{2})");
        if (priceMatch.Success)
        {
            // If there's a "Was" price, we need the second price (current price)
            var matches = Regex.Matches(allText, @"\$?([\d,]+\.\d{2})");
            if (matches.Count >= 2 && allText.Contains("Was", StringComparison.OrdinalIgnoreCase))
            {
                // Second price is the current (sale) price
                return matches[1].Groups[1].Value.Replace(",", "");
            }
            return matches[0].Groups[1].Value.Replace(",", "");
        }

        return null;
    }

    private static string? ExtractOriginalPrice(AngleSharp.Dom.IElement link)
    {
        var allText = link.TextContent ?? "";
        if (!allText.Contains("Was", StringComparison.OrdinalIgnoreCase))
            return null;

        var matches = Regex.Matches(allText, @"\$?([\d,]+\.\d{2})");
        if (matches.Count >= 2)
        {
            // First price is the "Was" (original) price
            return matches[0].Groups[1].Value.Replace(",", "");
        }

        return null;
    }

    private static string? ExtractTextContaining(AngleSharp.Dom.IElement parent, string keyword)
    {
        var allText = parent.TextContent ?? "";
        // Look for condition strings
        var conditions = new[] { "Mint Condition", "Excellent Condition", "Good Condition", "Fair Condition" };
        foreach (var cond in conditions)
        {
            if (allText.Contains(cond, StringComparison.OrdinalIgnoreCase))
                return cond.Replace(" Condition", "");
        }
        return null;
    }

    private static string? ExtractShipping(AngleSharp.Dom.IElement parent)
    {
        var allText = parent.TextContent ?? "";
        if (allText.Contains("Free Shipping", StringComparison.OrdinalIgnoreCase))
            return "Free Shipping";

        var shippingMatch = Regex.Match(allText, @"\+\$?([\d,.]+)\s*Shipping", RegexOptions.IgnoreCase);
        if (shippingMatch.Success)
            return $"+${shippingMatch.Groups[1].Value} Shipping";

        return null;
    }

    private static (string Model, string? Finish) ParseModelAndFinish(string titleAfterUsed, string make)
    {
        // Title format: "{Make} {Model} {details} - {Finish}"
        // e.g. "Gibson Les Paul Standard '50s Plain Top Electric Guitar - Inverness Green"
        var afterMake = titleAfterUsed.Substring(make.Length).Trim();

        // Split on " - " to separate model from finish/color
        var parts = afterMake.Split(new[] { " - " }, 2, StringSplitOptions.TrimEntries);
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
                model = model.Substring(0, model.Length - suffix.Length).Trim();
                break;
            }
        }

        return (model, finish);
    }
}
