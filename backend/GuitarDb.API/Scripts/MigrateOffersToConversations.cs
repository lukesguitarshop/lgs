// Migration script for converting old Offer documents to unified Conversation/Message format
// Run this as a one-time migration when deploying the new conversation system

using GuitarDb.API.Models;
using MongoDB.Driver;

namespace GuitarDb.API.Scripts;

public class MigrateOffersToConversations
{
    private readonly IMongoCollection<Offer> _offersCollection;
    private readonly IMongoCollection<Conversation> _conversationsCollection;
    private readonly IMongoCollection<Message> _messagesCollection;
    private readonly IMongoCollection<User> _usersCollection;
    private readonly ILogger<MigrateOffersToConversations> _logger;

    public MigrateOffersToConversations(IMongoDatabase database, ILogger<MigrateOffersToConversations> logger)
    {
        _offersCollection = database.GetCollection<Offer>("offers");
        _conversationsCollection = database.GetCollection<Conversation>("conversations");
        _messagesCollection = database.GetCollection<Message>("messages");
        _usersCollection = database.GetCollection<User>("users");
        _logger = logger;
    }

    public async Task MigrateAsync()
    {
        _logger.LogInformation("Starting offer to unified conversation migration...");

        // Get the admin user (single-seller shop - admin is always the seller)
        var adminUser = await _usersCollection
            .Find(u => u.IsAdmin == true)
            .FirstOrDefaultAsync();

        if (adminUser == null)
        {
            _logger.LogError("No admin user found. Cannot migrate offers.");
            return;
        }

        _logger.LogInformation("Using admin user {AdminId} as seller for all conversations", adminUser.Id);

        var offers = await _offersCollection.Find(_ => true).ToListAsync();
        _logger.LogInformation("Found {Count} offers to migrate", offers.Count);

        var migratedCount = 0;
        var skippedCount = 0;

        foreach (var offer in offers)
        {
            try
            {
                // Find or create conversation
                var conversation = await _conversationsCollection
                    .Find(c => c.ParticipantIds.Contains(offer.BuyerId) &&
                              c.ParticipantIds.Contains(adminUser.Id!) &&
                              c.ListingId == offer.ListingId)
                    .FirstOrDefaultAsync();

                if (conversation == null)
                {
                    conversation = new Conversation
                    {
                        ParticipantIds = new List<string> { offer.BuyerId, adminUser.Id! },
                        ListingId = offer.ListingId,
                        CreatedAt = offer.CreatedAt
                    };
                    await _conversationsCollection.InsertOneAsync(conversation);
                    _logger.LogDebug("Created new conversation {ConversationId} for offer {OfferId}", conversation.Id, offer.Id);
                }
                else if (conversation.OfferStatus != null)
                {
                    _logger.LogDebug("Offer {OfferId} already has offer state, skipping", offer.Id);
                    skippedCount++;
                    continue;
                }

                // Convert offer messages to Message documents
                foreach (var msg in offer.Messages)
                {
                    var messageType = "text";
                    decimal? offerAmount = null;

                    if (msg.IsSystemMessage && msg.MessageText.Contains("Offer of"))
                    {
                        messageType = "offer";
                        offerAmount = offer.InitialOfferAmount;
                    }
                    else if (msg.IsSystemMessage && msg.MessageText.Contains("Counter offer"))
                    {
                        messageType = "offer";
                        offerAmount = offer.CounterOfferAmount ?? 0;
                    }
                    else if (msg.IsSystemMessage && msg.MessageText.Contains("accepted"))
                    {
                        messageType = "accept";
                        offerAmount = offer.CounterOfferAmount ?? offer.CurrentOfferAmount;
                    }
                    else if (msg.IsSystemMessage && msg.MessageText.Contains("rejected"))
                    {
                        messageType = "decline";
                        offerAmount = offer.CurrentOfferAmount;
                    }

                    var senderId = msg.SenderId ?? (msg.IsSystemMessage ? adminUser.Id! : offer.BuyerId);
                    var recipientId = senderId == offer.BuyerId ? adminUser.Id! : offer.BuyerId;

                    var message = new Message
                    {
                        ConversationId = conversation.Id!,
                        SenderId = senderId,
                        RecipientId = recipientId,
                        ListingId = offer.ListingId,
                        MessageText = msg.MessageText,
                        Type = messageType,
                        OfferAmount = offerAmount,
                        CreatedAt = msg.CreatedAt,
                        IsRead = true
                    };
                    await _messagesCollection.InsertOneAsync(message);
                }

                // Map offer status to conversation state
                string? offerStatus = null;
                decimal? activeOfferAmount = null;
                string? activeOfferBy = null;
                string? pendingActionBy = null;
                decimal? acceptedAmount = null;

                switch (offer.Status)
                {
                    case "accepted":
                        offerStatus = "accepted";
                        acceptedAmount = offer.CounterOfferAmount ?? offer.CurrentOfferAmount;
                        break;
                    case "rejected":
                        offerStatus = "declined";
                        break;
                    case "countered":
                        offerStatus = "active";
                        activeOfferAmount = offer.CounterOfferAmount ?? offer.CurrentOfferAmount;
                        activeOfferBy = adminUser.Id!;
                        pendingActionBy = "buyer";
                        break;
                    case "pending":
                        offerStatus = "active";
                        activeOfferAmount = offer.CurrentOfferAmount;
                        activeOfferBy = offer.BuyerId;
                        pendingActionBy = "seller";
                        break;
                }

                // Update conversation with offer state
                var lastMessage = offer.Messages.LastOrDefault();
                var updateDef = Builders<Conversation>.Update
                    .Set(c => c.ActiveOfferAmount, activeOfferAmount)
                    .Set(c => c.ActiveOfferBy, activeOfferBy)
                    .Set(c => c.PendingActionBy, pendingActionBy)
                    .Set(c => c.OfferStatus, offerStatus)
                    .Set(c => c.AcceptedAmount, acceptedAmount)
                    .Set(c => c.LastMessage, lastMessage?.MessageText)
                    .Set(c => c.LastMessageAt, lastMessage?.CreatedAt ?? offer.UpdatedAt);

                if (offerStatus == "active")
                {
                    updateDef = updateDef.Set(c => c.OfferExpiresAt, DateTime.UtcNow.AddHours(48));
                }

                await _conversationsCollection.UpdateOneAsync(
                    c => c.Id == conversation.Id,
                    updateDef);

                migratedCount++;
                _logger.LogDebug("Migrated offer {OfferId} to conversation {ConversationId}", offer.Id, conversation.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error migrating offer {OfferId}", offer.Id);
            }
        }

        _logger.LogInformation("Migration complete. Migrated: {Migrated}, Skipped: {Skipped}", migratedCount, skippedCount);
    }
}
