using System.Text.Json;
using System.Text.Json.Serialization;

namespace GuitarDb.API.Models.Reverb;

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

    [JsonPropertyName("published_at")]
    public DateTime? PublishedAt { get; set; }

    [JsonPropertyName("price_guide_id")]
    public string? PriceGuideId { get; set; }

    [JsonPropertyName("comparison_shopping_page_id")]
    public string? ComparisonShoppingPageId { get; set; }

    [JsonPropertyName("finish")]
    public string? Finish { get; set; }

    [JsonPropertyName("offers_enabled")]
    public bool OffersEnabled { get; set; }

    [JsonPropertyName("shop_name")]
    public string? ShopName { get; set; }

    [JsonPropertyName("shop")]
    public ReverbListingShop? Shop { get; set; }

    [JsonIgnore]
    public int? ParsedYear => int.TryParse(Year, out var y) ? y : null;

    [JsonIgnore]
    public string? ListingUrl => Links?.Web?.Href;

    [JsonIgnore]
    public List<string> AllImageUrls => Photos
        .Select(p => p.Links?.Full?.Href ?? p.Links?.Large?.Href ?? p.Links?.Small?.Href)
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

    [JsonPropertyName("free_expedited_shipping")]
    public bool FreeExpeditedShipping { get; set; }

    /// <summary>
    /// Shipping cost to a buyer in the given Reverb region, or null when the listing
    /// doesn't ship there. Falls back from the exact region to "US" and then to "XX"
    /// (everywhere else), the way Reverb picks a rate at checkout. Estimated is true
    /// when Reverb needs the buyer's postal code for an exact rate (carrier-calculated
    /// or regional pricing), so the amount is Reverb's own estimate.
    /// </summary>
    public (decimal Cost, bool Estimated)? CostTo(string regionCode)
    {
        if (FreeExpeditedShipping)
            return (0, false);

        var rate = new[] { regionCode, "US", "XX" }
            .Select(code => Rates?.FirstOrDefault(r => r.RegionCode.Equals(code, StringComparison.OrdinalIgnoreCase) && r.Rate != null))
            .FirstOrDefault(r => r != null);

        if (rate != null)
            return (rate.Rate!.Amount, rate.DestinationPostalCodeNeeded || rate.CarrierCalculated);

        if (UsRate != null && regionCode.StartsWith("US", StringComparison.OrdinalIgnoreCase))
            return (UsRate.Amount, false);

        return null;
    }
}

public class ReverbShippingRate
{
    [JsonPropertyName("region_code")]
    public string RegionCode { get; set; } = string.Empty;

    [JsonPropertyName("rate")]
    public ReverbPrice? Rate { get; set; }

    [JsonPropertyName("carrier_calculated")]
    public bool CarrierCalculated { get; set; }

    [JsonPropertyName("regional")]
    public bool Regional { get; set; }

    [JsonPropertyName("destination_postal_code_needed")]
    public bool DestinationPostalCodeNeeded { get; set; }
}

public class ReverbListingShop
{
    [JsonPropertyName("slug")]
    public string? Slug { get; set; }

    [JsonPropertyName("preferred_seller")]
    public bool PreferredSeller { get; set; }
}

/// <summary>A Reverb shop as returned by /shops/{slug} - only the seller-reputation fields.</summary>
public class ReverbShop
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("slug")]
    public string Slug { get; set; } = string.Empty;

    [JsonPropertyName("preferred_seller")]
    public bool PreferredSeller { get; set; }

    [JsonPropertyName("feedback_count")]
    public int FeedbackCount { get; set; }

    /// <summary>Share of positive feedback, 0 to 1 (Reverb's name says percentage, the value is a fraction).</summary>
    [JsonPropertyName("rating_percentage")]
    public decimal? RatingPercentage { get; set; }

    [JsonPropertyName("address")]
    public ReverbShopAddress? Address { get; set; }
}

public class ReverbShopAddress
{
    [JsonPropertyName("display_location")]
    public string? DisplayLocation { get; set; }
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
    [JsonPropertyName("full")]
    public ReverbPhotoLink? Full { get; set; }

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
