using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Offer
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

    [BsonElement("initial_offer_amount")]
    public decimal InitialOfferAmount { get; set; }

    [BsonElement("current_offer_amount")]
    public decimal CurrentOfferAmount { get; set; }

    [BsonElement("counter_offer_amount")]
    [BsonIgnoreIfNull]
    public decimal? CounterOfferAmount { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = OfferStatus.Pending;

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("messages")]
    public List<OfferMessage> Messages { get; set; } = new();
}

public class OfferMessage
{
    [BsonElement("sender_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? SenderId { get; set; } = null;

    [BsonElement("message_text")]
    public string MessageText { get; set; } = string.Empty;

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("is_system_message")]
    public bool IsSystemMessage { get; set; } = false;
}

public static class OfferStatus
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Rejected = "rejected";
    public const string Countered = "countered";
}
