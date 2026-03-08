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
            // Get existing review order IDs to avoid duplicates
            var existingOrderIds = await _mongoDbService.GetAllReviewOrderIdsAsync();
            _logger.LogInformation("Found {Count} existing reviews in database", existingOrderIds.Count);
            result.OutputLines.Add($"Found {existingOrderIds.Count} existing reviews in database");

            // Fetch feedback from Reverb
            _logger.LogInformation("Fetching feedback from Reverb...");
            result.OutputLines.Add("Fetching feedback from Reverb...");
            var feedbackItems = await FetchAllFeedbackAsync(cancellationToken);
            result.OutputLines.Add($"Fetched {feedbackItems.Count} total feedback items from Reverb");

            // Filter to only new reviews (not already in database)
            var newFeedback = feedbackItems
                .Where(f => !string.IsNullOrEmpty(f.OrderId) && !existingOrderIds.Contains(f.OrderId))
                .ToList();

            _logger.LogInformation("Found {Count} new reviews to import", newFeedback.Count);
            result.OutputLines.Add($"Found {newFeedback.Count} new reviews to import");

            if (newFeedback.Count == 0)
            {
                result.OutputLines.Add("No new reviews to import");
                result.Duration = DateTime.UtcNow - startTime;
                return result;
            }

            // Convert and insert new reviews
            var reviews = newFeedback
                .Select(ConvertToReview)
                .Where(r => r != null)
                .Cast<Review>()
                .ToList();

            if (reviews.Count > 0)
            {
                await _mongoDbService.InsertManyReviewsAsync(reviews);
                result.ReviewsImported = reviews.Count;
                result.OutputLines.Add($"Imported {reviews.Count} new reviews");
            }

            result.Duration = DateTime.UtcNow - startTime;

            _logger.LogInformation("===== REVIEW SCRAPER SUMMARY =====");
            _logger.LogInformation("Reviews Imported: {Count}", result.ReviewsImported);
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
        string? nextUrl = $"{_baseUrl}/my/feedback/received?per_page=50";

        while (!string.IsNullOrEmpty(nextUrl))
        {
            try
            {
                _logger.LogDebug("Fetching feedback page {Page}: {Url}", currentPage, nextUrl);

                var response = await _httpClient.GetAsync(nextUrl, cancellationToken);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                var feedbackResponse = JsonSerializer.Deserialize<ReverbFeedbackResponse>(content, _jsonOptions);

                if (feedbackResponse == null || feedbackResponse.Feedback == null)
                {
                    _logger.LogWarning("Received null response from Reverb feedback API");
                    break;
                }

                allFeedback.AddRange(feedbackResponse.Feedback);

                _logger.LogInformation("Page {Page}: {Count} feedback items (total: {Total})",
                    currentPage, feedbackResponse.Feedback.Count, allFeedback.Count);

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

    private Review? ConvertToReview(ReverbFeedback feedback)
    {
        // Skip if no message (empty review)
        if (string.IsNullOrWhiteSpace(feedback.Message))
        {
            return null;
        }

        // Get the guitar name from the listing title
        var guitarName = feedback.Order?.Listing?.Title ?? "Guitar";

        // Get the reviewer name
        var reviewerName = feedback.Buyer?.FullName ?? feedback.Buyer?.FirstName ?? "Anonymous";

        // Get rating (default to 5 if not provided)
        var rating = feedback.Rating?.Value ?? 5;

        return new Review
        {
            ReverbOrderId = feedback.OrderId,
            GuitarName = guitarName,
            ReviewerName = reviewerName,
            ReviewDate = feedback.CreatedAt,
            Rating = rating,
            ReviewText = feedback.Message
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
