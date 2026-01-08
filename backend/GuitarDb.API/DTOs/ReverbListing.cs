using System.Text.Json.Serialization;

namespace GuitarDb.API.DTOs;

public class ReverbListingResponse
{
    [JsonPropertyName("listings")]
    public List<ReverbListing>? Listings { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("_links")]
    public ReverbLinks? Links { get; set; }
}

public class ReverbListing
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("make")]
    public string? Make { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    [JsonPropertyName("year")]
    public string? Year { get; set; }

    [JsonPropertyName("finish")]
    public string? Finish { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("condition")]
    public ReverbCondition? Condition { get; set; }

    [JsonPropertyName("price")]
    public ReverbPrice? Price { get; set; }

    [JsonPropertyName("photos")]
    public List<ReverbPhoto>? Photos { get; set; }

    [JsonPropertyName("state")]
    public ReverbState? State { get; set; }

    [JsonPropertyName("published_at")]
    public DateTime? PublishedAt { get; set; }

    [JsonPropertyName("_links")]
    public ReverbListingLinks? Links { get; set; }

    [JsonPropertyName("categories")]
    public List<ReverbCategory>? Categories { get; set; }
}

public class ReverbCondition
{
    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("display_name")]
    public string? DisplayName { get; set; }
}

public class ReverbPrice
{
    [JsonPropertyName("amount")]
    public string? Amount { get; set; }

    [JsonPropertyName("currency")]
    public string? Currency { get; set; }

    [JsonPropertyName("symbol")]
    public string? Symbol { get; set; }
}

public class ReverbPhoto
{
    [JsonPropertyName("_links")]
    public ReverbPhotoLinks? Links { get; set; }
}

public class ReverbPhotoLinks
{
    [JsonPropertyName("large")]
    public ReverbLink? Large { get; set; }

    [JsonPropertyName("small")]
    public ReverbLink? Small { get; set; }
}

public class ReverbState
{
    [JsonPropertyName("slug")]
    public string? Slug { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

public class ReverbLinks
{
    [JsonPropertyName("next")]
    public ReverbLink? Next { get; set; }

    [JsonPropertyName("prev")]
    public ReverbLink? Prev { get; set; }
}

public class ReverbListingLinks
{
    [JsonPropertyName("web")]
    public ReverbLink? Web { get; set; }
}

public class ReverbLink
{
    [JsonPropertyName("href")]
    public string? Href { get; set; }
}

public class ReverbCategory
{
    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }
}
