using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.Scraper.Models.Domain;

public class Guitar
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("make")]
    [BsonRequired]
    public string Make { get; set; } = string.Empty;

    [BsonElement("model")]
    [BsonRequired]
    public string Model { get; set; } = string.Empty;

    [BsonElement("year")]
    public int? Year { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = "Electric";

    [BsonElement("images")]
    public List<string> Images { get; set; } = new();

    [BsonElement("reverbLink")]
    public string? ReverbLink { get; set; }

    [BsonElement("shippingPrice")]
    public decimal? ShippingPrice { get; set; }

    [BsonElement("priceHistory")]
    public List<PriceSnapshot> PriceHistory { get; set; } = new();

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonIgnore]
    public string UniqueKey => $"{Make}|{Model}|{Year?.ToString() ?? "Unknown"}";
}
