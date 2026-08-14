using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// A reservation is the single source of truth for "who is this guitar promised to".
/// One active reservation per listing, max. Replaces the old MyListing.Pending flag
/// and backs the accepted-offer cart lock.
/// </summary>
public class Reservation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("listing_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ListingId { get; set; } = string.Empty;

    /// <summary>
    /// The single customer allowed to buy this guitar while the reservation is active.
    /// Null means "migrated but unassigned" — blocks checkout for everyone (safe default).
    /// </summary>
    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? UserId { get; set; }

    [BsonElement("type")]
    public string Type { get; set; } = ReservationType.Hold;

    [BsonElement("status")]
    public string Status { get; set; } = ReservationStatus.Pending;

    /// <summary>
    /// Terms are locked at creation. Balance is always computed from this, never from
    /// the live listing price, so editing the listing later does not move the goalposts.
    /// </summary>
    [BsonElement("agreed_price")]
    public decimal AgreedPrice { get; set; }

    [BsonElement("trade_in_credit")]
    public decimal TradeInCredit { get; set; } = 0m;

    [BsonElement("deposit_required")]
    public bool DepositRequired { get; set; } = false;

    [BsonElement("deposit_amount")]
    public decimal DepositAmount { get; set; } = 0m;

    [BsonElement("deposit_refundable")]
    public bool DepositRefundable { get; set; } = false;

    [BsonElement("deposit_paid_amount")]
    public decimal DepositPaidAmount { get; set; } = 0m;

    [BsonElement("deposit_paid_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? DepositPaidAt { get; set; }

    /// <summary>"card", "paypal", or free text for manual (cash / Venmo / Zelle).</summary>
    [BsonElement("deposit_payment_method")]
    [BsonIgnoreIfNull]
    public string? DepositPaymentMethod { get; set; }

    /// <summary>Order id of the deposit order, so the paper trail is complete.</summary>
    [BsonElement("deposit_order_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? DepositOrderId { get; set; }

    /// <summary>Order id of the final balance order.</summary>
    [BsonElement("final_order_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? FinalOrderId { get; set; }

    /// <summary>Null = no expiration.</summary>
    [BsonElement("expires_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Admin-only. Never returned on any public or customer-facing endpoint.</summary>
    [BsonElement("internal_note")]
    [BsonIgnoreIfNull]
    public string? InternalNote { get; set; }

    /// <summary>Set when cancelled. Dropdown reason + optional free text.</summary>
    [BsonElement("cancellation_reason")]
    [BsonIgnoreIfNull]
    public string? CancellationReason { get; set; }

    /// <summary>
    /// Set when a DepositPaid reservation runs past expiry. Money changed hands, so we
    /// never auto-release — we flag it and let the admin decide.
    /// </summary>
    [BsonElement("needs_review")]
    public bool NeedsReview { get; set; } = false;

    [BsonElement("needs_review_reason")]
    [BsonIgnoreIfNull]
    public string? NeedsReviewReason { get; set; }

    /// <summary>Set once the 48h "expiring soon" warning has gone out, so it only fires once.</summary>
    [BsonElement("expiring_soon_notified_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? ExpiringSoonNotifiedAt { get; set; }

    /// <summary>Conversation id when this reservation came from an accepted offer.</summary>
    [BsonElement("source_conversation_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? SourceConversationId { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("completed_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? CompletedAt { get; set; }

    // ---- Derived values. Never persisted; always recomputed server-side. ----

    /// <summary>
    /// What the reserved user still owes: agreed price - deposit paid - trade-in credit.
    /// Never negative. Recomputed on every read so a stale document can't leak a wrong price.
    /// </summary>
    [BsonIgnore]
    public decimal BalanceDue =>
        Math.Max(0m, AgreedPrice - DepositPaidAmount - TradeInCredit);

    /// <summary>True when credits exceed the price — flagged for admin review, never auto-refunded.</summary>
    [BsonIgnore]
    public bool IsOverCredited =>
        (DepositPaidAmount + TradeInCredit) > AgreedPrice;

    /// <summary>Active = still blocking the listing for everyone but the reserved user.</summary>
    [BsonIgnore]
    public bool IsActive =>
        Status == ReservationStatus.Pending || Status == ReservationStatus.DepositPaid;

    [BsonIgnore]
    public bool IsExpired =>
        ExpiresAt.HasValue && ExpiresAt.Value <= DateTime.UtcNow;

    /// <summary>
    /// Unassigned migrated reservations block checkout for everyone until the admin
    /// assigns the right customer.
    /// </summary>
    [BsonIgnore]
    public bool IsUnassigned => string.IsNullOrEmpty(UserId);
}

public static class ReservationType
{
    public const string Hold = "hold";
    public const string TradeIn = "trade_in";
    public const string OfferAccepted = "offer_accepted";

    public static readonly string[] All = { Hold, TradeIn, OfferAccepted };

    /// <summary>Admin-selectable types. OfferAccepted is created by the offer flow, not by hand.</summary>
    public static readonly string[] AdminSelectable = { Hold, TradeIn };

    public static bool IsValid(string? type) =>
        !string.IsNullOrEmpty(type) && All.Contains(type);

    public static string Label(string type) => type switch
    {
        Hold => "Hold",
        TradeIn => "Trade-In",
        OfferAccepted => "Accepted Offer",
        _ => type
    };

    /// <summary>Public-facing badge. Must never hint at who the holder is.</summary>
    public static string PublicBadge(string type) => type switch
    {
        TradeIn => "Pending Trade-In",
        _ => "On Hold"
    };

    /// <summary>Default hold length per type, per spec §5.</summary>
    public static int DefaultExpiryDays(string type) => type switch
    {
        TradeIn => 30,
        OfferAccepted => 3,
        _ => 7
    };
}

public static class ReservationStatus
{
    public const string Pending = "pending";
    public const string DepositPaid = "deposit_paid";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";
    public const string Expired = "expired";

    public static readonly string[] All = { Pending, DepositPaid, Completed, Cancelled, Expired };

    /// <summary>Statuses that still reserve the listing.</summary>
    public static readonly string[] Active = { Pending, DepositPaid };

    public static bool IsValid(string? status) =>
        !string.IsNullOrEmpty(status) && All.Contains(status);

    public static string Label(string status) => status switch
    {
        Pending => "Pending",
        DepositPaid => "Deposit Paid",
        Completed => "Completed",
        Cancelled => "Cancelled",
        Expired => "Expired",
        _ => status
    };
}

public static class ReservationCancellationReason
{
    public const string CustomerBackedOut = "customer_backed_out";
    public const string TradeFellThrough = "trade_fell_through";
    public const string Expired = "expired";
    public const string SoldElsewhere = "sold_elsewhere";
    public const string Other = "other";

    public static readonly string[] All =
        { CustomerBackedOut, TradeFellThrough, Expired, SoldElsewhere, Other };

    public static bool IsValid(string? reason) =>
        !string.IsNullOrEmpty(reason) && All.Contains(reason);
}
