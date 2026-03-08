using System.Text.Json.Serialization;

namespace GuitarDb.API.Models.Reverb;

public class ReverbFeedbackResponse
{
    [JsonPropertyName("feedbacks")]
    public List<ReverbFeedback> Feedbacks { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("current_page")]
    public int CurrentPage { get; set; }

    [JsonPropertyName("total_pages")]
    public int TotalPages { get; set; }

    [JsonPropertyName("_links")]
    public ReverbPagination? Links { get; set; }
}

public class ReverbFeedback
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("order_id")]
    public string? OrderId { get; set; }

    [JsonPropertyName("rating")]
    public int Rating { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    // Type: "seller" or "buyer"
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    // Author name from shop feedback endpoint
    [JsonPropertyName("author_name")]
    public string? AuthorName { get; set; }

    // Order title (guitar name) from shop feedback endpoint
    [JsonPropertyName("order_title")]
    public string? OrderTitle { get; set; }

    // Shop feedback endpoint uses "listing" directly
    [JsonPropertyName("listing")]
    public ReverbFeedbackListing? Listing { get; set; }

    // My feedback endpoint uses "order.listing"
    [JsonPropertyName("order")]
    public ReverbFeedbackOrder? Order { get; set; }

    // Shop feedback endpoint uses "author"
    [JsonPropertyName("author")]
    public ReverbFeedbackAuthor? Author { get; set; }

    // My feedback endpoint uses "buyer"
    [JsonPropertyName("buyer")]
    public ReverbFeedbackBuyer? Buyer { get; set; }

    // Links containing self href with feedback ID
    [JsonPropertyName("_links")]
    public ReverbFeedbackLinks? Links { get; set; }

    // Helper to get the listing title from either structure
    public string? GetListingTitle() =>
        OrderTitle ?? Listing?.Title ?? Order?.Listing?.Title;

    // Helper to get the reviewer name from either structure
    public string? GetReviewerName() =>
        AuthorName ?? Author?.Name ?? Buyer?.FullName ?? Buyer?.FirstName;

    // Helper to get a unique identifier (extract from _links.self.href)
    public string? GetUniqueId()
    {
        // Try to get ID from _links.self.href (e.g., "https://api.reverb.com/api/feedback/22447572")
        var selfHref = Links?.Self?.Href;
        if (!string.IsNullOrEmpty(selfHref))
        {
            var lastSlash = selfHref.LastIndexOf('/');
            if (lastSlash >= 0 && lastSlash < selfHref.Length - 1)
            {
                return selfHref.Substring(lastSlash + 1);
            }
        }
        return Id ?? OrderId;
    }

    // Check if this is seller feedback
    public bool IsSellerFeedback() =>
        Type?.Equals("seller", StringComparison.OrdinalIgnoreCase) == true;
}

public class ReverbFeedbackLinks
{
    [JsonPropertyName("self")]
    public ReverbLink? Self { get; set; }

    [JsonPropertyName("order")]
    public ReverbLink? Order { get; set; }

    [JsonPropertyName("listing")]
    public ReverbLink? Listing { get; set; }
}

public class ReverbFeedbackOrder
{
    [JsonPropertyName("listing")]
    public ReverbFeedbackListing? Listing { get; set; }
}

public class ReverbFeedbackListing
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("id")]
    public long? Id { get; set; }
}

public class ReverbFeedbackAuthor
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

public class ReverbFeedbackBuyer
{
    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }

    [JsonPropertyName("first_name")]
    public string? FirstName { get; set; }
}
