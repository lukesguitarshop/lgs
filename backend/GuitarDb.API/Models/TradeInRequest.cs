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
    /// <summary>
    /// Where the guitar ships from, and where it goes back if the trade falls through.
    /// The customer gives it right after accepting; the prepaid label is made from it.
    /// </summary>
    [BsonElement("return_address")]
    [BsonIgnoreIfNull]
    public UserShippingAddress? ReturnAddress { get; set; }

    [BsonElement("return_address_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ReturnAddressAt { get; set; }

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

/// <summary>
/// The one place that says which action is allowed in which status. Both the customer
/// and admin controllers ask here, so a trade-in can't be moved out of order.
/// </summary>
public static class TradeInRules
{
    public const int MaxPhotos = 8;
    public const long MaxPhotoBytes = 10 * 1024 * 1024;
    public static readonly string[] Conditions = { "Mint", "Excellent", "Very Good", "Good", "Fair" };
    public static readonly string[] PhotoContentTypes = { "image/jpeg", "image/png", "image/gif", "image/webp" };

    /// <summary>
    /// The stored status, except an unanswered offer past its expiry reads as expired.
    /// Computed on read so no background job has to flip it.
    /// </summary>
    public static string EffectiveStatus(TradeInRequest req)
    {
        if (req.Status != TradeInStatus.Offered) return req.Status;
        var active = req.Offers.LastOrDefault();
        var lapsed = active != null && active.AcceptedAt == null && active.DeclinedAt == null
                     && active.ExpiresAt < DateTime.UtcNow;
        return lapsed ? TradeInStatus.Expired : req.Status;
    }

    public static bool CanOffer(TradeInRequest req) => EffectiveStatus(req) is
        TradeInStatus.Submitted or TradeInStatus.Offered or TradeInStatus.Declined or TradeInStatus.Expired;

    /// <summary>Once the label exists it was made from the address, so the address is fixed.</summary>
    public static bool CanSetReturnAddress(TradeInRequest req) =>
        req.Status == TradeInStatus.Accepted && req.Shipping.LabelUrl == null;

    public static bool CanUploadLabel(TradeInRequest req) => req.Status == TradeInStatus.Accepted;
    public static bool CanReceive(TradeInRequest req) => req.Status == TradeInStatus.Accepted;
    public static bool CanInspect(TradeInRequest req) => req.Status == TradeInStatus.Received;
    public static bool CanComplete(TradeInRequest req) => req.Status == TradeInStatus.Inspected;

    public static bool CanMarkPaid(TradeInRequest req) =>
        req.Status == TradeInStatus.Completed && req.Payout.PaidAt == null;

    public static bool CanAdminCancel(TradeInRequest req) =>
        req.Status is not (TradeInStatus.Completed or TradeInStatus.Cancelled);

    /// <summary>The customer can back out until they have accepted an offer.</summary>
    public static bool CanCustomerCancel(TradeInRequest req) => EffectiveStatus(req) is
        TradeInStatus.Submitted or TradeInStatus.Offered or TradeInStatus.Expired;
}

public static class TradeInOfferType
{
    public const string Cash = "cash";
    public const string Credit = "credit";
}
