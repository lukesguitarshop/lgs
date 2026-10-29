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

    /// <summary>Shipping to the configured buyer ZIP; null when the listing doesn't ship there.</summary>
    [BsonElement("shipping_price")]
    public decimal? ShippingPrice { get; set; }

    /// <summary>True when Reverb prices shipping by exact destination, so ShippingPrice is its estimate.</summary>
    [BsonElement("shipping_estimated")]
    public bool ShippingEstimated { get; set; }

    [BsonElement("ship_to_postal_code")]
    public string? ShipToPostalCode { get; set; }

    /// <summary>Price plus shipping - what the guitar actually costs delivered. Deals are judged on this.</summary>
    [BsonElement("total_price")]
    public decimal? TotalPrice { get; set; }

    [BsonElement("seller_name")]
    public string? SellerName { get; set; }

    [BsonElement("seller_slug")]
    public string? SellerSlug { get; set; }

    [BsonElement("seller_feedback_count")]
    public int? SellerFeedbackCount { get; set; }

    /// <summary>Share of positive feedback, 0 to 1.</summary>
    [BsonElement("seller_rating")]
    public decimal? SellerRating { get; set; }

    [BsonElement("seller_location")]
    public string? SellerLocation { get; set; }

    [BsonElement("seller_preferred")]
    public bool SellerPreferred { get; set; }

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

    /// <summary>When a quick check first saw Reverb mark the listing sold (ended/removed never counts).</summary>
    [BsonElement("sold_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? SoldAt { get; set; }

    /// <summary>Found new and sold within the missed-deal window - someone else got it first.</summary>
    [BsonElement("missed_deal")]
    public bool MissedDeal { get; set; }

    /// <summary>Whether it was in the Deals list (priced deal or no price data) when it sold.</summary>
    [BsonElement("was_in_deals")]
    public bool WasInDeals { get; set; }
}

public class PotentialBuyStats
{
    public int Total { get; set; }
    public int Deals { get; set; }
    public DateTime? LastRunAt { get; set; }
    public int MissedLast7Days { get; set; }
    public int MissedLast30Days { get; set; }
    public int MissedInDealsLast30Days { get; set; }
}
