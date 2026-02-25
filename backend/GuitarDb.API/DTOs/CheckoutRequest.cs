using System.Text.Json.Serialization;

namespace GuitarDb.API.DTOs;

public class CheckoutRequest
{
    [JsonPropertyName("items")]
    public List<CartItem> Items { get; set; } = new();

    [JsonPropertyName("shippingAddress")]
    public ShippingAddress? ShippingAddress { get; set; }
}

public class ShippingAddress
{
    [JsonPropertyName("fullName")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("line1")]
    public string Line1 { get; set; } = string.Empty;

    [JsonPropertyName("line2")]
    public string? Line2 { get; set; }

    [JsonPropertyName("city")]
    public string City { get; set; } = string.Empty;

    [JsonPropertyName("state")]
    public string State { get; set; } = string.Empty;

    [JsonPropertyName("postalCode")]
    public string PostalCode { get; set; } = string.Empty;

    [JsonPropertyName("country")]
    public string Country { get; set; } = string.Empty;
}

public class CartItem
{
    [JsonPropertyName("listingId")]
    public string ListingId { get; set; } = string.Empty;

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; } = 1;
}

public class CheckoutResponse
{
    [JsonPropertyName("sessionUrl")]
    public string SessionUrl { get; set; } = string.Empty;

    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;
}

public class CompleteCheckoutRequest
{
    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;
}

public class PayPalCaptureRequest
{
    [JsonPropertyName("orderId")]
    public string OrderId { get; set; } = string.Empty;
}
