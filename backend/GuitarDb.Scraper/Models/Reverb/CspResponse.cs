using System.Text.Json.Serialization;

namespace GuitarDb.Scraper.Models.Reverb;

public class CspSearchResponse
{
    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("comparison_shopping_pages")]
    public List<CspResponse> ComparisonShoppingPages { get; set; } = new();
}

public class CspResponse
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("slug")]
    public string Slug { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("brand")]
    public CspBrand? Brand { get; set; }

    [JsonPropertyName("used_low_price")]
    public ReverbPrice? UsedLowPrice { get; set; }

    [JsonPropertyName("new_low_price")]
    public ReverbPrice? NewLowPrice { get; set; }
}

public class CspBrand
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Result of resolving a listing to Reverb market price data via the CSP
/// (Comparison Shopping Page) API. Replaces the retired /priceguide endpoint:
/// UsedLowPrice is the lowest current used asking price for the model, not a
/// transaction-based estimate range.
/// </summary>
public class CspPriceResult
{
    public string? CspId { get; set; }
    public string? CspTitle { get; set; }
    public decimal? UsedLowPrice { get; set; }
    public decimal? NewLowPrice { get; set; }
    public PriceGuideMatchType MatchType { get; set; } = PriceGuideMatchType.Fallback;

    /// <summary>True when the lookup failed (HTTP error), as opposed to legitimately finding no match.</summary>
    public bool LookupError { get; set; }

    public bool HasPrice => UsedLowPrice > 0;

    public bool IsReliable => MatchType != PriceGuideMatchType.YearOnly &&
                              MatchType != PriceGuideMatchType.Fallback;
}
