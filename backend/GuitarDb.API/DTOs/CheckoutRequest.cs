using System.Text.Json.Serialization;

namespace GuitarDb.API.DTOs;

public class CheckoutRequest
{
    [JsonPropertyName("items")]
    public List<CartItem> Items { get; set; } = new();
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
