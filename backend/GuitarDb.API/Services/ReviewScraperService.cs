using System.Text.Json;
using GuitarDb.API.Models;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

public class ReviewScraperService
{
    private readonly HttpClient _httpClient;
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<ReviewScraperService> _logger;
    private readonly string _baseUrl;
    private readonly string _shopSlug;
    private readonly int _rateLimitDelayMs;
    private readonly JsonSerializerOptions _jsonOptions;

    public ReviewScraperService(
        HttpClient httpClient,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<ReviewScraperService> logger)
    {
        _httpClient = httpClient;
        _mongoDbService = mongoDbService;
        _logger = logger;

        var apiKey = configuration["ReverbApi:ApiKey"]
            ?? throw new ArgumentNullException("ReverbApi:ApiKey", "Reverb API key is not configured");
        _baseUrl = configuration["ReverbApi:BaseUrl"] ?? "https://api.reverb.com/api";
        _shopSlug = configuration["ReverbApi:ShopSlug"] ?? "lukes-gear-depot-472";
        _rateLimitDelayMs = 500;

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/hal+json");
        _httpClient.DefaultRequestHeaders.Add("Accept-Version", "3.0");

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<ReviewScraperResult> RunAsync(CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        var result = new ReviewScraperResult();

        _logger.LogInformation("===== Starting Review Scraper Service =====");
        _logger.LogInformation("Start Time: {Time:yyyy-MM-dd HH:mm:ss} UTC", startTime);

        try
        {
            // Fetch feedback from Reverb
            _logger.LogInformation("Fetching feedback from Reverb...");
            result.OutputLines.Add("Fetching feedback from Reverb...");
            var feedbackItems = await FetchAllFeedbackAsync(cancellationToken);

            // The feedback endpoint returns feedback the shop received in both roles;
            // keep only reviews of the shop as a seller (type == "seller").
            var sellerFeedback = feedbackItems.Where(f => f.IsSellerFeedback()).ToList();
            _logger.LogInformation("Fetched {Total} feedback items ({Seller} seller reviews)",
                feedbackItems.Count, sellerFeedback.Count);
            result.OutputLines.Add($"Fetched {feedbackItems.Count} feedback items ({sellerFeedback.Count} seller reviews)");

            // All reviews count, including ones without a written message — they still
            // carry a star rating that belongs in the average.
            var reviews = sellerFeedback.Select(ConvertToReview).ToList();

            if (reviews.Count == 0)
            {
                // Don't wipe the database on an empty/suspicious fetch
                result.OutputLines.Add("No seller reviews returned by Reverb — keeping existing reviews");
                result.Duration = DateTime.UtcNow - startTime;
                return result;
            }

            // Full rebuild from the source of truth: replace everything only after a
            // successful fetch, so a mid-fetch failure never leaves an empty collection.
            var deletedCount = await _mongoDbService.DeleteAllReviewsAsync();
            await _mongoDbService.InsertManyReviewsAsync(reviews);

            var averageRating = Math.Round(reviews.Average(r => r.Rating), 2);
            var withText = reviews.Count(r => !string.IsNullOrWhiteSpace(r.ReviewText));

            result.ReviewsImported = reviews.Count;
            result.OutputLines.Add($"Replaced {deletedCount} existing reviews with {reviews.Count} seller reviews ({withText} with text)");
            result.OutputLines.Add($"Average rating: {averageRating}");

            result.Duration = DateTime.UtcNow - startTime;

            _logger.LogInformation("===== REVIEW SCRAPER SUMMARY =====");
            _logger.LogInformation("Reviews Imported: {Count}", result.ReviewsImported);
            _logger.LogInformation("Average Rating: {Avg}", averageRating);
            _logger.LogInformation("Duration: {Duration}", result.Duration);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Review scraper failed with error");
            result.Error = ex.Message;
            result.Duration = DateTime.UtcNow - startTime;
            throw;
        }
    }

    private async Task<List<ReverbFeedback>> FetchAllFeedbackAsync(CancellationToken cancellationToken)
    {
        var allFeedback = new List<ReverbFeedback>();
        var currentPage = 1;

        // Use the shop feedback endpoint - this gets feedback left for the shop as a seller
        string? nextUrl = $"{_baseUrl}/shops/{_shopSlug}/feedback?per_page=50";

        while (!string.IsNullOrEmpty(nextUrl))
        {
            try
            {
                _logger.LogInformation("Fetching feedback page {Page}: {Url}", currentPage, nextUrl);

                var response = await _httpClient.GetAsync(nextUrl, cancellationToken);

                // Log the status code
                _logger.LogInformation("Response status: {StatusCode}", response.StatusCode);

                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync(cancellationToken);

                // Log first 500 chars of response for debugging
                _logger.LogInformation("Response preview: {Preview}",
                    content.Length > 500 ? content.Substring(0, 500) : content);

                var feedbackResponse = JsonSerializer.Deserialize<ReverbFeedbackResponse>(content, _jsonOptions);

                if (feedbackResponse == null || feedbackResponse.Feedbacks == null)
                {
                    _logger.LogWarning("Received null response from Reverb feedback API");
                    break;
                }

                // Shop feedback endpoint already returns feedback FOR the shop (seller feedback)
                // No need to filter by type - all items from this endpoint are seller reviews
                allFeedback.AddRange(feedbackResponse.Feedbacks);

                _logger.LogInformation("Page {Page}: {Count} feedback items (running total: {Total})",
                    currentPage, feedbackResponse.Feedbacks.Count, allFeedback.Count);

                nextUrl = feedbackResponse.Links?.Next?.Href;

                if (!string.IsNullOrEmpty(nextUrl))
                {
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                }

                currentPage++;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP error while fetching feedback page {Page}", currentPage);
                throw;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse JSON response from feedback page {Page}", currentPage);
                throw;
            }
        }

        _logger.LogInformation("Fetched {Total} total feedback items", allFeedback.Count);

        return allFeedback;
    }

    private static Review ConvertToReview(ReverbFeedback feedback)
    {
        return new Review
        {
            ReverbOrderId = feedback.GetUniqueId(),
            GuitarName = feedback.GetListingTitle() ?? "Guitar",
            ReviewerName = feedback.GetReviewerName() ?? "Anonymous",
            ReviewDate = feedback.CreatedAt,
            // Ratings can legitimately be 1-5; only default when missing entirely
            Rating = feedback.Rating > 0 ? feedback.Rating : 5,
            // Empty messages are kept — the rating still counts toward the average
            ReviewText = feedback.Message ?? string.Empty
        };
    }
}

public class ReviewScraperResult
{
    public int ReviewsImported { get; set; }
    public TimeSpan Duration { get; set; }
    public string? Error { get; set; }
    public List<string> OutputLines { get; set; } = new();
}
