using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class OfferConversation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("listing_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ListingId { get; set; } = string.Empty;

    [BsonElement("buyer_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string BuyerId { get; set; } = string.Empty;

    [BsonElement("seller_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string SellerId { get; set; } = string.Empty;

    [BsonElement("pending_action_by")]
    [BsonIgnoreIfNull]
    public string? PendingActionBy { get; set; } // "buyer" | "seller" | null

    [BsonElement("pending_offer_amount")]
    [BsonIgnoreIfNull]
    public decimal? PendingOfferAmount { get; set; }

    [BsonElement("pending_expires_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? PendingExpiresAt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = ConversationStatus.Active;

    [BsonElement("accepted_amount")]
    [BsonIgnoreIfNull]
    public decimal? AcceptedAmount { get; set; }

    [BsonElement("events")]
    public List<ConversationEvent> Events { get; set; } = new();

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ConversationEvent
{
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty; // "message" | "offer" | "accept" | "decline" | "expire"

    [BsonElement("sender_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? SenderId { get; set; }

    [BsonElement("message_text")]
    [BsonIgnoreIfNull]
    public string? MessageText { get; set; }

    [BsonElement("offer_amount")]
    [BsonIgnoreIfNull]
    public decimal? OfferAmount { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class ConversationStatus
{
    public const string Active = "active";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
    public const string Expired = "expired";
}

public static class ConversationEventType
{
    public const string Message = "message";
    public const string Offer = "offer";
    public const string Accept = "accept";
    public const string Decline = "decline";
    public const string Expire = "expire";
}

public static class ActionBy
{
    public const string Buyer = "buyer";
    public const string Seller = "seller";
}
