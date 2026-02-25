using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class MyListing
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? Id { get; set; }

    [BsonElement("listing_title")]
    [BsonRequired]
    public string ListingTitle { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("images")]
    public List<string> Images { get; set; } = new();

    [BsonElement("reverb_link")]
    public string? ReverbLink { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("scraped_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ScrapedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("listed_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ListedAt { get; set; }

    [BsonElement("disabled")]
    public bool Disabled { get; set; } = false;
}
