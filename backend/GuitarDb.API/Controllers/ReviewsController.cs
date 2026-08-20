using GuitarDb.API.Services;
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
    /// The signed-in customer's own review, so the form can load already-written text
    /// instead of silently replacing it.
    /// </summary>
    [HttpGet("mine")]
    [Authorize]
    public async Task<IActionResult> GetMyReview()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var review = await _mongoDbService.GetSiteReviewByUserAsync(userId);
        if (review == null) return NoContent();

        return Ok(new
        {
            id = review.Id,
            rating = review.Rating,
            review_text = review.ReviewText,
            review_date = review.ReviewDate
        });
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

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user == null) return Unauthorized(new { error = "Account not found" });

        var reviewerName = string.IsNullOrWhiteSpace(user.FullName) ? "Customer" : user.FullName;
        var review = await _mongoDbService.UpsertSiteReviewAsync(userId, reviewerName, request.Rating, text);

        return Ok(new
        {
            id = review.Id,
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
}
