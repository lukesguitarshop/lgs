using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// A single logged user action (login, add-to-cart, favorite, order, etc.)
/// shown in the admin user detail page as an activity feed.
/// </summary>
public class UserActivity
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Event type. Known values: "login", "add_to_cart", "favorite",
    /// "unfavorite", "order_placed".
    /// </summary>
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable summary shown in the admin feed,
    /// e.g. "Added 1959 Les Paul to cart".
    /// </summary>
    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Optional related listing id (for add_to_cart / favorite events).
    /// </summary>
    [BsonElement("listing_id")]
    [BsonIgnoreIfNull]
    public string? ListingId { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
