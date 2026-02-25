using System.Text.Json;
using System.Text.Json.Serialization;

namespace GuitarDb.Scraper.Models.Reverb;

public class ReverbListing
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("make")]
    public string Make { get; set; } = string.Empty;

    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("year")]
    public string? Year { get; set; }

    [JsonPropertyName("condition")]
    public ReverbCondition Condition { get; set; } = new();

    [JsonPropertyName("price")]
    public ReverbPrice Price { get; set; } = new();

    [JsonPropertyName("state")]
    public ReverbState State { get; set; } = new();

    [JsonPropertyName("categories")]
    public List<ReverbCategory> Categories { get; set; } = new();

    [JsonPropertyName("photos")]
    public List<ReverbPhoto> Photos { get; set; } = new();

    [JsonPropertyName("_links")]
    public ReverbListingLinks? Links { get; set; }

    [JsonPropertyName("shipping")]
    public ReverbShipping? Shipping { get; set; }

    [JsonPropertyName("price_guide_id")]
    public string? PriceGuideId { get; set; }

    [JsonPropertyName("comparison_shopping_page_id")]
    public string? ComparisonShoppingPageId { get; set; }

    [JsonPropertyName("finish")]
    public string? Finish { get; set; }

    [JsonIgnore]
    public int? ParsedYear => int.TryParse(Year, out var y) ? y : null;

    [JsonIgnore]
    public string? ListingUrl => Links?.Web?.Href;

    [JsonIgnore]
    public List<string> AllImageUrls => Photos
        .Select(p => p.Links?.Large?.Href ?? p.Links?.Small?.Href)
        .Where(url => !string.IsNullOrEmpty(url))
        .Cast<string>()
        .ToList();

    [JsonIgnore]
    public bool IsLocalPickupOnly =>
        Shipping?.Local == true &&
        (Shipping.Rates == null || Shipping.Rates.Count == 0) &&
        (Shipping.UsRate == null || Shipping.UsRate.Amount == 0);
}

public class ReverbListingLinks
{
    [JsonPropertyName("self")]
    public ReverbLink? Self { get; set; }

    [JsonPropertyName("web")]
    public ReverbLink? Web { get; set; }
}

public class ReverbShipping
{
    [JsonPropertyName("local")]
    public bool Local { get; set; }

    [JsonPropertyName("rates")]
    public List<ReverbShippingRate>? Rates { get; set; }

    [JsonPropertyName("us_rate")]
    public ReverbPrice? UsRate { get; set; }
}

public class ReverbShippingRate
{
    [JsonPropertyName("region_code")]
    public string RegionCode { get; set; } = string.Empty;

    [JsonPropertyName("rate")]
    public ReverbPrice? Rate { get; set; }
}

public class ReverbCondition
{
    [JsonPropertyName("display_name")]
    public string DisplayName { get; set; } = string.Empty;
}

public class ReverbState
{
    [JsonPropertyName("slug")]
    public string Slug { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class ReverbPrice
{
    [JsonPropertyName("amount")]
    [JsonConverter(typeof(StringToDecimalConverter))]
    public decimal Amount { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "USD";
}

public class ReverbCategory
{
    [JsonPropertyName("full_name")]
    public string FullName { get; set; } = string.Empty;
}

public class ReverbPhoto
{
    [JsonPropertyName("_links")]
    public ReverbPhotoLinks? Links { get; set; }
}

public class ReverbPhotoLinks
{
    [JsonPropertyName("large_crop")]
    public ReverbPhotoLink? Large { get; set; }

    [JsonPropertyName("small_crop")]
    public ReverbPhotoLink? Small { get; set; }
}

public class ReverbPhotoLink
{
    [JsonPropertyName("href")]
    public string Href { get; set; } = string.Empty;
}

public class StringToDecimalConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            var stringValue = reader.GetString();
            if (decimal.TryParse(stringValue, out var result))
            {
                return result;
            }
        }
        else if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetDecimal();
        }

        return 0;
    }

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options)
    {
        writer.WriteNumberValue(value);
    }
}
