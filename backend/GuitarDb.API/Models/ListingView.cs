using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// "This visitor already counted for this listing today." Short-lived: a unique index
/// on (listing, visitor) rejects the repeat view, and a TTL index clears the record once
/// the day it covers is over. The visitor key is a salted hash, never an IP address.
/// </summary>
public class ListingViewMark
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("listing_id")]
    public string ListingId { get; set; } = string.Empty;

    [BsonElement("visitor")]
    public string Visitor { get; set; } = string.Empty;

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Views of one listing on one UTC day. Feeds the admin analytics page, which needs
/// "views over time" and "most viewed this month", not only the all-time total.
/// </summary>
public class ListingViewDay
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("listing_id")]
    public string ListingId { get; set; } = string.Empty;

    /// <summary>yyyy-MM-dd, UTC. A string so ranges compare and group without time zones.</summary>
    [BsonElement("day")]
    public string Day { get; set; } = string.Empty;

    [BsonElement("count")]
    public long Count { get; set; }
}

/// <summary>
/// Running view total for one listing. Kept apart from the listing document, which is
/// replaced wholesale when listings are refreshed.
/// </summary>
public class ListingViewCount
{
    [BsonId]
    public string ListingId { get; set; } = string.Empty;

    [BsonElement("count")]
    public long Count { get; set; }
}
