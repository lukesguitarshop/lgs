using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Review
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("reverb_order_id")]
    [BsonIgnoreIfNull]
    public string? ReverbOrderId { get; set; }

    [BsonElement("guitar_name")]
    [BsonIgnoreIfNull]
    public string? GuitarName { get; set; }

    [BsonElement("reviewer_name")]
    [BsonIgnoreIfNull]
    public string? ReviewerName { get; set; }

    [BsonElement("review_date")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ReviewDate { get; set; } = DateTime.UtcNow;

    [BsonElement("rating")]
    public int Rating { get; set; } = 5;

    [BsonElement("review_text")]
    [BsonIgnoreIfNull]
    public string? ReviewText { get; set; }
}
