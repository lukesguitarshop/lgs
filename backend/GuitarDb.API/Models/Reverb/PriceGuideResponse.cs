using System.Text.Json.Serialization;

namespace GuitarDb.API.Models.Reverb;

public class PriceGuideSearchResponse
{
    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("price_guides")]
    public List<PriceGuideResponse> PriceGuides { get; set; } = new();
}

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

    [JsonPropertyName("finish")]
    public string? Finish { get; set; }

    [JsonPropertyName("comparison_shopping_page_id")]
    public string? ComparisonShoppingPageId { get; set; }

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

public enum PriceGuideMatchType
{
    CspAndYear,    // Most reliable - CSP ID + year match
    Csp,           // Very reliable - CSP ID match
    ModelAndYear,  // Reliable - model name + year match
    Model,         // Moderate - model name match only
    YearOnly,      // Low confidence - only year matched, model may be wrong
    Fallback       // Unreliable - first result, likely wrong
}

public class PriceGuideResult
{
    public PriceGuideResponse? PriceGuide { get; set; }
    public PriceGuideMatchType MatchType { get; set; }

    public bool IsReliable => MatchType != PriceGuideMatchType.YearOnly &&
                              MatchType != PriceGuideMatchType.Fallback;
}
