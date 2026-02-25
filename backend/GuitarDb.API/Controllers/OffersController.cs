using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/offers")]
[Authorize]
public class OffersController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly ILogger<OffersController> _logger;

    public OffersController(
        MongoDbService mongoDbService,
        EmailService emailService,
        ILogger<OffersController> logger)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new offer (buyer)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateOffer([FromBody] CreateOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (request.OfferAmount <= 0)
        {
            return BadRequest(new { error = "Offer amount must be positive" });
        }

        if (request.OfferAmount > 99999)
        {
            return BadRequest(new { error = "Offer amount cannot exceed $99,999" });
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        if (listing.Disabled)
        {
            return BadRequest(new { error = "This listing is no longer available" });
        }

        // Check if buyer already has an active offer on this listing
        var existingOffer = await _mongoDbService.GetActiveOfferByBuyerAndListingAsync(userId, request.ListingId);
        if (existingOffer != null)
        {
            return BadRequest(new { error = "You already have an active offer on this listing" });
        }

        var offer = new Offer
        {
            ListingId = request.ListingId,
            BuyerId = userId,
            InitialOfferAmount = request.OfferAmount,
            CurrentOfferAmount = request.OfferAmount,
            Status = OfferStatus.Pending
        };

        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            offer.Messages.Add(new OfferMessage
            {
                SenderId = userId,
                MessageText = request.Message,
                IsSystemMessage = false
            });
        }

        // Add system message
        offer.Messages.Add(new OfferMessage
        {
            SenderId = userId,
            MessageText = $"Offer of {request.OfferAmount:C} submitted",
            IsSystemMessage = true
        });

        await _mongoDbService.CreateOfferAsync(offer);

        // Send email notification to seller
        var buyer = await _mongoDbService.GetUserByIdAsync(userId);
        _ = _emailService.SendNewOfferNotificationAsync(
            listing.ListingTitle,
            request.OfferAmount,
            buyer?.FullName ?? "Unknown Buyer",
            request.Message);

        return Ok(await MapToOfferDto(offer));
    }

    /// <summary>
    /// Get all offers for current user (buyer view)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyOffers([FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var offers = await _mongoDbService.GetOffersByBuyerAsync(userId);

        if (!string.IsNullOrEmpty(status))
        {
            offers = offers.Where(o => o.Status == status).ToList();
        }

        var result = new List<OfferDto>();
        foreach (var offer in offers)
        {
            result.Add(await MapToOfferDto(offer));
        }

        return Ok(result);
    }

    /// <summary>
    /// Get offers for a specific listing (seller view)
    /// </summary>
    [HttpGet("listing/{listingId}")]
    public async Task<IActionResult> GetOffersForListing(string listingId, [FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        // Note: In a full implementation, you'd verify the user is the seller/admin
        // For now, we allow any authenticated user to view offers on listings

        var offers = await _mongoDbService.GetOffersByListingAsync(listingId);

        if (!string.IsNullOrEmpty(status))
        {
            offers = offers.Where(o => o.Status == status).ToList();
        }

        var result = new List<OfferDto>();
        foreach (var offer in offers)
        {
            result.Add(await MapToOfferDto(offer));
        }

        return Ok(result);
    }

    /// <summary>
    /// Get offer details
    /// </summary>
    [HttpGet("{offerId}")]
    public async Task<IActionResult> GetOffer(string offerId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var offer = await _mongoDbService.GetOfferByIdAsync(offerId);
        if (offer == null)
        {
            return NotFound(new { error = "Offer not found" });
        }

        // Authorization: buyer can view their own offers
        if (offer.BuyerId != userId)
        {
            // Allow seller/admin to view (simplified - in full app, check listing ownership)
            // For now, return the offer
        }

        return Ok(await MapToOfferDto(offer));
    }

    /// <summary>
    /// Seller makes counter-offer
    /// </summary>
    [HttpPut("{offerId}/counter")]
    public async Task<IActionResult> CounterOffer(string offerId, [FromBody] CounterOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

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

        // Add system message
        await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
        {
            SenderId = userId,
            MessageText = $"Counter offer of {request.CounterAmount:C} submitted",
            IsSystemMessage = true
        });

        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
            {
                SenderId = userId,
                MessageText = request.Message,
                IsSystemMessage = false
            });
        }

        _logger.LogInformation("Counter offer on {OfferId}: {Amount}", offerId, request.CounterAmount);

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

        var updatedOffer = await _mongoDbService.GetOfferByIdAsync(offerId);
        return Ok(await MapToOfferDto(updatedOffer!));
    }

    /// <summary>
    /// Accept offer (buyer accepts counter or seller accepts offer)
    /// </summary>
    [HttpPut("{offerId}/accept")]
    public async Task<IActionResult> AcceptOffer(string offerId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

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

        // If offer is countered, buyer is accepting the counter-offer
        if (offer.Status == OfferStatus.Countered && offer.BuyerId == userId)
        {
            await _mongoDbService.AcceptCounterOfferAsync(offerId);
            await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
            {
                SenderId = userId,
                MessageText = $"Counter offer of {offer.CounterOfferAmount:C} accepted",
                IsSystemMessage = true
            });
        }
        else
        {
            // Seller is accepting the buyer's offer
            await _mongoDbService.UpdateOfferStatusAsync(offerId, OfferStatus.Accepted);
            await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
            {
                SenderId = userId,
                MessageText = $"Offer of {offer.CurrentOfferAmount:C} accepted",
                IsSystemMessage = true
            });
        }

        _logger.LogInformation("Offer accepted: {OfferId}", offerId);

        // Fetch listing and buyer for pending cart item and notifications
        var listing = await _mongoDbService.GetMyListingByIdAsync(offer.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(offer.BuyerId);
        var acceptedAmount = offer.CounterOfferAmount ?? offer.CurrentOfferAmount;

        // Disable the listing and create pending cart item for the buyer
        if (listing != null)
        {
            await _mongoDbService.SetListingDisabledAsync(offer.ListingId, true);

            var pendingCartItem = new PendingCartItem
            {
                UserId = offer.BuyerId,
                ListingId = offer.ListingId,
                OfferId = offerId,
                Price = acceptedAmount,
                Currency = listing.Currency,
                ListingTitle = listing.ListingTitle,
                ListingImage = listing.Images?.FirstOrDefault() ?? "",
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(72)
            };
            await _mongoDbService.CreatePendingCartItemAsync(pendingCartItem);
            _logger.LogInformation("Created pending cart item for buyer {BuyerId} on listing {ListingId}", offer.BuyerId, offer.ListingId);

            // Auto-reject all other offers on this listing
            var rejectedOffers = await _mongoDbService.RejectOtherOffersOnListingAsync(offer.ListingId, offerId);
            _logger.LogInformation("Auto-rejected {Count} other offers on listing {ListingId}", rejectedOffers.Count, offer.ListingId);

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

        // Send email notifications

        if (listing != null)
        {
            // Notify buyer
            if (buyer?.Email != null)
            {
                _ = _emailService.SendOfferAcceptedNotificationAsync(
                    buyer.Email,
                    listing.ListingTitle,
                    acceptedAmount,
                    isBuyer: true);
            }

            // Notify seller (if buyer accepted the counter-offer)
            if (offer.BuyerId == userId)
            {
                _ = _emailService.SendOfferAcceptedToSellerAsync(
                    listing.ListingTitle,
                    acceptedAmount,
                    buyer?.FullName ?? "Unknown Buyer");
            }
        }

        var updatedOffer = await _mongoDbService.GetOfferByIdAsync(offerId);
        return Ok(await MapToOfferDto(updatedOffer!));
    }

    /// <summary>
    /// Reject offer (buyer or seller)
    /// </summary>
    [HttpPut("{offerId}/reject")]
    public async Task<IActionResult> RejectOffer(string offerId, [FromBody] RejectOfferRequest? request = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

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
            SenderId = userId,
            MessageText = "Offer rejected",
            IsSystemMessage = true
        });

        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            await _mongoDbService.AddOfferMessageAsync(offerId, new OfferMessage
            {
                SenderId = userId,
                MessageText = request.Reason,
                IsSystemMessage = false
            });
        }

        _logger.LogInformation("Offer rejected: {OfferId}", offerId);

        // Send email notification to buyer (if seller rejected)
        if (offer.BuyerId != userId)
        {
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
        }

        var updatedOffer = await _mongoDbService.GetOfferByIdAsync(offerId);
        return Ok(await MapToOfferDto(updatedOffer!));
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    private async Task<OfferDto> MapToOfferDto(Offer offer)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(offer.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(offer.BuyerId);

        return new OfferDto
        {
            Id = offer.Id!,
            ListingId = offer.ListingId,
            BuyerId = offer.BuyerId,
            BuyerName = buyer?.FullName ?? "Unknown",
            InitialOfferAmount = offer.InitialOfferAmount,
            CurrentOfferAmount = offer.CurrentOfferAmount,
            CounterOfferAmount = offer.CounterOfferAmount,
            Status = offer.Status,
            CreatedAt = offer.CreatedAt,
            UpdatedAt = offer.UpdatedAt,
            Messages = offer.Messages.Select(m => new OfferMessageDto
            {
                SenderId = m.SenderId,
                MessageText = m.MessageText,
                CreatedAt = m.CreatedAt,
                IsSystemMessage = m.IsSystemMessage
            }).ToList(),
            Listing = listing != null ? new ListingSummaryDto
            {
                Id = listing.Id!,
                ListingTitle = listing.ListingTitle,
                Price = listing.Price,
                Currency = listing.Currency,
                Condition = listing.Condition,
                Image = listing.Images?.FirstOrDefault(),
                Disabled = listing.Disabled
            } : null
        };
    }
}

public class CreateOfferRequest
{
    public string ListingId { get; set; } = string.Empty;
    public decimal OfferAmount { get; set; }
    public string? Message { get; set; }
}

public class CounterOfferRequest
{
    public decimal CounterAmount { get; set; }
    public string? Message { get; set; }
}

public class RejectOfferRequest
{
    public string? Reason { get; set; }
}

public class OfferDto
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string BuyerId { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public decimal InitialOfferAmount { get; set; }
    public decimal CurrentOfferAmount { get; set; }
    public decimal? CounterOfferAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<OfferMessageDto> Messages { get; set; } = new();
    public ListingSummaryDto? Listing { get; set; }
}

public class OfferMessageDto
{
    public string SenderId { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsSystemMessage { get; set; }
}
