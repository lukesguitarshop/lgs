using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Review
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("guitar_name")]
    [BsonRequired]
    public string GuitarName { get; set; } = string.Empty;

    [BsonElement("reviewer_name")]
    [BsonRequired]
    public string ReviewerName { get; set; } = string.Empty;

    [BsonElement("review_date")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ReviewDate { get; set; } = DateTime.UtcNow;

    [BsonElement("rating")]
    public int Rating { get; set; } = 5;

    [BsonElement("review_text")]
    [BsonRequired]
    public string ReviewText { get; set; } = string.Empty;
}
