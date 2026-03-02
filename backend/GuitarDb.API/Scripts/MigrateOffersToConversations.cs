// Migration script for converting old Offer documents to OfferConversation format
// Run this as a one-time migration when deploying the new conversation system

using GuitarDb.API.Models;
using MongoDB.Driver;

namespace GuitarDb.API.Scripts;

public class MigrateOffersToConversations
{
    private readonly IMongoCollection<Offer> _offersCollection;
    private readonly IMongoCollection<OfferConversation> _conversationsCollection;
    private readonly IMongoCollection<User> _usersCollection;
    private readonly ILogger<MigrateOffersToConversations> _logger;

    public MigrateOffersToConversations(IMongoDatabase database, ILogger<MigrateOffersToConversations> logger)
    {
        _offersCollection = database.GetCollection<Offer>("offers");
        _conversationsCollection = database.GetCollection<OfferConversation>("offer_conversations");
        _usersCollection = database.GetCollection<User>("users");
        _logger = logger;
    }

    public async Task MigrateAsync()
    {
        _logger.LogInformation("Starting offer to conversation migration...");

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
                // Check if already migrated
                var existing = await _conversationsCollection
                    .Find(c => c.BuyerId == offer.BuyerId && c.ListingId == offer.ListingId)
                    .FirstOrDefaultAsync();

                if (existing != null)
                {
                    _logger.LogDebug("Offer {OfferId} already migrated, skipping", offer.Id);
                    skippedCount++;
                    continue;
                }

                // Convert messages to events
                var events = new List<ConversationEvent>();
                foreach (var msg in offer.Messages)
                {
                    if (msg.IsSystemMessage && msg.MessageText.Contains("Offer of"))
                    {
                        events.Add(new ConversationEvent
                        {
                            Type = ConversationEventType.Offer,
                            SenderId = msg.SenderId,
                            OfferAmount = offer.InitialOfferAmount,
                            CreatedAt = msg.CreatedAt
                        });
                    }
                    else if (msg.IsSystemMessage && msg.MessageText.Contains("Counter offer"))
                    {
                        events.Add(new ConversationEvent
                        {
                            Type = ConversationEventType.Offer,
                            SenderId = msg.SenderId,
                            OfferAmount = offer.CounterOfferAmount ?? 0,
                            CreatedAt = msg.CreatedAt
                        });
                    }
                    else if (msg.IsSystemMessage && msg.MessageText.Contains("accepted"))
                    {
                        events.Add(new ConversationEvent
                        {
                            Type = ConversationEventType.Accept,
                            SenderId = msg.SenderId,
                            OfferAmount = offer.CounterOfferAmount ?? offer.CurrentOfferAmount,
                            CreatedAt = msg.CreatedAt
                        });
                    }
                    else if (msg.IsSystemMessage && msg.MessageText.Contains("rejected"))
                    {
                        events.Add(new ConversationEvent
                        {
                            Type = ConversationEventType.Decline,
                            SenderId = msg.SenderId,
                            CreatedAt = msg.CreatedAt
                        });
                    }
                    else
                    {
                        events.Add(new ConversationEvent
                        {
                            Type = ConversationEventType.Message,
                            SenderId = msg.SenderId,
                            MessageText = msg.MessageText,
                            CreatedAt = msg.CreatedAt
                        });
                    }
                }

                // Map status
                var status = offer.Status switch
                {
                    "accepted" => ConversationStatus.Accepted,
                    "rejected" => ConversationStatus.Declined,
                    _ => ConversationStatus.Active
                };

                // Determine pending action
                string? pendingActionBy = null;
                decimal? pendingOfferAmount = null;
                if (status == ConversationStatus.Active)
                {
                    if (offer.Status == "countered")
                    {
                        pendingActionBy = ActionBy.Buyer;
                        pendingOfferAmount = offer.CounterOfferAmount;
                    }
                    else if (offer.Status == "pending")
                    {
                        pendingActionBy = ActionBy.Seller;
                        pendingOfferAmount = offer.CurrentOfferAmount;
                    }
                }

                var conversation = new OfferConversation
                {
                    ListingId = offer.ListingId,
                    BuyerId = offer.BuyerId,
                    SellerId = adminUser.Id!,
                    PendingActionBy = pendingActionBy,
                    PendingOfferAmount = pendingOfferAmount,
                    Status = status,
                    AcceptedAmount = status == ConversationStatus.Accepted
                        ? (offer.CounterOfferAmount ?? offer.CurrentOfferAmount)
                        : null,
                    Events = events,
                    CreatedAt = offer.CreatedAt,
                    UpdatedAt = offer.UpdatedAt
                };

                await _conversationsCollection.InsertOneAsync(conversation);
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
