using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly ILogger<MessagesController> _logger;
    private readonly IWebHostEnvironment _environment;
    private static readonly TimeSpan OfferExpiration = TimeSpan.FromHours(48);

    public MessagesController(
        MongoDbService mongoDbService,
        EmailService emailService,
        ILogger<MessagesController> logger,
        IWebHostEnvironment environment)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _logger = logger;
        _environment = environment;
    }

    /// <summary>
    /// Get all conversations for current user
    /// </summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversations = await _mongoDbService.GetConversationsByUserAsync(userId);

        var result = new List<ConversationDto>();
        foreach (var conv in conversations)
        {
            var otherUserId = conv.ParticipantIds.FirstOrDefault(p => p != userId);
            var otherUser = otherUserId != null
                ? await _mongoDbService.GetUserByIdAsync(otherUserId)
                : null;

            MyListing? listing = null;
            if (conv.ListingId != null)
            {
                listing = await _mongoDbService.GetMyListingByIdAsync(conv.ListingId);
            }

            // Get unread count for this conversation
            var unreadCount = await GetUnreadCountForConversation(conv.Id!, userId);

            result.Add(new ConversationDto
            {
                Id = conv.Id!,
                OtherUserId = otherUserId,
                OtherUserName = otherUser?.FullName ?? "Unknown",
                ListingId = conv.ListingId,
                ListingTitle = listing?.ListingTitle,
                ListingImage = listing?.Images?.FirstOrDefault(),
                LastMessage = conv.LastMessage,
                LastMessageAt = conv.LastMessageAt,
                CreatedAt = conv.CreatedAt,
                UnreadCount = unreadCount,
                // Offer fields
                ActiveOfferAmount = conv.ActiveOfferAmount,
                ActiveOfferBy = conv.ActiveOfferBy,
                PendingActionBy = conv.PendingActionBy,
                OfferExpiresAt = conv.OfferExpiresAt,
                OfferStatus = conv.OfferStatus,
                AcceptedAmount = conv.AcceptedAmount
            });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get messages in a conversation
    /// </summary>
    [HttpGet("conversation/{conversationId}")]
    public async Task<IActionResult> GetConversationMessages(string conversationId, [FromQuery] int limit = 50)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: user must be a participant
        if (!conversation.ParticipantIds.Contains(userId))
        {
            return Forbid();
        }

        // Mark messages as read
        await _mongoDbService.MarkConversationMessagesAsReadAsync(conversationId, userId);

        var messages = await _mongoDbService.GetMessagesByConversationAsync(conversationId, limit);

        // Return in chronological order (oldest first)
        messages.Reverse();

        var result = messages.Select(m => new MessageDto
        {
            Id = m.Id!,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId,
            RecipientId = m.RecipientId,
            ListingId = m.ListingId,
            MessageText = m.MessageText,
            ImageUrls = m.ImageUrls,
            CreatedAt = m.CreatedAt,
            IsRead = m.IsRead,
            IsMine = m.SenderId == userId,
            Type = m.Type,
            OfferAmount = m.OfferAmount
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Send a new message (creates conversation if needed)
    /// Regular users can only message the admin; admin can message anyone
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (string.IsNullOrWhiteSpace(request.MessageText))
        {
            return BadRequest(new { error = "Message text is required" });
        }

        if (string.IsNullOrWhiteSpace(request.RecipientId))
        {
            return BadRequest(new { error = "Recipient is required" });
        }

        if (request.RecipientId == userId)
        {
            return BadRequest(new { error = "Cannot send message to yourself" });
        }

        // Verify recipient exists
        var recipient = await _mongoDbService.GetUserByIdAsync(request.RecipientId);
        if (recipient == null)
        {
            return BadRequest(new { error = "Recipient not found" });
        }

        // Check if sender is admin
        var sender = await _mongoDbService.GetUserByIdAsync(userId);
        var isAdminSender = sender?.IsAdmin ?? false;

        // Regular users can only message the admin
        if (!isAdminSender && !recipient.IsAdmin)
        {
            return BadRequest(new { error = "You can only message the shop owner" });
        }

        // Find or create conversation
        var conversation = await _mongoDbService.GetConversationByParticipantsAsync(
            userId, request.RecipientId, request.ListingId);

        if (conversation == null)
        {
            conversation = await _mongoDbService.CreateConversationAsync(new Conversation
            {
                ParticipantIds = new List<string> { userId, request.RecipientId },
                ListingId = request.ListingId
            });
        }

        // Create message
        var message = await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversation.Id!,
            SenderId = userId,
            RecipientId = request.RecipientId,
            ListingId = request.ListingId,
            MessageText = request.MessageText.Trim()
        });

        // Update conversation with last message
        var preview = request.MessageText.Length > 50
            ? request.MessageText.Substring(0, 47) + "..."
            : request.MessageText;
        await _mongoDbService.UpdateConversationLastMessageAsync(conversation.Id!, preview);

        // Send email notification to recipient
        MyListing? listing = null;
        if (request.ListingId != null)
        {
            listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        }
        if (recipient.Email != null)
        {
            _ = _emailService.SendNewMessageNotificationAsync(
                recipient.Email,
                sender?.FullName ?? "Someone",
                preview,
                listing?.ListingTitle,
                conversation.Id);
        }

        return Ok(new MessageDto
        {
            Id = message.Id!,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            RecipientId = message.RecipientId,
            ListingId = message.ListingId,
            MessageText = message.MessageText,
            ImageUrls = message.ImageUrls,
            CreatedAt = message.CreatedAt,
            IsRead = message.IsRead,
            IsMine = true
        });
    }

    /// <summary>
    /// Send a message with image attachments
    /// </summary>
    [HttpPost("with-images")]
    [RequestSizeLimit(25 * 1024 * 1024)] // 25MB total limit
    [RequestFormLimits(MultipartBodyLengthLimit = 25 * 1024 * 1024)]
    public async Task<IActionResult> SendMessageWithImages([FromForm] SendMessageWithImagesRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (string.IsNullOrWhiteSpace(request.RecipientId))
        {
            return BadRequest(new { error = "Recipient is required" });
        }

        if (request.RecipientId == userId)
        {
            return BadRequest(new { error = "Cannot send message to yourself" });
        }

        // Verify recipient exists
        var recipient = await _mongoDbService.GetUserByIdAsync(request.RecipientId);
        if (recipient == null)
        {
            return BadRequest(new { error = "Recipient not found" });
        }

        // Check if sender is admin
        var sender = await _mongoDbService.GetUserByIdAsync(userId);
        var isAdminSender = sender?.IsAdmin ?? false;

        // Regular users can only message the admin
        if (!isAdminSender && !recipient.IsAdmin)
        {
            return BadRequest(new { error = "You can only message the shop owner" });
        }

        // Process images
        var imageUrls = new List<string>();
        if (request.Images != null && request.Images.Count > 0)
        {
            // Limit to 4 images
            var imagesToProcess = request.Images.Take(4).ToList();

            foreach (var image in imagesToProcess)
            {
                if (image.Length > 5 * 1024 * 1024) // 5MB limit per image
                {
                    return BadRequest(new { error = "Image size must be less than 5MB" });
                }

                var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
                if (!allowedTypes.Contains(image.ContentType.ToLower()))
                {
                    return BadRequest(new { error = "Invalid image type. Allowed: JPEG, PNG, GIF, WebP" });
                }

                try
                {
                    // Save image to wwwroot/uploads/messages
                    var uploadsPath = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "messages");
                    Directory.CreateDirectory(uploadsPath);

                    var fileExtension = Path.GetExtension(image.FileName);
                    var fileName = $"{Guid.NewGuid()}{fileExtension}";
                    var filePath = Path.Combine(uploadsPath, fileName);

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await image.CopyToAsync(stream);
                    }

                    // Build the URL for the uploaded image
                    var baseUrl = $"{Request.Scheme}://{Request.Host}";
                    var imageUrl = $"{baseUrl}/uploads/messages/{fileName}";
                    imageUrls.Add(imageUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to save image");
                    return StatusCode(500, new { error = "Failed to upload image" });
                }
            }
        }

        // Find or create conversation
        var conversation = await _mongoDbService.GetConversationByParticipantsAsync(
            userId, request.RecipientId, request.ListingId);

        if (conversation == null)
        {
            conversation = await _mongoDbService.CreateConversationAsync(new Conversation
            {
                ParticipantIds = new List<string> { userId, request.RecipientId },
                ListingId = request.ListingId
            });
        }

        // Create message
        var message = await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversation.Id!,
            SenderId = userId,
            RecipientId = request.RecipientId,
            ListingId = request.ListingId,
            MessageText = request.MessageText?.Trim() ?? string.Empty,
            ImageUrls = imageUrls.Count > 0 ? imageUrls : null
        });

        // Update conversation with last message
        var preview = !string.IsNullOrEmpty(request.MessageText)
            ? (request.MessageText.Length > 50 ? request.MessageText.Substring(0, 47) + "..." : request.MessageText)
            : (imageUrls.Count > 0 ? $"[{imageUrls.Count} image(s)]" : "");
        await _mongoDbService.UpdateConversationLastMessageAsync(conversation.Id!, preview);

        // Send email notification to recipient
        MyListing? listing = null;
        if (request.ListingId != null)
        {
            listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        }
        if (recipient.Email != null)
        {
            _ = _emailService.SendNewMessageNotificationAsync(
                recipient.Email,
                sender?.FullName ?? "Someone",
                preview,
                listing?.ListingTitle,
                conversation.Id);
        }

        return Ok(new MessageDto
        {
            Id = message.Id!,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            RecipientId = message.RecipientId,
            ListingId = message.ListingId,
            MessageText = message.MessageText,
            ImageUrls = message.ImageUrls,
            CreatedAt = message.CreatedAt,
            IsRead = message.IsRead,
            IsMine = true
        });
    }

    /// <summary>
    /// Mark a message as read
    /// </summary>
    [HttpPut("{messageId}/read")]
    public async Task<IActionResult> MarkAsRead(string messageId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var message = await _mongoDbService.GetMessageByIdAsync(messageId);
        if (message == null)
        {
            return NotFound(new { error = "Message not found" });
        }

        // Only recipient can mark as read
        if (message.RecipientId != userId)
        {
            return Forbid();
        }

        await _mongoDbService.MarkMessageAsReadAsync(messageId);

        return Ok(new { message = "Message marked as read" });
    }

    /// <summary>
    /// Get unread message count
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var count = await _mongoDbService.GetUnreadMessageCountAsync(userId);

        return Ok(new { unreadCount = count });
    }

    /// <summary>
    /// Start a conversation with the admin (shop owner) about a listing
    /// </summary>
    [HttpPost("contact-seller")]
    public async Task<IActionResult> ContactSeller([FromBody] ContactSellerRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (string.IsNullOrWhiteSpace(request.ListingId))
        {
            return BadRequest(new { error = "Listing ID is required" });
        }

        // Verify listing exists
        var listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        // Find admin user (shop owner)
        var admin = await _mongoDbService.GetAdminUserAsync();
        if (admin == null)
        {
            _logger.LogError("No admin user found in database");
            return StatusCode(500, new { error = "Shop owner not configured" });
        }

        if (admin.Id == userId)
        {
            return BadRequest(new { error = "Cannot message yourself" });
        }

        // Find or create conversation
        var conversation = await _mongoDbService.GetConversationByParticipantsAsync(
            userId, admin.Id!, request.ListingId);

        if (conversation == null)
        {
            conversation = await _mongoDbService.CreateConversationAsync(new Conversation
            {
                ParticipantIds = new List<string> { userId, admin.Id! },
                ListingId = request.ListingId
            });
            _logger.LogInformation("Created new conversation {ConversationId} for listing {ListingId}",
                conversation.Id, request.ListingId);
        }

        return Ok(new ContactSellerResponse
        {
            ConversationId = conversation.Id!,
            SellerId = admin.Id!,
            SellerName = admin.FullName,
            ListingId = request.ListingId,
            ListingTitle = listing.ListingTitle
        });
    }

    /// <summary>
    /// Make an offer in a conversation (must have listingId)
    /// </summary>
    [HttpPost("conversations/{conversationId}/offer")]
    public async Task<IActionResult> MakeOffer(string conversationId, [FromBody] MakeOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (request.OfferAmount <= 0)
            return BadRequest(new { error = "Offer amount must be positive" });

        if (request.OfferAmount > 99999)
            return BadRequest(new { error = "Offer amount cannot exceed $99,999" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
            return NotFound(new { error = "Conversation not found" });

        if (!conversation.ParticipantIds.Contains(userId))
            return Forbid();

        if (conversation.ListingId == null)
            return BadRequest(new { error = "Cannot make offer - conversation not linked to a listing" });

        if (conversation.OfferStatus == "active")
            return BadRequest(new { error = "There is already an active offer in this conversation" });

        // Determine buyer/seller
        var admin = await _mongoDbService.GetAdminUserAsync();
        var isBuyer = userId != admin?.Id;
        var otherUserId = conversation.ParticipantIds.First(p => p != userId);
        var pendingActionBy = isBuyer ? "seller" : "buyer";

        // Create offer message
        var message = await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            RecipientId = otherUserId,
            ListingId = conversation.ListingId,
            MessageText = request.Message ?? $"Offer: ${request.OfferAmount:N0}",
            Type = "offer",
            OfferAmount = request.OfferAmount
        });

        // Update conversation state
        await _mongoDbService.UpdateConversationOfferStateAsync(
            conversationId,
            activeOfferAmount: request.OfferAmount,
            activeOfferBy: userId,
            pendingActionBy: pendingActionBy,
            offerExpiresAt: DateTime.UtcNow.Add(OfferExpiration),
            offerStatus: "active"
        );

        await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, $"Offer: ${request.OfferAmount:N0}");

        // Send email notification
        var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
        var sender = await _mongoDbService.GetUserByIdAsync(userId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        if (recipient?.Email != null)
        {
            await _emailService.SendOfferNotificationAsync(
                recipient.Email,
                listing?.ListingTitle ?? "a listing",
                request.OfferAmount,
                conversationId,
                isCounter: false
            );
        }

        return Ok(new { success = true, messageId = message.Id });
    }

    /// <summary>
    /// Accept the active offer
    /// </summary>
    [HttpPost("conversations/{conversationId}/accept")]
    public async Task<IActionResult> AcceptOffer(string conversationId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
            return NotFound(new { error = "Conversation not found" });

        if (!conversation.ParticipantIds.Contains(userId))
            return Forbid();

        if (conversation.OfferStatus != "active")
            return BadRequest(new { error = "No active offer to accept" });

        // Verify it's the recipient's turn
        var admin = await _mongoDbService.GetAdminUserAsync();
        var isBuyer = userId != admin?.Id;
        var expectedPendingBy = isBuyer ? "buyer" : "seller";

        if (conversation.PendingActionBy != expectedPendingBy)
            return BadRequest(new { error = "It's not your turn to respond to this offer" });

        var otherUserId = conversation.ParticipantIds.First(p => p != userId);
        var acceptedAmount = conversation.ActiveOfferAmount ?? 0;

        // Create accept message
        await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            RecipientId = otherUserId,
            ListingId = conversation.ListingId,
            MessageText = $"Accepted offer of ${acceptedAmount:N0}",
            Type = "accept",
            OfferAmount = acceptedAmount
        });

        // Update conversation state
        await _mongoDbService.UpdateConversationOfferStateAsync(
            conversationId,
            activeOfferAmount: null,
            activeOfferBy: null,
            pendingActionBy: null,
            offerExpiresAt: null,
            offerStatus: "accepted",
            acceptedAmount: acceptedAmount
        );

        await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, $"Offer accepted: ${acceptedAmount:N0}");

        // Send email notification
        var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        // The recipient of the acceptance email is the other user (the one who made the offer)
        var otherUserIsBuyer = conversation.ActiveOfferBy != admin?.Id;

        if (recipient?.Email != null)
        {
            await _emailService.SendOfferAcceptedWithLinkAsync(
                recipient.Email,
                listing?.ListingTitle ?? "a listing",
                acceptedAmount,
                conversationId,
                isBuyer: otherUserIsBuyer
            );
        }

        // Add to pending cart items (72 hour hold)
        // The buyer always gets the item in their cart, regardless of who made the final offer
        if (conversation.ListingId != null && listing != null)
        {
            // Determine who the buyer is (the non-admin participant)
            var buyerId = isBuyer ? userId : otherUserId;

            await _mongoDbService.CreatePendingCartItemAsync(new PendingCartItem
            {
                UserId = buyerId,
                ListingId = conversation.ListingId,
                OfferId = conversationId,
                Price = acceptedAmount,
                ListingTitle = listing.ListingTitle ?? "",
                ListingImage = listing.Images?.FirstOrDefault() ?? "",
                ExpiresAt = DateTime.UtcNow.AddHours(72)
            });

            // Disable the listing (mark as sold/pending)
            await _mongoDbService.SetListingDisabledAsync(conversation.ListingId, true);
        }

        return Ok(new { success = true, acceptedAmount });
    }

    /// <summary>
    /// Decline the active offer
    /// </summary>
    [HttpPost("conversations/{conversationId}/decline")]
    public async Task<IActionResult> DeclineOffer(string conversationId, [FromBody] DeclineOfferRequest? request = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
            return NotFound(new { error = "Conversation not found" });

        if (!conversation.ParticipantIds.Contains(userId))
            return Forbid();

        if (conversation.OfferStatus != "active")
            return BadRequest(new { error = "No active offer to decline" });

        // Verify it's the recipient's turn
        var admin = await _mongoDbService.GetAdminUserAsync();
        var isBuyer = userId != admin?.Id;
        var expectedPendingBy = isBuyer ? "buyer" : "seller";

        if (conversation.PendingActionBy != expectedPendingBy)
            return BadRequest(new { error = "It's not your turn to respond to this offer" });

        var otherUserId = conversation.ParticipantIds.First(p => p != userId);
        var declinedAmount = conversation.ActiveOfferAmount ?? 0;

        // Create decline message
        var messageText = string.IsNullOrWhiteSpace(request?.Reason)
            ? $"Declined offer of ${declinedAmount:N0}"
            : $"Declined offer of ${declinedAmount:N0}: {request.Reason}";

        await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            RecipientId = otherUserId,
            ListingId = conversation.ListingId,
            MessageText = messageText,
            Type = "decline",
            OfferAmount = declinedAmount
        });

        // Update conversation state
        await _mongoDbService.UpdateConversationOfferStateAsync(
            conversationId,
            activeOfferAmount: null,
            activeOfferBy: null,
            pendingActionBy: null,
            offerExpiresAt: null,
            offerStatus: "declined"
        );

        await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, "Offer declined");

        // Send email notification
        var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        if (recipient?.Email != null)
        {
            await _emailService.SendOfferDeclinedNotificationAsync(
                recipient.Email,
                listing?.ListingTitle ?? "a listing",
                conversationId,
                request?.Reason
            );
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Counter the active offer with a new amount
    /// </summary>
    [HttpPost("conversations/{conversationId}/counter")]
    public async Task<IActionResult> CounterOffer(string conversationId, [FromBody] MakeOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (request.OfferAmount <= 0)
            return BadRequest(new { error = "Offer amount must be positive" });

        if (request.OfferAmount > 99999)
            return BadRequest(new { error = "Offer amount cannot exceed $99,999" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
            return NotFound(new { error = "Conversation not found" });

        if (!conversation.ParticipantIds.Contains(userId))
            return Forbid();

        if (conversation.OfferStatus != "active")
            return BadRequest(new { error = "No active offer to counter" });

        // Verify it's the recipient's turn
        var admin = await _mongoDbService.GetAdminUserAsync();
        var isBuyer = userId != admin?.Id;
        var expectedPendingBy = isBuyer ? "buyer" : "seller";

        if (conversation.PendingActionBy != expectedPendingBy)
            return BadRequest(new { error = "It's not your turn to respond to this offer" });

        var otherUserId = conversation.ParticipantIds.First(p => p != userId);
        var previousAmount = conversation.ActiveOfferAmount ?? 0;
        var newPendingActionBy = isBuyer ? "seller" : "buyer";

        // Create counter message (marks the old offer as countered)
        await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            RecipientId = otherUserId,
            ListingId = conversation.ListingId,
            MessageText = $"Countered ${previousAmount:N0} with ${request.OfferAmount:N0}",
            Type = "counter",
            OfferAmount = previousAmount
        });

        // Create new offer message
        await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            RecipientId = otherUserId,
            ListingId = conversation.ListingId,
            MessageText = $"Counter offer: ${request.OfferAmount:N0}",
            Type = "offer",
            OfferAmount = request.OfferAmount
        });

        // Update conversation state with new offer
        await _mongoDbService.UpdateConversationOfferStateAsync(
            conversationId,
            activeOfferAmount: request.OfferAmount,
            activeOfferBy: userId,
            pendingActionBy: newPendingActionBy,
            offerExpiresAt: DateTime.UtcNow.AddHours(48),
            offerStatus: "active"
        );

        await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, $"Counter offer: ${request.OfferAmount:N0}");

        // Send email notification
        var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        if (recipient?.Email != null)
        {
            await _emailService.SendOfferNotificationAsync(
                recipient.Email,
                listing?.ListingTitle ?? "a listing",
                request.OfferAmount,
                conversationId,
                isCounter: true
            );
        }

        return Ok(new { success = true, newOfferAmount = request.OfferAmount });
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    private async Task<int> GetUnreadCountForConversation(string conversationId, string userId)
    {
        var messages = await _mongoDbService.GetMessagesByConversationAsync(conversationId, 100);
        return messages.Count(m => m.RecipientId == userId && !m.IsRead);
    }
}

public class SendMessageRequest
{
    public string RecipientId { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
    public string? ListingId { get; set; }
}

public class ConversationDto
{
    public string Id { get; set; } = string.Empty;
    public string? OtherUserId { get; set; }
    public string OtherUserName { get; set; } = string.Empty;
    public string? ListingId { get; set; }
    public string? ListingTitle { get; set; }
    public string? ListingImage { get; set; }
    public string? LastMessage { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public int UnreadCount { get; set; }
    // Offer fields
    public decimal? ActiveOfferAmount { get; set; }
    public string? ActiveOfferBy { get; set; }
    public string? PendingActionBy { get; set; }
    public DateTime? OfferExpiresAt { get; set; }
    public string? OfferStatus { get; set; }
    public decimal? AcceptedAmount { get; set; }
}

public class MessageDto
{
    public string Id { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string RecipientId { get; set; } = string.Empty;
    public string? ListingId { get; set; }
    public string MessageText { get; set; } = string.Empty;
    public List<string>? ImageUrls { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
    public bool IsMine { get; set; }
    public string Type { get; set; } = "text";
    public decimal? OfferAmount { get; set; }
}

public class ContactSellerRequest
{
    public string ListingId { get; set; } = string.Empty;
}

public class ContactSellerResponse
{
    public string ConversationId { get; set; } = string.Empty;
    public string SellerId { get; set; } = string.Empty;
    public string SellerName { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string? ListingTitle { get; set; }
}

public class SendMessageWithImagesRequest
{
    public string RecipientId { get; set; } = string.Empty;
    public string? MessageText { get; set; }
    public string? ListingId { get; set; }
    public List<IFormFile>? Images { get; set; }
}

public class MakeOfferRequest
{
    public decimal OfferAmount { get; set; }
    public string? Message { get; set; }
}

public class DeclineOfferRequest
{
    public string? Reason { get; set; }
}
