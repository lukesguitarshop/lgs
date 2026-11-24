using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// A percent-off code typed at checkout. The code string is stored normalized
/// (trimmed, upper case) and is unique.
/// </summary>
public class DiscountCode
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("percent_off")]
    public decimal PercentOff { get; set; }

    [BsonElement("starts_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime StartsAt { get; set; } = DateTime.UtcNow;

    [BsonElement("expires_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("active")]
    public bool Active { get; set; } = true;

    /// <summary>Total redemptions allowed across all accounts. Null means no cap.</summary>
    [BsonElement("max_uses")]
    [BsonIgnoreIfNull]
    public int? MaxUses { get; set; }

    /// <summary>Redemptions allowed per account. Null means no cap.</summary>
    [BsonElement("max_uses_per_user")]
    [BsonIgnoreIfNull]
    public int? MaxUsesPerUser { get; set; } = 1;

    [BsonElement("used_count")]
    public int UsedCount { get; set; }

    /// <summary>Where the code came from: "newsletter" or "manual".</summary>
    [BsonElement("source")]
    public string Source { get; set; } = DiscountCodeSource.Manual;

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class DiscountCodeSource
{
    public const string Manual = "manual";
    public const string Newsletter = "newsletter";
}

/// <summary>
/// One use of a code on one order. Written when the order is, and is what the
/// per-account limit counts.
/// </summary>
public class DiscountRedemption
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("order_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string OrderId { get; set; } = string.Empty;

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
