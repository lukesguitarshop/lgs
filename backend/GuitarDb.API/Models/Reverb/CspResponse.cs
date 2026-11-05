using System.Text.Json.Serialization;

namespace GuitarDb.API.Models.Reverb;

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

    [JsonPropertyName("_links")]
    public CspLinks? Links { get; set; }

    /// <summary>
    /// Reverb's catalog variant IDs, read from the cp_ids[] in the product's listings link -
    /// what the sold-history query takes.
    /// </summary>
    [JsonIgnore]
    public List<string> CanonicalProductIds
    {
        get
        {
            var href = Links?.Listings?.Href;
            if (string.IsNullOrEmpty(href)) return new List<string>();
            return System.Text.RegularExpressions.Regex
                .Matches(Uri.UnescapeDataString(href), @"cp_ids\[\]=(\d+)")
                .Select(m => m.Groups[1].Value)
                .Distinct()
                .ToList();
        }
    }
}

public class CspLinks
{
    [JsonPropertyName("web")]
    public ReverbLink? Web { get; set; }

    [JsonPropertyName("listings")]
    public ReverbLink? Listings { get; set; }
}

public class CspBrand
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
