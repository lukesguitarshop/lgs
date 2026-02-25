using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Favorite
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

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
