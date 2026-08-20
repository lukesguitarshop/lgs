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

    /// <summary>
    /// "reverb" for scraped reviews, "site" for ones written on lukesguitarshop.com.
    /// Existing scraped documents have no such field, so the default keeps them correct.
    /// </summary>
    [BsonElement("source")]
    public string Source { get; set; } = "reverb";

    /// <summary>
    /// Author of a site review. Null for scraped ones, which have no account behind them.
    /// </summary>
    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? UserId { get; set; }

    /// <summary>
    /// The order a site review is about. Reverb reviews are tied to an order too — that is
    /// what ReverbOrderId is — so this keeps the two kinds shaped the same, and is what
    /// gives a site review its guitar name.
    /// </summary>
    [BsonElement("order_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? OrderId { get; set; }
}
