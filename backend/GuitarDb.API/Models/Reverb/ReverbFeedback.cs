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
    [JsonPropertyName("order_id")]
    public string? OrderId { get; set; }

    [JsonPropertyName("rating")]
    public ReverbRating? Rating { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("order")]
    public ReverbFeedbackOrder? Order { get; set; }

    [JsonPropertyName("buyer")]
    public ReverbFeedbackBuyer? Buyer { get; set; }
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

public class ReverbFeedbackBuyer
{
    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }

    [JsonPropertyName("first_name")]
    public string? FirstName { get; set; }
}
