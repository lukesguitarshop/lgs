using System.Text.Json.Serialization;

namespace GuitarDb.API.Models.Reverb;

public class ReverbFeedbackResponse
{
    [JsonPropertyName("feedback")]
    public List<ReverbFeedback> Feedback { get; set; } = new();

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
    public ReverbRating? Rating { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

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

    // Helper to get the listing title from either structure
    public string? GetListingTitle() =>
        Listing?.Title ?? Order?.Listing?.Title;

    // Helper to get the reviewer name from either structure
    public string? GetReviewerName() =>
        Author?.Name ?? Buyer?.FullName ?? Buyer?.FirstName;

    // Helper to get a unique identifier
    public string? GetUniqueId() =>
        Id ?? OrderId;
}

public class ReverbRating
{
    [JsonPropertyName("rating")]
    public int Value { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
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
