using GuitarDb.API.Services;
using MongoDB.Bson;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    /// Keep in step with the character counter on the review form.
    public const int MaxReviewLength = 1000;

    private readonly MongoDbService _mongoDbService;

    public ReviewsController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    [HttpGet]
    public async Task<IActionResult> GetReviews(
        [FromQuery] string? search = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var (reviews, totalCount) = await _mongoDbService.GetReviewsAsync(
            search, fromDate, toDate, page, pageSize);

        return Ok(new
        {
            reviews = reviews.Select(r => new
            {
                id = r.Id,
                guitar_name = r.GuitarName,
                reviewer_name = r.ReviewerName,
                review_date = r.ReviewDate,
                rating = r.Rating,
                review_text = r.ReviewText,
                source = r.Source
            }),
            total_count = totalCount,
            page,
            page_size = pageSize,
            total_pages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] int recentDays = 30)
    {
        if (recentDays < 1) recentDays = 30;

        var (totalCount, recentCount, averageRating) = await _mongoDbService.GetReviewStatsAsync(recentDays);

        return Ok(new
        {
            total_count = totalCount,
            recent_count = recentCount,
            recent_days = recentDays,
            average_rating = Math.Round(averageRating, 1)
        });
    }

    /// <summary>
    /// Every review the signed-in customer has written, keyed by order, so the form can
    /// load what they already said instead of silently replacing it.
    /// </summary>
    [HttpGet("mine")]
    [Authorize]
    public async Task<IActionResult> GetMyReviews()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var reviews = await _mongoDbService.GetSiteReviewsByUserAsync(userId);

        return Ok(reviews.Select(r => new
        {
            id = r.Id,
            order_id = r.OrderId,
            guitar_name = r.GuitarName,
            rating = r.Rating,
            review_text = r.ReviewText,
            review_date = r.ReviewDate
        }));
    }

    /// <summary>
    /// Write or update a review of the shop. Signed in only: the reviewer name comes from
    /// the account rather than the request, so a review cannot be posted under someone
    /// else's name.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> SubmitReview([FromBody] SubmitReviewRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (request.Rating < 1 || request.Rating > 5)
        {
            return BadRequest(new { error = "Rating must be between 1 and 5 stars." });
        }

        var text = (request.ReviewText ?? string.Empty).Trim();
        if (text.Length == 0)
        {
            return BadRequest(new { error = "Please write a few words about your experience." });
        }
        if (text.Length > MaxReviewLength)
        {
            return BadRequest(new { error = $"Reviews are limited to {MaxReviewLength} characters." });
        }

        if (string.IsNullOrWhiteSpace(request.OrderId))
        {
            return BadRequest(new { error = "Pick which order you're reviewing." });
        }

        // Anything that isn't a real id would throw inside the driver and surface as a 500,
        // so it is rejected as "not yours" alongside ids that simply don't exist.
        if (!ObjectId.TryParse(request.OrderId, out _))
        {
            return NotFound(new { error = "That order isn't on your account." });
        }

        // The order supplies the guitar name, and checking it belongs to the caller stops a
        // review being attached to someone else's purchase.
        var order = await _mongoDbService.GetOrderByIdAsync(request.OrderId);
        if (order == null || order.UserId != userId)
        {
            return NotFound(new { error = "That order isn't on your account." });
        }

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user == null) return Unauthorized(new { error = "Account not found" });

        // Orders are nearly always a single guitar; join the rest so nothing is dropped.
        var guitarName = order.Items != null && order.Items.Count > 0
            ? string.Join(", ", order.Items.Select(i => i.ListingTitle))
            : "Order";

        var reviewerName = string.IsNullOrWhiteSpace(user.FullName) ? "Customer" : user.FullName;
        var review = await _mongoDbService.UpsertSiteReviewAsync(
            userId, request.OrderId, guitarName, reviewerName, request.Rating, text);

        return Ok(new
        {
            id = review.Id,
            order_id = review.OrderId,
            guitar_name = review.GuitarName,
            reviewer_name = review.ReviewerName,
            rating = review.Rating,
            review_text = review.ReviewText,
            review_date = review.ReviewDate
        });
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}

public class SubmitReviewRequest
{
    public int Rating { get; set; }
    public string? ReviewText { get; set; }
    /// <summary>Which order the review is about; supplies the guitar name.</summary>
    public string? OrderId { get; set; }
}
