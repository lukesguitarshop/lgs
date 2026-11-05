using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// A Reverb product (comparison shopping page) with its recent US sold transactions,
/// shared by both deal finders and the sold-history panel. Refetched once stale.
/// </summary>
public class ProductPrice
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("brand")]
    public string? Brand { get; set; }

    [BsonElement("slug")]
    public string? Slug { get; set; }

    [BsonElement("web_url")]
    public string? WebUrl { get; set; }

    /// <summary>Reverb's catalog variant IDs for the product (often one per finish) - what the sold-history query takes.</summary>
    [BsonElement("canonical_product_ids")]
    public List<string> CanonicalProductIds { get; set; } = new();

    /// <summary>Lowest current used asking price on Reverb - secondary info only.</summary>
    [BsonElement("used_low_price")]
    public decimal? UsedLowPrice { get; set; }

    [BsonElement("new_low_price")]
    public decimal? NewLowPrice { get; set; }

    /// <summary>Sales in Good to Mint condition from US sellers over the last 24 months, newest first.</summary>
    [BsonElement("sales")]
    public List<ProductSale> Sales { get; set; } = new();

    [BsonElement("median")]
    public decimal? Median { get; set; }

    [BsonElement("window_months")]
    public int WindowMonths { get; set; }

    [BsonElement("sale_count")]
    public int SaleCount { get; set; }

    [BsonElement("low")]
    public decimal? Low { get; set; }

    [BsonElement("high")]
    public decimal? High { get; set; }

    [BsonElement("is_broad")]
    public bool IsBroad { get; set; }

    [BsonElement("fetched_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
}

public class ProductSale
{
    [BsonElement("sold_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime SoldAt { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("listing_id")]
    public string? ListingId { get; set; }
}

/// <summary>
/// Maps seller-typed make + model text to a Reverb product. "manual" comes from the
/// admin pasting a product link and always wins; "learned" comes from listings that
/// carried their own product link.
/// </summary>
public class ProductOverride
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("key")]
    public string Key { get; set; } = string.Empty;

    [BsonElement("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("source")]
    public string Source { get; set; } = ProductOverrideSources.Learned;

    /// <summary>
    /// Learned only: listings with this same text linked to different products, so the text
    /// alone can't say which product it is. Never used for matching; a manual fix clears it.
    /// </summary>
    [BsonElement("ambiguous")]
    public bool Ambiguous { get; set; }

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class ProductOverrideSources
{
    public const string Manual = "manual";
    public const string Learned = "learned";
}

/// <summary>How a listing was tied to its Reverb product.</summary>
public static class MatchSources
{
    public const string Manual = "manual";
    public const string Alias = "alias";
    public const string ListingLink = "listing_link";
    public const string TextSearch = "text_search";
}

/// <summary>Why a sold median isn't trusted enough to call a deal.</summary>
public static class UnreliableReasons
{
    public const string TextMatch = "text_match";
    public const string FewSales = "few_sales";
    public const string BroadProduct = "broad_product";
    public const string Stale = "stale";
}

/// <summary>Sold-price fields shared by Reverb and Sweetwater potential buys.</summary>
public interface ISoldPriced
{
    string? Make { get; set; }
    string? Model { get; set; }
    decimal Price { get; set; }
    decimal? TotalPrice { get; set; }
    string? ProductId { get; set; }
    string? ProductTitle { get; set; }
    string? ProductUrl { get; set; }
    decimal? SoldMedian { get; set; }
    int? SoldSaleCount { get; set; }
    int? SoldWindowMonths { get; set; }
    string? MatchSource { get; set; }
    bool PriceReliable { get; set; }
    string? UnreliableReason { get; set; }
    decimal? PriceGuideLow { get; set; }
    decimal? PriceGuideHigh { get; set; }
    decimal? DiscountPercent { get; set; }
    bool IsDeal { get; set; }
    bool HasPriceGuide { get; set; }
}
