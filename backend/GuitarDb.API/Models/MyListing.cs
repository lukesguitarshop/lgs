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

    // Left out of the document entirely when there is no Reverb listing (one made by hand
    // in admin). reverb_link_idx is unique and sparse: sparse skips a missing field but
    // still indexes an explicit null, so a second hand-made listing would be rejected.
    [BsonElement("reverb_link")]
    [BsonIgnoreIfNull]
    public string? ReverbLink { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("original_price")]
    [BsonIgnoreIfNull]
    public decimal? OriginalPrice { get; set; }

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

    [BsonElement("pending")]
    public bool Pending { get; set; } = false;

    /// <summary>
    /// Marks the one guitar shown in the homepage hero. At most a single listing
    /// carries this at a time; setting it elsewhere clears the previous holder.
    /// </summary>
    [BsonElement("featured")]
    public bool Featured { get; set; } = false;
}
