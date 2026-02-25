using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class UserShippingAddress
{
    [BsonElement("full_name")]
    public string FullName { get; set; } = string.Empty;

    [BsonElement("line1")]
    public string Line1 { get; set; } = string.Empty;

    [BsonElement("line2")]
    public string? Line2 { get; set; }

    [BsonElement("city")]
    public string City { get; set; } = string.Empty;

    [BsonElement("state")]
    public string State { get; set; } = string.Empty;

    [BsonElement("postal_code")]
    public string PostalCode { get; set; } = string.Empty;

    [BsonElement("country")]
    public string Country { get; set; } = string.Empty;
}

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("email")]
    [BsonIgnoreIfNull]
    public string? Email { get; set; }

    [BsonElement("password_hash")]
    [BsonIgnoreIfNull]
    public string? PasswordHash { get; set; }

    [BsonElement("full_name")]
    public string FullName { get; set; } = string.Empty;

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("is_guest")]
    public bool IsGuest { get; set; } = false;

    [BsonElement("guest_session_id")]
    [BsonIgnoreIfNull]
    public string? GuestSessionId { get; set; }

    [BsonElement("shipping_address")]
    [BsonIgnoreIfNull]
    public UserShippingAddress? ShippingAddress { get; set; }

    [BsonElement("is_admin")]
    public bool IsAdmin { get; set; } = false;

    [BsonElement("email_verified")]
    public bool EmailVerified { get; set; } = false;
}
