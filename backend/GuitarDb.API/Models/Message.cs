using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Message
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("conversation_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ConversationId { get; set; } = string.Empty;

    [BsonElement("sender_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string SenderId { get; set; } = string.Empty;

    [BsonElement("recipient_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string RecipientId { get; set; } = string.Empty;

    [BsonElement("listing_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? ListingId { get; set; }

    [BsonElement("message_text")]
    public string MessageText { get; set; } = string.Empty;

    [BsonElement("image_urls")]
    [BsonIgnoreIfNull]
    public List<string>? ImageUrls { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("is_read")]
    public bool IsRead { get; set; } = false;
}
