using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class TradeInRequest
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("brand")]
    public string Brand { get; set; } = string.Empty;

    [BsonElement("model")]
    public string Model { get; set; } = string.Empty;

    [BsonElement("condition")]
    public string Condition { get; set; } = string.Empty;

    [BsonElement("notes")]
    public string Notes { get; set; } = string.Empty;

    [BsonElement("photos")]
    public List<TradeInPhoto> Photos { get; set; } = new();

    [BsonElement("offers")]
    public List<TradeInOffer> Offers { get; set; } = new();

    [BsonElement("status")]
    public string Status { get; set; } = TradeInStatus.Submitted;

    [BsonElement("shipping")]
    public TradeInShipping Shipping { get; set; } = new();

    [BsonElement("payout")]
    public TradeInPayout Payout { get; set; } = new();

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class TradeInPhoto
{
    [BsonElement("url")]
    public string Url { get; set; } = string.Empty;

    [BsonElement("original_file_name")]
    public string OriginalFileName { get; set; } = string.Empty;

    [BsonElement("uploaded_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class TradeInOffer
{
    [BsonElement("cash_offer")]
    public decimal CashOffer { get; set; }

    [BsonElement("store_credit_offer")]
    public decimal StoreCreditOffer { get; set; }

    [BsonElement("expires_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("created_by_admin_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CreatedByAdminId { get; set; } = string.Empty;

    [BsonElement("accepted_type")]
    [BsonIgnoreIfNull]
    public string? AcceptedType { get; set; }

    [BsonElement("accepted_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? AcceptedAt { get; set; }

    [BsonElement("paypal_email")]
    [BsonIgnoreIfNull]
    public string? PaypalEmail { get; set; }

    [BsonElement("declined_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? DeclinedAt { get; set; }
}

public class TradeInShipping
{
    [BsonElement("label_url")]
    [BsonIgnoreIfNull]
    public string? LabelUrl { get; set; }

    [BsonElement("label_uploaded_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? LabelUploadedAt { get; set; }

    [BsonElement("received_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ReceivedAt { get; set; }

    [BsonElement("inspected_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? InspectedAt { get; set; }

    [BsonElement("inspection_notes")]
    [BsonIgnoreIfNull]
    public string? InspectionNotes { get; set; }
}

public class TradeInPayout
{
    [BsonElement("completed_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    [BsonElement("paid_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? PaidAt { get; set; }

    [BsonElement("paypal_transaction_id")]
    [BsonIgnoreIfNull]
    public string? PaypalTransactionId { get; set; }

    [BsonElement("store_credit_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? StoreCreditId { get; set; }
}

public static class TradeInStatus
{
    public const string Submitted = "submitted";
    public const string Offered = "offered";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
    public const string Expired = "expired";
    public const string Received = "received";
    public const string Inspected = "inspected";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";
    public const string Rejected = "rejected";
}

public static class TradeInOfferType
{
    public const string Cash = "cash";
    public const string Credit = "credit";
}
