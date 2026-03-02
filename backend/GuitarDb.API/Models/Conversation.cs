using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Conversation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("participant_ids")]
    public List<string> ParticipantIds { get; set; } = new();

    [BsonElement("listing_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? ListingId { get; set; }

    [BsonElement("last_message")]
    [BsonIgnoreIfNull]
    public string? LastMessage { get; set; }

    [BsonElement("last_message_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? LastMessageAt { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("active_offer_amount")]
    [BsonIgnoreIfNull]
    public decimal? ActiveOfferAmount { get; set; }

    [BsonElement("active_offer_by")]
    [BsonIgnoreIfNull]
    public string? ActiveOfferBy { get; set; }

    [BsonElement("pending_action_by")]
    [BsonIgnoreIfNull]
    public string? PendingActionBy { get; set; }  // "buyer" or "seller"

    [BsonElement("offer_expires_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    [BsonIgnoreIfNull]
    public DateTime? OfferExpiresAt { get; set; }

    [BsonElement("offer_status")]
    [BsonIgnoreIfNull]
    public string? OfferStatus { get; set; }  // "active", "accepted", "declined", "expired"

    [BsonElement("accepted_amount")]
    [BsonIgnoreIfNull]
    public decimal? AcceptedAmount { get; set; }
}
