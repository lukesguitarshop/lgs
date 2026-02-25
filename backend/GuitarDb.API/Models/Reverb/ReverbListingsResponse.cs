using System.Text.Json.Serialization;

namespace GuitarDb.API.Models.Reverb;

public class ReverbListingsResponse
{
    [JsonPropertyName("listings")]
    public List<ReverbListing> Listings { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("_links")]
    public ReverbPagination Links { get; set; } = new();
}

public class ReverbPagination
{
    [JsonPropertyName("next")]
    public ReverbLink? Next { get; set; }
}

public class ReverbLink
{
    [JsonPropertyName("href")]
    public string Href { get; set; } = string.Empty;
}
