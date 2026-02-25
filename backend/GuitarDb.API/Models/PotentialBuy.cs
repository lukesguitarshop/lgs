using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class PotentialBuy
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("listing_title")]
    public string ListingTitle { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("images")]
    public List<string> Images { get; set; } = new();

    [BsonElement("reverb_link")]
    public string? ReverbLink { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("reverb_listing_id")]
    public long ReverbListingId { get; set; }

    [BsonElement("price_guide_id")]
    public string? PriceGuideId { get; set; }

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

    [BsonElement("listing_created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ListingCreatedAt { get; set; }

    [BsonElement("dismissed")]
    public bool Dismissed { get; set; } = false;

    [BsonElement("purchased")]
    public bool Purchased { get; set; } = false;
}

public class PotentialBuyStats
{
    public int Total { get; set; }
    public int Deals { get; set; }
    public DateTime? LastRunAt { get; set; }
}
