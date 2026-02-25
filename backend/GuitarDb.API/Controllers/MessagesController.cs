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
                UnreadCount = unreadCount
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
            IsMine = m.SenderId == userId
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
                listing?.ListingTitle);
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
                listing?.ListingTitle);
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
