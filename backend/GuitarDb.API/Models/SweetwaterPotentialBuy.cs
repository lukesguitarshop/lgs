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

    [BsonElement("shipping_price")]
    public decimal? ShippingPrice { get; set; }

    /// <summary>Price plus shipping; null when Sweetwater doesn't state a shipping amount.</summary>
    [BsonElement("total_price")]
    public decimal? TotalPrice { get; set; }

    [BsonElement("listing_created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ListingCreatedAt { get; set; }

    [BsonElement("seller_user_id")]
    public long? SellerUserId { get; set; }

    [BsonElement("seller_name")]
    public string? SellerName { get; set; }

    [BsonElement("seller_slug")]
    public string? SellerSlug { get; set; }

    [BsonElement("seller_location")]
    public string? SellerLocation { get; set; }

    /// <summary>Listings the seller has up across Gear Exchange - Sweetwater hides review
    /// counts behind bot protection, so this is what tells a shop from a private seller.</summary>
    [BsonElement("seller_listing_count")]
    public int? SellerListingCount { get; set; }

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
    public int NoPriceGuide { get; set; }
    public DateTime? LastRunAt { get; set; }
}
