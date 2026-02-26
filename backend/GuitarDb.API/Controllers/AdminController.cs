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
    private readonly EmailService _emailService;
    private readonly DealFinderService _dealFinderService;

    public AdminController(
        ILogger<AdminController> logger,
        IConfiguration configuration,
        MongoDbService mongoDbService,
        ScraperService scraperService,
        EmailService emailService,
        DealFinderService dealFinderService)
    {
        _logger = logger;
        _configuration = configuration;
        _mongoDbService = mongoDbService;
        _scraperService = scraperService;
        _emailService = emailService;
        _dealFinderService = dealFinderService;
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
    /// Get all offers for admin management
    /// </summary>
    [HttpGet("offers")]
    public async Task<IActionResult> GetAllOffersForAdmin([FromQuery] string? status = null, [FromQuery] string? listingId = null)
    {
        var offers = await _mongoDbService.GetAllOffersAsync(status);

        if (!string.IsNullOrEmpty(listingId))
        {
            offers = offers.Where(o => o.ListingId == listingId).ToList();
        }

        var result = new List<AdminOfferDto>();
        foreach (var offer in offers)
        {
            var listing = await _mongoDbService.GetMyListingByIdAsync(offer.ListingId);
            var buyer = await _mongoDbService.GetUserByIdAsync(offer.BuyerId);

            result.Add(new AdminOfferDto
            {
                Id = offer.Id!,
                ListingId = offer.ListingId,
                BuyerId = offer.BuyerId,
                BuyerName = buyer?.FullName ?? "Unknown",
                BuyerEmail = buyer?.Email ?? "",
                InitialOfferAmount = offer.InitialOfferAmount,
                CurrentOfferAmount = offer.CurrentOfferAmount,
                CounterOfferAmount = offer.CounterOfferAmount,
                Status = offer.Status,
                CreatedAt = offer.CreatedAt,
                UpdatedAt = offer.UpdatedAt,
                ListingTitle = listing?.ListingTitle ?? "Unknown Listing",
                ListingPrice = listing?.Price ?? 0,
                ListingCurrency = listing?.Currency ?? "USD",
                ListingImage = listing?.Images?.FirstOrDefault(),
                ListingDisabled = listing?.Disabled ?? false
            });
        }

        return Ok(result);
    }

    /// <summary>
    /// Admin counter-offer
    /// </summary>
    [HttpPut("offers/{offerId}/counter")]
    public async Task<IActionResult> AdminCounterOffer(string offerId, [FromBody] AdminCounterOfferRequest request)
    {
        if (request.CounterAmount <= 0)
        {
            return BadRequest(new { error = "Counter offer amount must be positive" });
        }

        var offer = await _mongoDbService.GetOfferByIdAsync(offerId);
        if (offer == null)
        {
            return NotFound(new { error = "Offer not found" });
        }

        if (offer.Status != OfferStatus.Pending && offer.Status != OfferStatus.Countered)
        {
            return BadRequest(new { error = "Cannot counter this offer - it has already been accepted or rejected" });
        }

        await _mongoDbService.UpdateOfferCounterAsync(offerId, request.CounterAmount);

        await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
        {
            SenderId = null,
            MessageText = $"Counter offer of {request.CounterAmount:C} submitted by seller",
            IsSystemMessage = true
        });

        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
            {
                SenderId = null,
                MessageText = $"Seller: {request.Message}",
                IsSystemMessage = false
            });
        }

        _logger.LogInformation("Admin counter offer on {OfferId}: {Amount}", offerId, request.CounterAmount);

        // Send email notification to buyer
        var buyer = await _mongoDbService.GetUserByIdAsync(offer.BuyerId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(offer.ListingId);
        if (buyer?.Email != null && listing != null)
        {
            _ = _emailService.SendCounterOfferNotificationAsync(
                buyer.Email,
                listing.ListingTitle,
                offer.CurrentOfferAmount,
                request.CounterAmount,
                request.Message);
        }

        return Ok(new { success = true, offerId, counterAmount = request.CounterAmount });
    }

    /// <summary>
    /// Admin accept offer
    /// </summary>
    [HttpPut("offers/{offerId}/accept")]
    public async Task<IActionResult> AdminAcceptOffer(string offerId)
    {
        var offer = await _mongoDbService.GetOfferByIdAsync(offerId);
        if (offer == null)
        {
            return NotFound(new { error = "Offer not found" });
        }

        if (offer.Status == OfferStatus.Accepted)
        {
            return BadRequest(new { error = "Offer has already been accepted" });
        }

        if (offer.Status == OfferStatus.Rejected)
        {
            return BadRequest(new { error = "Cannot accept a rejected offer" });
        }

        await _mongoDbService.UpdateOfferStatusAsync(offerId, OfferStatus.Accepted);
        await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
        {
            SenderId = null,
            MessageText = $"Offer of {offer.CurrentOfferAmount:C} accepted by seller",
            IsSystemMessage = true
        });

        _logger.LogInformation("Admin accepted offer: {OfferId}", offerId);

        // Fetch listing and buyer for pending cart item and notifications
        var listing = await _mongoDbService.GetMyListingByIdAsync(offer.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(offer.BuyerId);

        // Disable the listing and create pending cart item for the buyer
        if (listing != null)
        {
            await _mongoDbService.SetListingDisabledAsync(offer.ListingId, true);

            var pendingCartItem = new PendingCartItem
            {
                UserId = offer.BuyerId,
                ListingId = offer.ListingId,
                OfferId = offerId,
                Price = offer.CurrentOfferAmount,
                Currency = listing.Currency,
                ListingTitle = listing.ListingTitle,
                ListingImage = listing.Images?.FirstOrDefault() ?? "",
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(72)
            };
            await _mongoDbService.CreatePendingCartItemAsync(pendingCartItem);
            _logger.LogInformation("Admin created pending cart item for buyer {BuyerId} on listing {ListingId}", offer.BuyerId, offer.ListingId);

            // Auto-reject all other offers on this listing
            var rejectedOffers = await _mongoDbService.RejectOtherOffersOnListingAsync(offer.ListingId, offerId);
            _logger.LogInformation("Admin auto-rejected {Count} other offers on listing {ListingId}", rejectedOffers.Count, offer.ListingId);

            // Send rejection emails to other buyers
            foreach (var rejectedOffer in rejectedOffers)
            {
                var rejectedBuyer = await _mongoDbService.GetUserByIdAsync(rejectedOffer.BuyerId);
                if (rejectedBuyer?.Email != null)
                {
                    _ = _emailService.SendOfferRejectedNotificationAsync(
                        rejectedBuyer.Email,
                        listing.ListingTitle,
                        rejectedOffer.CurrentOfferAmount,
                        "Another offer was accepted for this item.");
                }
            }
        }

        // Send email notification to buyer
        if (buyer?.Email != null && listing != null)
        {
            _ = _emailService.SendOfferAcceptedNotificationAsync(
                buyer.Email,
                listing.ListingTitle,
                offer.CurrentOfferAmount,
                isBuyer: true);
        }

        return Ok(new { success = true, offerId, status = OfferStatus.Accepted });
    }

    /// <summary>
    /// Admin reject offer
    /// </summary>
    [HttpPut("offers/{offerId}/reject")]
    public async Task<IActionResult> AdminRejectOffer(string offerId, [FromBody] AdminRejectOfferRequest? request = null)
    {
        var offer = await _mongoDbService.GetOfferByIdAsync(offerId);
        if (offer == null)
        {
            return NotFound(new { error = "Offer not found" });
        }

        if (offer.Status == OfferStatus.Accepted)
        {
            return BadRequest(new { error = "Cannot reject an accepted offer" });
        }

        if (offer.Status == OfferStatus.Rejected)
        {
            return BadRequest(new { error = "Offer has already been rejected" });
        }

        await _mongoDbService.UpdateOfferStatusAsync(offerId, OfferStatus.Rejected);
        await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
        {
            SenderId = null,
            MessageText = "Offer rejected by seller",
            IsSystemMessage = true
        });

        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
            {
                SenderId = null,
                MessageText = $"Seller: {request.Reason}",
                IsSystemMessage = false
            });
        }

        _logger.LogInformation("Admin rejected offer: {OfferId}", offerId);

        // Send email notification to buyer
        var buyer = await _mongoDbService.GetUserByIdAsync(offer.BuyerId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(offer.ListingId);
        if (buyer?.Email != null && listing != null)
        {
            _ = _emailService.SendOfferRejectedNotificationAsync(
                buyer.Email,
                listing.ListingTitle,
                offer.CurrentOfferAmount,
                request?.Reason);
        }

        return Ok(new { success = true, offerId, status = OfferStatus.Rejected });
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
                BuyerEmail = buyerEmail
            });
        }

        // Return newest orders first
        return Ok(result.OrderByDescending(o => o.CreatedAt));
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

    public class AdminOfferDto
    {
        public string Id { get; set; } = string.Empty;
        public string ListingId { get; set; } = string.Empty;
        public string BuyerId { get; set; } = string.Empty;
        public string BuyerName { get; set; } = string.Empty;
        public string BuyerEmail { get; set; } = string.Empty;
        public decimal InitialOfferAmount { get; set; }
        public decimal CurrentOfferAmount { get; set; }
        public decimal? CounterOfferAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string ListingTitle { get; set; } = string.Empty;
        public decimal ListingPrice { get; set; }
        public string ListingCurrency { get; set; } = string.Empty;
        public string? ListingImage { get; set; }
        public bool ListingDisabled { get; set; }
    }

    public class AdminCounterOfferRequest
    {
        public decimal CounterAmount { get; set; }
        public string? Message { get; set; }
    }

    public class AdminRejectOfferRequest
    {
        public string? Reason { get; set; }
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
}
