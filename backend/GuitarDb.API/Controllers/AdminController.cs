using System.Globalization;
using System.Text.RegularExpressions;
using GuitarDb.API.Attributes;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/admin")]
[AdminAuthorize]
public class AdminController : ControllerBase
{
    private readonly ILogger<AdminController> _logger;
    private readonly IConfiguration _configuration;
    private readonly MongoDbService _mongoDbService;
    private readonly ScraperService _scraperService;
    private readonly ReviewScraperService _reviewScraperService;
    private readonly EmailService _emailService;
    private readonly DealFinderService _dealFinderService;
    private readonly SweetwaterDealFinderService _sweetwaterDealFinderService;

    public AdminController(
        ILogger<AdminController> logger,
        IConfiguration configuration,
        MongoDbService mongoDbService,
        ScraperService scraperService,
        ReviewScraperService reviewScraperService,
        EmailService emailService,
        DealFinderService dealFinderService,
        SweetwaterDealFinderService sweetwaterDealFinderService)
    {
        _logger = logger;
        _configuration = configuration;
        _mongoDbService = mongoDbService;
        _scraperService = scraperService;
        _reviewScraperService = reviewScraperService;
        _emailService = emailService;
        _dealFinderService = dealFinderService;
        _sweetwaterDealFinderService = sweetwaterDealFinderService;
    }

    /// <summary>
    /// Manually trigger the Reverb scraper to refresh listings
    /// </summary>
    [HttpPost("run-scraper")]
    public async Task<IActionResult> RunScraper()
    {
        _logger.LogInformation("Manual scraper trigger requested");

        try
        {
            var result = await _scraperService.RunAsync();

            _logger.LogInformation("Scraper completed successfully: {ListingsScraped} listings, {TotalPhotos} photos, {ListingsDisabled} disabled",
                result.ListingsScraped, result.TotalPhotos, result.ListingsDisabled);

            return Ok(new
            {
                success = true,
                message = "Scraper completed successfully",
                listingsScraped = result.ListingsScraped,
                totalPhotos = result.TotalPhotos,
                listingsDisabled = result.ListingsDisabled,
                duration = result.Duration.ToString(),
                output = result.OutputLines
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run scraper");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to run scraper",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Manually trigger the review scraper to fetch reviews from Reverb
    /// </summary>
    [HttpPost("run-review-scraper")]
    public async Task<IActionResult> RunReviewScraper()
    {
        _logger.LogInformation("Manual review scraper trigger requested");

        try
        {
            var result = await _reviewScraperService.RunAsync();

            _logger.LogInformation("Review scraper completed successfully: {ReviewsImported} reviews imported",
                result.ReviewsImported);

            return Ok(new
            {
                success = true,
                message = "Review scraper completed successfully",
                reviewsImported = result.ReviewsImported,
                duration = result.Duration.ToString(),
                output = result.OutputLines
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run review scraper");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to run review scraper",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Initialize original_price for all listings that don't have it set
    /// </summary>
    [HttpPost("initialize-original-prices")]
    public async Task<IActionResult> InitializeOriginalPrices()
    {
        _logger.LogInformation("Initialize original prices requested");

        try
        {
            var updatedCount = await _mongoDbService.InitializeOriginalPricesAsync();

            return Ok(new
            {
                success = true,
                message = $"Initialized original_price for {updatedCount} listing(s)",
                updatedCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize original prices");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to initialize original prices",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Delete manually entered reviews (those without a Reverb order ID)
    /// </summary>
    [HttpDelete("reviews/manual")]
    public async Task<IActionResult> DeleteManualReviews()
    {
        _logger.LogInformation("Delete manual reviews requested");

        try
        {
            var deletedCount = await _mongoDbService.DeleteManualReviewsAsync();

            return Ok(new
            {
                success = true,
                message = $"Deleted {deletedCount} manually entered reviews",
                deletedCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete manual reviews");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to delete manual reviews",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Get all listings including disabled ones for admin view
    /// </summary>
    [HttpGet("listings")]
    public async Task<IActionResult> GetAllListingsForAdmin()
    {
        var listings = await _mongoDbService.GetAllListingsForAdminAsync();

        return Ok(listings.Select(l => new
        {
            id = l.Id,
            listing_title = l.ListingTitle,
            condition = l.Condition,
            images = l.Images,
            price = l.Price,
            currency = l.Currency,
            disabled = l.Disabled
        }));
    }

    /// <summary>
    /// Toggle the disabled status of a listing
    /// </summary>
    [HttpPatch("listings/{id}/toggle-disabled")]
    public async Task<IActionResult> ToggleListingDisabled(string id)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(id);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        var newDisabledStatus = !listing.Disabled;
        var success = await _mongoDbService.SetListingDisabledAsync(id, newDisabledStatus);

        if (!success)
        {
            return StatusCode(500, new { error = "Failed to update listing" });
        }

        return Ok(new { id, disabled = newDisabledStatus });
    }

    /// <summary>
    /// Update the price of a listing
    /// </summary>
    [HttpPatch("listings/{id}/price")]
    public async Task<IActionResult> UpdateListingPrice(string id, [FromBody] UpdatePriceRequest request)
    {
        if (request.Price <= 0)
        {
            return BadRequest(new { error = "Price must be a positive number" });
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(id);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        var success = await _mongoDbService.UpdateListingPriceAsync(id, request.Price);

        if (!success)
        {
            return StatusCode(500, new { error = "Failed to update price" });
        }

        return Ok(new { id, price = request.Price });
    }

    public class UpdatePriceRequest
    {
        public decimal Price { get; set; }
    }

    /// <summary>
    /// Delete a listing permanently
    /// </summary>
    [HttpDelete("listings/{id}")]
    public async Task<IActionResult> DeleteListing(string id)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(id);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        var success = await _mongoDbService.DeleteMyListingAsync(id);

        if (!success)
        {
            return StatusCode(500, new { error = "Failed to delete listing" });
        }

        _logger.LogInformation("Deleted listing {Id}: {Title}", id, listing.ListingTitle);

        return Ok(new { success = true, message = "Listing deleted successfully" });
    }

    /// <summary>
    /// Clean up duplicate listings (keeps most recent by ScrapedAt, deletes others)
    /// </summary>
    [HttpPost("cleanup-duplicates")]
    public async Task<IActionResult> CleanupDuplicates()
    {
        _logger.LogInformation("Duplicate cleanup requested");

        try
        {
            var (duplicatesFound, deleted) = await _mongoDbService.CleanupDuplicateListingsAsync();

            return Ok(new
            {
                success = true,
                message = $"Cleanup complete: found {duplicatesFound} duplicates, deleted {deleted}",
                duplicatesFound,
                deleted
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to clean up duplicates");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to clean up duplicates",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Normalize existing ReverbLink URLs (enforce https, remove trailing slashes)
    /// </summary>
    [HttpPost("normalize-reverb-links")]
    public async Task<IActionResult> NormalizeReverbLinks()
    {
        _logger.LogInformation("ReverbLink normalization requested");

        try
        {
            var (processed, updated) = await _mongoDbService.NormalizeExistingReverbLinksAsync();

            return Ok(new
            {
                success = true,
                message = $"Normalization complete: processed {processed} listings, updated {updated}",
                processed,
                updated
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to normalize ReverbLink URLs");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to normalize ReverbLink URLs",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Seed reviews from markdown text format
    /// Format: Guitar Name\nReviewer N. – Month Day, Year\nReview text
    /// </summary>
    [HttpPost("seed-reviews")]
    public async Task<IActionResult> SeedReviews([FromBody] SeedReviewsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ReviewsText))
        {
            return BadRequest(new { error = "Reviews text is required" });
        }

        _logger.LogInformation("Seeding reviews from provided text");

        try
        {
            var reviews = ParseReviewsFromMarkdown(request.ReviewsText);

            if (reviews.Count == 0)
            {
                return BadRequest(new { error = "No valid reviews found in the provided text" });
            }

            long deletedCount = 0;
            if (request.ClearExisting)
            {
                deletedCount = await _mongoDbService.DeleteAllReviewsAsync();
                _logger.LogInformation("Cleared {Count} existing reviews", deletedCount);
            }

            await _mongoDbService.InsertManyReviewsAsync(reviews);

            _logger.LogInformation("Seeded {Count} reviews successfully", reviews.Count);

            return Ok(new
            {
                success = true,
                message = $"Successfully seeded {reviews.Count} reviews" + (request.ClearExisting ? $" (cleared {deletedCount} existing)" : ""),
                count = reviews.Count,
                deleted = deletedCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to seed reviews");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to seed reviews",
                error = ex.Message
            });
        }
    }

    private List<Review> ParseReviewsFromMarkdown(string text)
    {
        var reviews = new List<Review>();
        var lines = text.Split('\n').Select(l => l.Trim()).ToList();

        // Pattern for reviewer line: "Name L. – Month Day, Year" or "Name L. – Month Dayth, Year"
        var reviewerPattern = new Regex(@"^(.+?)\s+[–-]\s+(\w+)\s+(\d+)(?:st|nd|rd|th)?,?\s+(\d{4})$", RegexOptions.Compiled);

        string? currentGuitarName = null;
        string? currentReviewerName = null;
        DateTime? currentReviewDate = null;
        var currentReviewText = new List<string>();

        void SavePendingReview()
        {
            if (currentGuitarName != null && currentReviewerName != null && currentReviewDate.HasValue)
            {
                reviews.Add(new Review
                {
                    GuitarName = currentGuitarName,
                    ReviewerName = currentReviewerName,
                    ReviewDate = currentReviewDate.Value,
                    Rating = 5,
                    ReviewText = string.Join(" ", currentReviewText).Trim()
                });
            }
            currentGuitarName = null;
            currentReviewerName = null;
            currentReviewDate = null;
            currentReviewText.Clear();
        }

        for (int i = 0; i < lines.Count; i++)
        {
            var line = lines[i];

            // Skip header line
            if (line.StartsWith("5 stars reviews", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(line))
            {
                SavePendingReview();
                continue;
            }

            // Check if this is a reviewer line
            var reviewerMatch = reviewerPattern.Match(line);
            if (reviewerMatch.Success)
            {
                // Save any pending review before starting a new one
                SavePendingReview();

                // The previous line should be the guitar name
                if (i > 0 && !string.IsNullOrEmpty(lines[i - 1]))
                {
                    var prevLine = lines[i - 1];
                    // Make sure the previous line isn't also a reviewer line or the header
                    if (!reviewerPattern.IsMatch(prevLine) &&
                        !prevLine.StartsWith("5 stars reviews", StringComparison.OrdinalIgnoreCase))
                    {
                        currentGuitarName = prevLine;
                    }
                }

                currentReviewerName = reviewerMatch.Groups[1].Value.Trim();
                var month = reviewerMatch.Groups[2].Value;
                var day = int.Parse(reviewerMatch.Groups[3].Value);
                var year = int.Parse(reviewerMatch.Groups[4].Value);

                if (DateTime.TryParseExact($"{month} {day}, {year}", "MMMM d, yyyy",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                {
                    currentReviewDate = DateTime.SpecifyKind(date, DateTimeKind.Utc);
                }
                else if (DateTime.TryParseExact($"{month} {day}, {year}", "MMM d, yyyy",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var date2))
                {
                    currentReviewDate = DateTime.SpecifyKind(date2, DateTimeKind.Utc);
                }
            }
            else if (currentReviewerName != null)
            {
                // Check if this line is actually the next guitar name (next line is a reviewer)
                if (i + 1 < lines.Count && reviewerPattern.IsMatch(lines[i + 1]))
                {
                    // This line is the next guitar name, save current review
                    SavePendingReview();
                    // Don't add this to review text, it will be picked up as guitar name
                }
                else
                {
                    // This is review text
                    currentReviewText.Add(line);
                }
            }
        }

        // Don't forget the last review
        SavePendingReview();

        return reviews;
    }

    public class SeedReviewsRequest
    {
        public string ReviewsText { get; set; } = string.Empty;
        public bool ClearExisting { get; set; } = false;
    }

    /// <summary>
    /// Get all conversations with offers
    /// </summary>
    [HttpGet("conversation-offers")]
    public async Task<IActionResult> GetConversationOffers([FromQuery] string? status = null)
    {
        var conversations = await _mongoDbService.GetConversationsWithOffersAsync(status);

        var result = new List<object>();
        var adminUser = await _mongoDbService.GetAdminUserAsync();

        foreach (var conv in conversations)
        {
            var buyerId = conv.ParticipantIds.FirstOrDefault(p => p != adminUser?.Id);
            var buyer = buyerId != null ? await _mongoDbService.GetUserByIdAsync(buyerId) : null;

            MyListing? listing = null;
            if (conv.ListingId != null)
            {
                listing = await _mongoDbService.GetMyListingByIdAsync(conv.ListingId);
            }

            result.Add(new
            {
                Id = conv.Id,
                BuyerId = buyerId,
                BuyerName = buyer?.FullName ?? "Unknown",
                BuyerEmail = buyer?.Email,
                ListingId = conv.ListingId,
                ListingTitle = listing?.ListingTitle,
                ListingImage = listing?.Images?.FirstOrDefault(),
                ListingPrice = listing?.Price,
                ActiveOfferAmount = conv.ActiveOfferAmount,
                ActiveOfferBy = conv.ActiveOfferBy,
                PendingActionBy = conv.PendingActionBy,
                OfferExpiresAt = conv.OfferExpiresAt,
                OfferStatus = conv.OfferStatus,
                AcceptedAmount = conv.AcceptedAmount,
                LastMessage = conv.LastMessage,
                LastMessageAt = conv.LastMessageAt,
                CreatedAt = conv.CreatedAt
            });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get all orders for admin management
    /// </summary>
    [HttpGet("orders")]
    public async Task<IActionResult> GetAllOrdersForAdmin()
    {
        var orders = await _mongoDbService.GetAllOrdersAsync();

        var result = new List<AdminOrderDto>();
        foreach (var order in orders)
        {
            string buyerName = "";
            string buyerEmail = "";

            // Look up buyer info
            if (!string.IsNullOrEmpty(order.UserId))
            {
                var user = await _mongoDbService.GetUserByIdAsync(order.UserId);
                buyerName = user?.FullName ?? "";
                buyerEmail = user?.Email ?? "";
            }
            else if (!string.IsNullOrEmpty(order.GuestEmail))
            {
                // Guest checkout
                buyerEmail = order.GuestEmail;
                buyerName = order.ShippingAddress?.FullName ?? "Guest";
            }

            result.Add(new AdminOrderDto
            {
                Id = order.Id!,
                PaymentMethod = order.PaymentMethod,
                Items = order.Items.Select(i => new AdminOrderItemDto
                {
                    ListingId = i.ListingId,
                    ListingTitle = i.ListingTitle,
                    Price = i.Price,
                    Currency = i.Currency,
                    Quantity = i.Quantity
                }).ToList(),
                ShippingAddress = new AdminOrderShippingAddressDto
                {
                    FullName = order.ShippingAddress.FullName,
                    Line1 = order.ShippingAddress.Line1,
                    Line2 = order.ShippingAddress.Line2,
                    City = order.ShippingAddress.City,
                    State = order.ShippingAddress.State,
                    PostalCode = order.ShippingAddress.PostalCode,
                    Country = order.ShippingAddress.Country
                },
                TotalAmount = order.TotalAmount,
                Currency = order.Currency,
                Status = order.Status,
                CreatedAt = order.CreatedAt,
                BuyerName = buyerName,
                BuyerEmail = buyerEmail,
                TrackingCarrier = order.TrackingCarrier,
                TrackingNumber = order.TrackingNumber
            });
        }

        // Return newest orders first
        return Ok(result.OrderByDescending(o => o.CreatedAt));
    }

    /// <summary>
    /// Update order tracking information
    /// </summary>
    [HttpPatch("orders/{id}/tracking")]
    public async Task<IActionResult> UpdateOrderTracking(string id, [FromBody] UpdateOrderTrackingRequest request)
    {
        // Get the order first to retrieve buyer email
        var order = await _mongoDbService.GetOrderByIdAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Order not found" });
        }

        // Update tracking
        var success = await _mongoDbService.UpdateOrderTrackingAsync(id, request.TrackingCarrier, request.TrackingNumber);
        if (!success)
        {
            return NotFound(new { error = "Failed to update order" });
        }

        // Send shipping notification email if tracking is being added
        if (!string.IsNullOrEmpty(request.TrackingCarrier) && !string.IsNullOrEmpty(request.TrackingNumber))
        {
            string? buyerEmail = null;

            // Get buyer email from user account or guest email
            if (!string.IsNullOrEmpty(order.UserId))
            {
                var user = await _mongoDbService.GetUserByIdAsync(order.UserId);
                buyerEmail = user?.Email;
            }
            else if (!string.IsNullOrEmpty(order.GuestEmail))
            {
                buyerEmail = order.GuestEmail;
            }

            if (!string.IsNullOrEmpty(buyerEmail))
            {
                var itemTitles = order.Items.Select(i => i.ListingTitle).ToList();
                _ = _emailService.SendOrderShippedNotificationAsync(
                    buyerEmail,
                    order.Id!,
                    request.TrackingCarrier,
                    request.TrackingNumber,
                    itemTitles
                );
            }
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Update order status (e.g., mark as delivered)
    /// </summary>
    [HttpPatch("orders/{id}/status")]
    public async Task<IActionResult> UpdateOrderStatus(string id, [FromBody] UpdateOrderStatusRequest request)
    {
        var validStatuses = new[] { "completed", "shipped", "delivered", "pending" };
        if (string.IsNullOrEmpty(request.Status) || !validStatuses.Contains(request.Status.ToLower()))
        {
            return BadRequest(new { error = "Invalid status. Valid values: completed, shipped, delivered, pending" });
        }

        var success = await _mongoDbService.UpdateOrderStatusAsync(id, request.Status.ToLower());
        if (!success)
        {
            return NotFound(new { error = "Order not found" });
        }

        return Ok(new { success = true });
    }

    public class UpdateOrderStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    public class AdminOrderDto
    {
        public string Id { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public List<AdminOrderItemDto> Items { get; set; } = new();
        public AdminOrderShippingAddressDto ShippingAddress { get; set; } = new();
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string BuyerName { get; set; } = string.Empty;
        public string BuyerEmail { get; set; } = string.Empty;
        public string? TrackingCarrier { get; set; }
        public string? TrackingNumber { get; set; }
    }

    public class UpdateOrderTrackingRequest
    {
        public string? TrackingCarrier { get; set; }
        public string? TrackingNumber { get; set; }
    }

    public class AdminOrderItemDto
    {
        public string ListingId { get; set; } = string.Empty;
        public string ListingTitle { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Currency { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }

    public class AdminOrderShippingAddressDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Line1 { get; set; } = string.Empty;
        public string? Line2 { get; set; }
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
    }

    /// <summary>
    /// Get all pending cart items for admin management
    /// </summary>
    [HttpGet("pending-cart-items")]
    public async Task<IActionResult> GetAllPendingCartItemsForAdmin()
    {
        var items = await _mongoDbService.GetAllPendingCartItemsAsync();

        var result = new List<AdminPendingCartItemDto>();
        foreach (var item in items)
        {
            var buyer = await _mongoDbService.GetUserByIdAsync(item.UserId);

            result.Add(new AdminPendingCartItemDto
            {
                Id = item.Id!,
                UserId = item.UserId,
                ListingId = item.ListingId,
                OfferId = item.OfferId,
                Price = item.Price,
                Currency = item.Currency,
                ListingTitle = item.ListingTitle,
                ListingImage = item.ListingImage,
                CreatedAt = item.CreatedAt,
                ExpiresAt = item.ExpiresAt,
                BuyerName = buyer?.FullName ?? "Unknown",
                BuyerEmail = buyer?.Email ?? ""
            });
        }

        return Ok(result);
    }

    /// <summary>
    /// Cancel a pending cart item and re-enable the listing
    /// </summary>
    [HttpDelete("pending-cart-items/{id}")]
    public async Task<IActionResult> CancelPendingCartItem(string id)
    {
        var item = await _mongoDbService.GetPendingCartItemByIdAsync(id);
        if (item == null)
        {
            return NotFound(new { error = "Pending cart item not found" });
        }

        // Re-enable the listing
        await _mongoDbService.SetListingDisabledAsync(item.ListingId, false);

        // Delete the pending cart item
        var deleted = await _mongoDbService.DeletePendingCartItemAsync(id);
        if (!deleted)
        {
            return StatusCode(500, new { error = "Failed to delete pending cart item" });
        }

        _logger.LogInformation("Admin cancelled pending cart item {Id} for listing {ListingId}", id, item.ListingId);

        return Ok(new { success = true, id, listingId = item.ListingId });
    }

    public class AdminPendingCartItemDto
    {
        public string Id { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string ListingId { get; set; } = string.Empty;
        public string OfferId { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Currency { get; set; } = string.Empty;
        public string ListingTitle { get; set; } = string.Empty;
        public string ListingImage { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public string BuyerName { get; set; } = string.Empty;
        public string BuyerEmail { get; set; } = string.Empty;
    }

    // Deal Finder endpoints

    /// <summary>
    /// Get potential buys with filtering and sorting
    /// </summary>
    [HttpGet("potential-buys")]
    public async Task<IActionResult> GetPotentialBuys(
        [FromQuery] string? status,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 20,
        CancellationToken ct = default)
    {
        try
        {
            var (potentialBuys, totalCount) = await _mongoDbService.GetPotentialBuysAsync(status, sort, page, perPage, ct);
            return Ok(new
            {
                items = potentialBuys,
                total = totalCount,
                page,
                perPage,
                totalPages = (int)Math.Ceiling((double)totalCount / perPage)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get potential buys");
            return StatusCode(500, new { error = "Failed to load deals", details = ex.Message });
        }
    }

    /// <summary>
    /// Get deal finder statistics
    /// </summary>
    [HttpGet("potential-buys/stats")]
    public async Task<IActionResult> GetPotentialBuyStats(CancellationToken ct = default)
    {
        try
        {
            var stats = await _mongoDbService.GetPotentialBuyStatsAsync(ct);
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get potential buy stats");
            return StatusCode(500, new { error = "Failed to load stats", details = ex.Message });
        }
    }

    /// <summary>
    /// Dismiss a potential buy
    /// </summary>
    [HttpPatch("potential-buys/{id}/dismiss")]
    public async Task<IActionResult> DismissPotentialBuy(string id, CancellationToken ct = default)
    {
        var success = await _mongoDbService.UpdatePotentialBuyDismissedAsync(id, true, ct);
        if (!success) return NotFound();
        return Ok(new { message = "Dismissed" });
    }

    /// <summary>
    /// Dismiss multiple potential buys by IDs
    /// </summary>
    [HttpPost("potential-buys/dismiss-bulk")]
    public async Task<IActionResult> DismissPotentialBuysBulk([FromBody] DismissBulkRequest request, CancellationToken ct = default)
    {
        if (request.Ids == null || request.Ids.Count == 0)
        {
            return BadRequest(new { error = "No IDs provided" });
        }

        var count = await _mongoDbService.DismissPotentialBuysByIdsAsync(request.Ids, ct);
        return Ok(new { message = $"Dismissed {count} deals", dismissed = count });
    }

    /// <summary>
    /// Dismiss all active deals
    /// </summary>
    [HttpPost("potential-buys/dismiss-all")]
    public async Task<IActionResult> DismissAllPotentialBuys(CancellationToken ct = default)
    {
        var count = await _mongoDbService.DismissAllActiveDealsAsync(ct);
        return Ok(new { message = $"Dismissed {count} deals", dismissed = count });
    }

    public class DismissBulkRequest
    {
        public List<string> Ids { get; set; } = new();
    }

    /// <summary>
    /// Mark a potential buy as purchased
    /// </summary>
    [HttpPatch("potential-buys/{id}/purchased")]
    public async Task<IActionResult> MarkPotentialBuyPurchased(string id, CancellationToken ct = default)
    {
        var success = await _mongoDbService.UpdatePotentialBuyPurchasedAsync(id, true, ct);
        if (!success) return NotFound();
        return Ok(new { message = "Marked as purchased" });
    }

    /// <summary>
    /// Delete a potential buy
    /// </summary>
    [HttpDelete("potential-buys/{id}")]
    public async Task<IActionResult> DeletePotentialBuy(string id, CancellationToken ct = default)
    {
        var success = await _mongoDbService.DeletePotentialBuyAsync(id, ct);
        if (!success) return NotFound();
        return Ok(new { message = "Deleted" });
    }

    /// <summary>
    /// Run the deal finder scraper
    /// </summary>
    [HttpPost("run-deal-finder")]
    public async Task<IActionResult> RunDealFinder(CancellationToken ct = default)
    {
        _logger.LogInformation("Deal finder scraper requested");

        if (_dealFinderService.IsRunning)
        {
            return Conflict(new
            {
                success = false,
                message = "Deal finder is already running"
            });
        }

        try
        {
            var result = await _dealFinderService.RunAsync(ct);

            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    listingsChecked = result.ListingsChecked,
                    dealsFound = result.DealsFound,
                    duration = result.Duration.ToString()
                });
            }
            else
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = result.Message,
                    error = result.Error
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run deal finder");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to run deal finder",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Check if deal finder is currently running
    /// </summary>
    [HttpGet("deal-finder/status")]
    public IActionResult GetDealFinderStatus()
    {
        return Ok(new { isRunning = _dealFinderService.IsRunning });
    }

    /// <summary>
    /// Clean up old dismissed/purchased potential buys
    /// </summary>
    [HttpPost("potential-buys/cleanup")]
    public async Task<IActionResult> CleanupPotentialBuys(
        [FromQuery] int? olderThanDays,
        [FromQuery] bool deleteDismissed = false,
        [FromQuery] bool deletePurchased = false,
        [FromQuery] bool deleteAll = false,
        CancellationToken ct = default)
    {
        try
        {
            long deletedCount = 0;

            if (deleteAll)
            {
                deletedCount = await _mongoDbService.DeleteAllPotentialBuysAsync(ct);
                _logger.LogInformation("Deleted all {Count} potential buys", deletedCount);
                return Ok(new { success = true, message = $"Deleted all {deletedCount} potential buys", deleted = deletedCount });
            }

            if (deleteDismissed)
            {
                var count = await _mongoDbService.DeleteAllDismissedPotentialBuysAsync(ct);
                deletedCount += count;
                _logger.LogInformation("Deleted {Count} dismissed potential buys", count);
            }

            if (deletePurchased)
            {
                var count = await _mongoDbService.DeleteAllPurchasedPotentialBuysAsync(ct);
                deletedCount += count;
                _logger.LogInformation("Deleted {Count} purchased potential buys", count);
            }

            if (olderThanDays.HasValue && olderThanDays > 0)
            {
                var count = await _mongoDbService.DeleteOldResolvedPotentialBuysAsync(olderThanDays.Value, ct);
                deletedCount += count;
                _logger.LogInformation("Deleted {Count} potential buys older than {Days} days", count, olderThanDays);
            }

            return Ok(new { success = true, message = $"Cleanup complete", deleted = deletedCount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cleanup potential buys");
            return StatusCode(500, new { error = "Failed to cleanup", details = ex.Message });
        }
    }

    // Sweetwater Deal Finder endpoints

    [HttpGet("sweetwater-potential-buys")]
    public async Task<IActionResult> GetSweetwaterPotentialBuys(
        [FromQuery] string? status,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 20,
        CancellationToken ct = default)
    {
        try
        {
            var (potentialBuys, totalCount) = await _mongoDbService.GetSweetwaterPotentialBuysAsync(status, sort, page, perPage, ct);
            return Ok(new
            {
                items = potentialBuys,
                total = totalCount,
                page,
                perPage,
                totalPages = (int)Math.Ceiling((double)totalCount / perPage)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Sweetwater potential buys");
            return StatusCode(500, new { error = "Failed to load Sweetwater deals", details = ex.Message });
        }
    }

    [HttpGet("sweetwater-potential-buys/stats")]
    public async Task<IActionResult> GetSweetwaterPotentialBuyStats(CancellationToken ct = default)
    {
        try
        {
            var stats = await _mongoDbService.GetSweetwaterPotentialBuyStatsAsync(ct);
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Sweetwater potential buy stats");
            return StatusCode(500, new { error = "Failed to load stats", details = ex.Message });
        }
    }

    [HttpPatch("sweetwater-potential-buys/{id}/dismiss")]
    public async Task<IActionResult> DismissSweetwaterPotentialBuy(string id, CancellationToken ct = default)
    {
        var success = await _mongoDbService.UpdateSweetwaterPotentialBuyDismissedAsync(id, true, ct);
        if (!success) return NotFound();
        return Ok(new { message = "Dismissed" });
    }

    [HttpPost("sweetwater-potential-buys/dismiss-bulk")]
    public async Task<IActionResult> DismissSweetwaterPotentialBuysBulk([FromBody] DismissBulkRequest request, CancellationToken ct = default)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return BadRequest(new { error = "No IDs provided" });

        var count = await _mongoDbService.DismissSweetwaterPotentialBuysByIdsAsync(request.Ids, ct);
        return Ok(new { message = $"Dismissed {count} deals", dismissed = count });
    }

    [HttpPost("sweetwater-potential-buys/dismiss-all")]
    public async Task<IActionResult> DismissAllSweetwaterPotentialBuys(CancellationToken ct = default)
    {
        var count = await _mongoDbService.DismissAllActiveSweetwaterDealsAsync(ct);
        return Ok(new { message = $"Dismissed {count} deals", dismissed = count });
    }

    [HttpPatch("sweetwater-potential-buys/{id}/purchased")]
    public async Task<IActionResult> MarkSweetwaterPotentialBuyPurchased(string id, CancellationToken ct = default)
    {
        var success = await _mongoDbService.UpdateSweetwaterPotentialBuyPurchasedAsync(id, true, ct);
        if (!success) return NotFound();
        return Ok(new { message = "Marked as purchased" });
    }

    [HttpPost("run-sweetwater-deal-finder")]
    public async Task<IActionResult> RunSweetwaterDealFinder(CancellationToken ct = default)
    {
        _logger.LogInformation("Sweetwater deal finder requested");

        if (_sweetwaterDealFinderService.IsRunning)
        {
            return Conflict(new
            {
                success = false,
                message = "Sweetwater deal finder is already running"
            });
        }

        try
        {
            var result = await _sweetwaterDealFinderService.RunAsync(ct);

            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    listingsChecked = result.ListingsChecked,
                    dealsFound = result.DealsFound,
                    duration = result.Duration.ToString()
                });
            }
            else
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = result.Message,
                    error = result.Error
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run Sweetwater deal finder");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to run Sweetwater deal finder",
                error = ex.Message
            });
        }
    }

    [HttpGet("sweetwater-deal-finder/status")]
    public IActionResult GetSweetwaterDealFinderStatus()
    {
        return Ok(new { isRunning = _sweetwaterDealFinderService.IsRunning });
    }

    [HttpPost("sweetwater-potential-buys/cleanup")]
    public async Task<IActionResult> CleanupSweetwaterPotentialBuys(
        [FromQuery] bool deleteAll = false,
        CancellationToken ct = default)
    {
        try
        {
            if (deleteAll)
            {
                var deletedCount = await _mongoDbService.DeleteAllSweetwaterPotentialBuysAsync(ct);
                return Ok(new { success = true, message = $"Deleted all {deletedCount} Sweetwater potential buys", deleted = deletedCount });
            }

            return Ok(new { success = true, message = "No action taken", deleted = 0 });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cleanup Sweetwater potential buys");
            return StatusCode(500, new { error = "Failed to cleanup", details = ex.Message });
        }
    }

    // User Management endpoints

    /// <summary>
    /// Get all users with optional search and filters for admin management
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsersForAdmin(
        [FromQuery] string? search = null,
        [FromQuery] bool? isAdmin = null,
        [FromQuery] bool? isGuest = null,
        [FromQuery] bool? emailVerified = null,
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 20)
    {
        try
        {
            var (users, totalCount) = await _mongoDbService.GetUsersAsync(search, isAdmin, isGuest, emailVerified, page, perPage);

            var result = users.Select(u => new AdminUserDto
            {
                Id = u.Id!,
                Email = u.Email,
                FullName = u.FullName,
                CreatedAt = u.CreatedAt,
                IsGuest = u.IsGuest,
                GuestSessionId = u.GuestSessionId,
                ShippingAddress = u.ShippingAddress != null ? new AdminUserShippingAddressDto
                {
                    FullName = u.ShippingAddress.FullName,
                    Line1 = u.ShippingAddress.Line1,
                    Line2 = u.ShippingAddress.Line2,
                    City = u.ShippingAddress.City,
                    State = u.ShippingAddress.State,
                    PostalCode = u.ShippingAddress.PostalCode,
                    Country = u.ShippingAddress.Country
                } : null,
                IsAdmin = u.IsAdmin,
                EmailVerified = u.EmailVerified
            }).ToList();

            return Ok(new PaginatedUsersResponse
            {
                Items = result,
                Total = (int)totalCount,
                Page = page,
                PerPage = perPage,
                TotalPages = (int)Math.Ceiling((double)totalCount / perPage)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get users");
            return StatusCode(500, new { error = "Failed to load users", details = ex.Message });
        }
    }

    /// <summary>
    /// Get a single user by ID (admin only)
    /// </summary>
    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUserById(string id)
    {
        var user = await _mongoDbService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            fullName = user.FullName,
            isAdmin = user.IsAdmin,
            isGuest = user.IsGuest,
            emailVerified = user.EmailVerified,
            createdAt = user.CreatedAt,
            guestSessionId = user.GuestSessionId,
            shippingAddress = user.ShippingAddress != null ? new
            {
                fullName = user.ShippingAddress.FullName,
                line1 = user.ShippingAddress.Line1,
                line2 = user.ShippingAddress.Line2,
                city = user.ShippingAddress.City,
                state = user.ShippingAddress.State,
                postalCode = user.ShippingAddress.PostalCode,
                country = user.ShippingAddress.Country
            } : null
        });
    }

    /// <summary>
    /// Get orders for a specific user (admin only)
    /// </summary>
    [HttpGet("users/{id}/orders")]
    public async Task<IActionResult> GetUserOrders(string id)
    {
        var user = await _mongoDbService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        var orders = await _mongoDbService.GetOrdersByUserIdAsync(id);

        return Ok(orders.Select(o => new
        {
            id = o.Id,
            paymentMethod = o.PaymentMethod,
            items = o.Items.Select(i => new
            {
                listingId = i.ListingId,
                listingTitle = i.ListingTitle,
                price = i.Price,
                currency = i.Currency,
                quantity = i.Quantity
            }),
            shippingAddress = new
            {
                fullName = o.ShippingAddress.FullName,
                line1 = o.ShippingAddress.Line1,
                line2 = o.ShippingAddress.Line2,
                city = o.ShippingAddress.City,
                state = o.ShippingAddress.State,
                postalCode = o.ShippingAddress.PostalCode,
                country = o.ShippingAddress.Country
            },
            totalAmount = o.TotalAmount,
            currency = o.Currency,
            status = o.Status,
            createdAt = o.CreatedAt,
            trackingCarrier = o.TrackingCarrier,
            trackingNumber = o.TrackingNumber
        }));
    }

    /// <summary>
    /// Update a user's details (admin only)
    /// </summary>
    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
    {
        var user = await _mongoDbService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        // Get current admin's ID from JWT claims
        var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        // Prevent admin from removing their own admin status
        if (id == currentUserId && request.IsAdmin == false && user.IsAdmin)
        {
            return BadRequest(new { error = "Cannot remove your own admin status" });
        }

        // Check for email uniqueness if email is being changed
        if (!string.IsNullOrEmpty(request.Email) && request.Email.ToLowerInvariant() != user.Email?.ToLowerInvariant())
        {
            var existingUser = await _mongoDbService.GetUserByEmailAsync(request.Email);
            if (existingUser != null)
            {
                return BadRequest(new { error = "Email is already in use by another user" });
            }
            user.Email = request.Email.ToLowerInvariant();
        }

        // Update fields if provided
        if (!string.IsNullOrEmpty(request.FullName))
        {
            user.FullName = request.FullName;
        }

        if (request.IsAdmin.HasValue)
        {
            user.IsAdmin = request.IsAdmin.Value;
        }

        if (request.EmailVerified.HasValue)
        {
            user.EmailVerified = request.EmailVerified.Value;
        }

        if (request.IsGuest.HasValue)
        {
            user.IsGuest = request.IsGuest.Value;
        }

        if (request.ShippingAddress != null)
        {
            user.ShippingAddress = new Models.UserShippingAddress
            {
                FullName = request.ShippingAddress.FullName,
                Line1 = request.ShippingAddress.Line1,
                Line2 = request.ShippingAddress.Line2,
                City = request.ShippingAddress.City,
                State = request.ShippingAddress.State,
                PostalCode = request.ShippingAddress.PostalCode,
                Country = request.ShippingAddress.Country
            };
        }
        else if (request.ClearShippingAddress == true)
        {
            user.ShippingAddress = null;
        }

        var success = await _mongoDbService.UpdateUserAsync(id, user);
        if (!success)
        {
            return StatusCode(500, new { error = "Failed to update user" });
        }

        _logger.LogInformation("Admin updated user: {UserId}", id);

        return Ok(new AdminUserDto
        {
            Id = user.Id!,
            Email = user.Email,
            FullName = user.FullName,
            CreatedAt = user.CreatedAt,
            IsGuest = user.IsGuest,
            GuestSessionId = user.GuestSessionId,
            ShippingAddress = user.ShippingAddress != null ? new AdminUserShippingAddressDto
            {
                FullName = user.ShippingAddress.FullName,
                Line1 = user.ShippingAddress.Line1,
                Line2 = user.ShippingAddress.Line2,
                City = user.ShippingAddress.City,
                State = user.ShippingAddress.State,
                PostalCode = user.ShippingAddress.PostalCode,
                Country = user.ShippingAddress.Country
            } : null,
            IsAdmin = user.IsAdmin,
            EmailVerified = user.EmailVerified
        });
    }

    /// <summary>
    /// Delete a user and all associated data (admin only)
    /// </summary>
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var user = await _mongoDbService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        // Get current admin's ID from JWT claims
        var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        // Prevent admin from deleting themselves
        if (id == currentUserId)
        {
            return BadRequest(new { error = "Cannot delete your own account" });
        }

        // Delete all related data first
        await _mongoDbService.DeleteUserRelatedDataAsync(id);

        // Delete the user
        var success = await _mongoDbService.DeleteUserAsync(id);
        if (!success)
        {
            return StatusCode(500, new { error = "Failed to delete user" });
        }

        _logger.LogInformation("Admin deleted user: {UserId} ({Email})", id, user.Email ?? user.GuestSessionId);

        return Ok(new { success = true, message = "User deleted successfully" });
    }

    // User Management DTOs
    public class AdminUserDto
    {
        public string Id { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string FullName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsGuest { get; set; }
        public string? GuestSessionId { get; set; }
        public AdminUserShippingAddressDto? ShippingAddress { get; set; }
        public bool IsAdmin { get; set; }
        public bool EmailVerified { get; set; }
    }

    public class AdminUserShippingAddressDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Line1 { get; set; } = string.Empty;
        public string? Line2 { get; set; }
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
    }

    public class PaginatedUsersResponse
    {
        public List<AdminUserDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PerPage { get; set; }
        public int TotalPages { get; set; }
    }

    public class UpdateUserRequest
    {
        public string? Email { get; set; }
        public string? FullName { get; set; }
        public bool? IsAdmin { get; set; }
        public bool? EmailVerified { get; set; }
        public bool? IsGuest { get; set; }
        public AdminUserShippingAddressDto? ShippingAddress { get; set; }
        public bool? ClearShippingAddress { get; set; }
    }

    // === Transactions ===

    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions([FromQuery] int? year, [FromQuery] int? month)
    {
        try
        {
            var transactions = await _mongoDbService.GetTransactionsAsync(year, month);
            return Ok(transactions.Select(t => new
            {
                id = t.Id,
                date = t.Date,
                guitarName = t.GuitarName,
                purchasePrice = t.PurchasePrice,
                transactionType = t.TransactionType,
                soldVia = t.SoldVia,
                tradeFor = t.TradeFor,
                revenue = t.Revenue,
                shippingCost = t.ShippingCost,
                profit = t.Profit,
                trackingCarrier = t.TrackingCarrier,
                trackingNumber = t.TrackingNumber,
                createdAt = t.CreatedAt,
                updatedAt = t.UpdatedAt
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch transactions");
            return StatusCode(500, new { error = "Failed to fetch transactions" });
        }
    }

    [HttpPost("transactions")]
    public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionRequest request)
    {
        try
        {
            var transaction = new Transaction
            {
                Date = request.Date.ToUniversalTime(),
                GuitarName = request.GuitarName,
                PurchasePrice = request.PurchasePrice,
                TransactionType = request.TransactionType,
                SoldVia = request.SoldVia,
                TradeFor = request.TradeFor,
                Revenue = request.Revenue,
                ShippingCost = request.ShippingCost,
                Profit = request.Profit,
                TrackingCarrier = request.TrackingCarrier,
                TrackingNumber = request.TrackingNumber,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _mongoDbService.CreateTransactionAsync(transaction);
            return Ok(new { id = transaction.Id, message = "Transaction created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create transaction");
            return StatusCode(500, new { error = "Failed to create transaction" });
        }
    }

    [HttpPut("transactions/{id}")]
    public async Task<IActionResult> UpdateTransaction(string id, [FromBody] CreateTransactionRequest request)
    {
        try
        {
            var existing = await _mongoDbService.GetTransactionByIdAsync(id);
            if (existing == null) return NotFound(new { error = "Transaction not found" });

            existing.Date = request.Date.ToUniversalTime();
            existing.GuitarName = request.GuitarName;
            existing.PurchasePrice = request.PurchasePrice;
            existing.TransactionType = request.TransactionType;
            existing.SoldVia = request.SoldVia;
            existing.TradeFor = request.TradeFor;
            existing.Revenue = request.Revenue;
            existing.ShippingCost = request.ShippingCost;
            existing.Profit = request.Profit;
            existing.TrackingCarrier = request.TrackingCarrier;
            existing.TrackingNumber = request.TrackingNumber;

            await _mongoDbService.UpdateTransactionAsync(id, existing);
            return Ok(new { message = "Transaction updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update transaction");
            return StatusCode(500, new { error = "Failed to update transaction" });
        }
    }

    [HttpDelete("transactions/{id}")]
    public async Task<IActionResult> DeleteTransaction(string id)
    {
        try
        {
            var existing = await _mongoDbService.GetTransactionByIdAsync(id);
            if (existing == null) return NotFound(new { error = "Transaction not found" });

            await _mongoDbService.DeleteTransactionAsync(id);
            return Ok(new { message = "Transaction deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete transaction");
            return StatusCode(500, new { error = "Failed to delete transaction" });
        }
    }

    [HttpPost("transactions/import")]
    public async Task<IActionResult> ImportTransactions([FromBody] List<CreateTransactionRequest> requests)
    {
        try
        {
            var transactions = requests.Select(r => new Transaction
            {
                Date = r.Date.ToUniversalTime(),
                GuitarName = r.GuitarName,
                PurchasePrice = r.PurchasePrice,
                TransactionType = r.TransactionType,
                SoldVia = r.SoldVia,
                TradeFor = r.TradeFor,
                Revenue = r.Revenue,
                ShippingCost = r.ShippingCost,
                Profit = r.Profit,
                TrackingCarrier = r.TrackingCarrier,
                TrackingNumber = r.TrackingNumber,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }).ToList();

            await _mongoDbService.CreateTransactionsManyAsync(transactions);
            return Ok(new { message = $"Imported {transactions.Count} transactions" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import transactions");
            return StatusCode(500, new { error = "Failed to import transactions" });
        }
    }

    // === Extra Expenses ===

    [HttpGet("extra-expenses")]
    public async Task<IActionResult> GetExtraExpenses()
    {
        try
        {
            var expenses = await _mongoDbService.GetExtraExpensesAsync();
            return Ok(expenses.Select(e => new
            {
                id = e.Id,
                date = e.Date,
                category = e.Category,
                cost = e.Cost,
                createdAt = e.CreatedAt
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch extra expenses");
            return StatusCode(500, new { error = "Failed to fetch extra expenses" });
        }
    }

    [HttpPost("extra-expenses")]
    public async Task<IActionResult> CreateExtraExpense([FromBody] CreateExtraExpenseRequest request)
    {
        try
        {
            var expense = new ExtraExpense
            {
                Date = request.Date.ToUniversalTime(),
                Category = request.Category,
                Cost = request.Cost,
                CreatedAt = DateTime.UtcNow
            };
            await _mongoDbService.CreateExtraExpenseAsync(expense);
            return Ok(new { id = expense.Id, message = "Expense created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create extra expense");
            return StatusCode(500, new { error = "Failed to create extra expense" });
        }
    }

    [HttpPut("extra-expenses/{id}")]
    public async Task<IActionResult> UpdateExtraExpense(string id, [FromBody] CreateExtraExpenseRequest request)
    {
        try
        {
            var existing = await _mongoDbService.GetExtraExpenseByIdAsync(id);
            if (existing == null) return NotFound(new { error = "Expense not found" });

            existing.Date = request.Date.ToUniversalTime();
            existing.Category = request.Category;
            existing.Cost = request.Cost;

            await _mongoDbService.UpdateExtraExpenseAsync(id, existing);
            return Ok(new { message = "Expense updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update extra expense");
            return StatusCode(500, new { error = "Failed to update extra expense" });
        }
    }

    [HttpDelete("extra-expenses/{id}")]
    public async Task<IActionResult> DeleteExtraExpense(string id)
    {
        try
        {
            var existing = await _mongoDbService.GetExtraExpenseByIdAsync(id);
            if (existing == null) return NotFound(new { error = "Expense not found" });

            await _mongoDbService.DeleteExtraExpenseAsync(id);
            return Ok(new { message = "Expense deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete extra expense");
            return StatusCode(500, new { error = "Failed to delete extra expense" });
        }
    }

    // === Monthly Snapshots ===

    [HttpGet("monthly-snapshots")]
    public async Task<IActionResult> GetMonthlySnapshots()
    {
        try
        {
            var snapshots = await _mongoDbService.GetMonthlySnapshotsAsync();
            return Ok(snapshots.Select(s => new
            {
                id = s.Id,
                year = s.Year,
                month = s.Month,
                cumulativeProfit = s.CumulativeProfit
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch monthly snapshots");
            return StatusCode(500, new { error = "Failed to fetch monthly snapshots" });
        }
    }

    [HttpPost("monthly-snapshots/import")]
    public async Task<IActionResult> ImportMonthlySnapshots([FromBody] List<MonthlySnapshotRequest> requests)
    {
        try
        {
            var snapshots = requests.Select(r => new MonthlySnapshot
            {
                Year = r.Year,
                Month = r.Month,
                CumulativeProfit = r.CumulativeProfit,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            await _mongoDbService.ImportMonthlySnapshotsAsync(snapshots);
            return Ok(new { message = $"Imported {snapshots.Count} monthly snapshots" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import monthly snapshots");
            return StatusCode(500, new { error = "Failed to import monthly snapshots" });
        }
    }

    // === Finance Summary ===

    [HttpGet("finance-summary")]
    public async Task<IActionResult> GetFinanceSummary()
    {
        try
        {
            var (totalRevenue, totalExpenses, totalProfit, platformStats, allExpenses) =
                await _mongoDbService.GetFinanceSummaryAsync();

            // Monthly breakdown
            var transactions = await _mongoDbService.GetTransactionsAsync();
            var monthlyData = transactions
                .Where(t => t.Profit.HasValue)
                .GroupBy(t => new { t.Date.Year, t.Date.Month })
                .Select(g => new
                {
                    year = g.Key.Year,
                    month = g.Key.Month,
                    profit = g.Sum(t => t.Profit!.Value),
                    revenue = g.Where(t => t.Revenue.HasValue).Sum(t => t.Revenue!.Value),
                    count = g.Count()
                })
                .OrderBy(m => m.year).ThenBy(m => m.month)
                .ToList();

            // Group expenses by year/month
            var expensesByMonth = allExpenses
                .GroupBy(e => new { e.Date.Year, e.Date.Month })
                .ToDictionary(g => (g.Key.Year, g.Key.Month), g => g.Sum(e => e.Cost));

            var snapshots = await _mongoDbService.GetMonthlySnapshotsAsync();

            return Ok(new
            {
                totalRevenue,
                totalExpenses,
                totalProfit = totalProfit - totalExpenses,
                grossProfit = totalProfit,
                platformStats = platformStats.Select(p => new
                {
                    platform = p.Platform,
                    count = p.Count,
                    totalProfit = p.TotalProfit,
                    totalRevenue = p.TotalRevenue
                }),
                monthlyBreakdown = monthlyData.Select(m => new
                {
                    m.year,
                    m.month,
                    m.profit,
                    m.revenue,
                    m.count,
                    expenses = expensesByMonth.TryGetValue((m.year, m.month), out var exp) ? exp : 0m
                }),
                monthlySnapshots = snapshots.Select(s => new
                {
                    year = s.Year,
                    month = s.Month,
                    cumulativeProfit = s.CumulativeProfit
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get finance summary");
            return StatusCode(500, new { error = "Failed to get finance summary" });
        }
    }
}

public class CreateTransactionRequest
{
    public DateTime Date { get; set; }
    public string GuitarName { get; set; } = string.Empty;
    public decimal? PurchasePrice { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string? SoldVia { get; set; }
    public List<string>? TradeFor { get; set; }
    public decimal? Revenue { get; set; }
    public decimal? ShippingCost { get; set; }
    public decimal? Profit { get; set; }
    public string? TrackingCarrier { get; set; }
    public string? TrackingNumber { get; set; }
}

public class CreateExtraExpenseRequest
{
    public DateTime Date { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal Cost { get; set; }
}

public class MonthlySnapshotRequest
{
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal CumulativeProfit { get; set; }
}
