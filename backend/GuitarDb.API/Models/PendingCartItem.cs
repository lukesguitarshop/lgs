using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class PendingCartItem
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("listing_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ListingId { get; set; } = string.Empty;

    [BsonElement("offer_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string OfferId { get; set; } = string.Empty;

    /// <summary>
    /// The reservation that owns this lock, when there is one. Reservation-backed locks
    /// are the source of truth for pricing and for whether the item can be removed.
    /// </summary>
    [BsonElement("reservation_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? ReservationId { get; set; }

    /// <summary>
    /// Deposit already paid against this item. Displayed as a credit line in the cart
    /// and subtracted from the amount charged at final checkout.
    /// </summary>
    [BsonElement("deposit_paid")]
    [BsonIgnoreIfDefault]
    public decimal DepositPaid { get; set; } = 0m;

    /// <summary>Trade-in credit applied to this item, if the reservation is a trade-in.</summary>
    [BsonElement("trade_in_credit")]
    [BsonIgnoreIfDefault]
    public decimal TradeInCredit { get; set; } = 0m;

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("listing_title")]
    public string ListingTitle { get; set; } = string.Empty;

    [BsonElement("listing_image")]
    public string ListingImage { get; set; } = string.Empty;

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// TTL field: Mongo deletes the document at this time. NULL MEANS NEVER EXPIRE —
    /// a missing/non-date TTL field is ignored by the index. Deposit-backed locks are
    /// written with null here so the financial paper trail can never be auto-deleted
    /// (spec: never hard-delete a reservation with a payment attached). Offer-based
    /// locks keep the original 72-hour behaviour.
    /// </summary>
    [BsonElement("expires_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? ExpiresAt { get; set; }
}
