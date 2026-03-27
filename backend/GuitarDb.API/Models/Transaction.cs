using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Transaction
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("date")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime Date { get; set; }

    [BsonElement("guitar_name")]
    public string GuitarName { get; set; } = string.Empty;

    [BsonElement("purchase_price")]
    [BsonIgnoreIfNull]
    public decimal? PurchasePrice { get; set; }

    [BsonElement("transaction_type")]
    public string TransactionType { get; set; } = string.Empty; // "sold" or "traded"

    [BsonElement("sold_via")]
    [BsonIgnoreIfNull]
    public string? SoldVia { get; set; } // "Reverb", "Cash", "PayPal", "eBay", "Venmo"

    [BsonElement("trade_for")]
    [BsonIgnoreIfNull]
    public string? TradeFor { get; set; }

    [BsonElement("revenue")]
    [BsonIgnoreIfNull]
    public decimal? Revenue { get; set; }

    [BsonElement("shipping_cost")]
    [BsonIgnoreIfNull]
    public decimal? ShippingCost { get; set; }

    [BsonElement("profit")]
    [BsonIgnoreIfNull]
    public decimal? Profit { get; set; }

    [BsonElement("tracking_carrier")]
    [BsonIgnoreIfNull]
    public string? TrackingCarrier { get; set; }

    [BsonElement("tracking_number")]
    [BsonIgnoreIfNull]
    public string? TrackingNumber { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
