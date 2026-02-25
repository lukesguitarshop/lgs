using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Order
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("payment_method")]
    public string PaymentMethod { get; set; } = "stripe";

    [BsonElement("stripe_session_id")]
    [BsonIgnoreIfNull]
    public string? StripeSessionId { get; set; }

    [BsonElement("stripe_payment_intent_id")]
    [BsonIgnoreIfNull]
    public string? StripePaymentIntentId { get; set; }

    [BsonElement("paypal_order_id")]
    [BsonIgnoreIfNull]
    public string? PayPalOrderId { get; set; }

    [BsonElement("paypal_capture_id")]
    [BsonIgnoreIfNull]
    public string? PayPalCaptureId { get; set; }

    [BsonElement("items")]
    public List<OrderItem> Items { get; set; } = new();

    [BsonElement("shipping_address")]
    [BsonRequired]
    public OrderShippingAddress ShippingAddress { get; set; } = new();

    [BsonElement("total_amount")]
    public decimal TotalAmount { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("status")]
    public string Status { get; set; } = "completed";

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? UserId { get; set; }

    [BsonElement("guest_session_id")]
    [BsonIgnoreIfNull]
    public string? GuestSessionId { get; set; }

    [BsonElement("guest_email")]
    [BsonIgnoreIfNull]
    public string? GuestEmail { get; set; }
}

public class OrderItem
{
    [BsonElement("listing_id")]
    public string ListingId { get; set; } = string.Empty;

    [BsonElement("listing_title")]
    public string ListingTitle { get; set; } = string.Empty;

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;
}

public class OrderShippingAddress
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
