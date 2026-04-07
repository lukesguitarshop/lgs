using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class SweetwaterPotentialBuy
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("listing_title")]
    public string ListingTitle { get; set; } = string.Empty;

    [BsonElement("images")]
    public List<string> Images { get; set; } = new();

    [BsonElement("sweetwater_link")]
    public string? SweetwaterLink { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("original_price")]
    public decimal? OriginalPrice { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("sweetwater_listing_id")]
    public long SweetwaterListingId { get; set; }

    [BsonElement("shipping")]
    public string? Shipping { get; set; }

    [BsonElement("price_guide_low")]
    public decimal? PriceGuideLow { get; set; }

    [BsonElement("price_guide_high")]
    public decimal? PriceGuideHigh { get; set; }

    [BsonElement("discount_percent")]
    public decimal? DiscountPercent { get; set; }

    [BsonElement("is_deal")]
    public bool IsDeal { get; set; }

    [BsonElement("has_price_guide")]
    public bool HasPriceGuide { get; set; }

    [BsonElement("first_seen_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;

    [BsonElement("last_checked_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime LastCheckedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("dismissed")]
    public bool Dismissed { get; set; } = false;

    [BsonElement("purchased")]
    public bool Purchased { get; set; } = false;
}

public class SweetwaterPotentialBuyStats
{
    public int Total { get; set; }
    public int Deals { get; set; }
    public DateTime? LastRunAt { get; set; }
}
