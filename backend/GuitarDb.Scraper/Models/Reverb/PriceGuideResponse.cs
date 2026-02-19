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
