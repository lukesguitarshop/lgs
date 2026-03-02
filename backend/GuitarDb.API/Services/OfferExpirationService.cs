using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

public class OfferExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OfferExpirationService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

    public OfferExpirationService(
        IServiceProvider serviceProvider,
        ILogger<OfferExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Offer Expiration Service starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredOffersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing expired offers");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task ProcessExpiredOffersAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<MongoDbService>();
        var emailService = scope.ServiceProvider.GetRequiredService<EmailService>();

        // Process conversations with expired offers (new unified system)
        var expiredConversations = await mongoDbService.GetConversationsWithExpiredOffersAsync();

        if (expiredConversations.Count > 0)
        {
            _logger.LogInformation("Processing {Count} expired conversation offers", expiredConversations.Count);

            foreach (var conv in expiredConversations)
            {
                try
                {
                    var otherUserId = conv.ParticipantIds.FirstOrDefault(p => p != conv.ActiveOfferBy);

                    // Create expire message
                    if (otherUserId != null && conv.ActiveOfferBy != null)
                    {
                        await mongoDbService.CreateMessageAsync(new Message
                        {
                            ConversationId = conv.Id!,
                            SenderId = "system",
                            RecipientId = otherUserId,
                            ListingId = conv.ListingId,
                            MessageText = $"Offer of ${conv.ActiveOfferAmount:N0} expired after 48 hours",
                            Type = "expire",
                            OfferAmount = conv.ActiveOfferAmount
                        });
                    }

                    // Update conversation state
                    await mongoDbService.UpdateConversationOfferStateAsync(
                        conv.Id!,
                        activeOfferAmount: null,
                        activeOfferBy: null,
                        pendingActionBy: null,
                        offerExpiresAt: null,
                        offerStatus: "expired"
                    );

                    await mongoDbService.UpdateConversationLastMessageAsync(conv.Id!, "Offer expired");

                    // Send notification to offer maker
                    if (conv.ActiveOfferBy != null && conv.ListingId != null)
                    {
                        var offerMaker = await mongoDbService.GetUserByIdAsync(conv.ActiveOfferBy);
                        var listing = await mongoDbService.GetMyListingByIdAsync(conv.ListingId);

                        if (offerMaker?.Email != null)
                        {
                            await emailService.SendOfferExpiredNotificationAsync(
                                offerMaker.Email,
                                listing?.ListingTitle ?? "a listing",
                                conv.Id!
                            );
                        }
                    }

                    _logger.LogInformation("Expired offer in conversation {ConversationId}", conv.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error expiring offer in conversation {ConversationId}", conv.Id);
                }
            }
        }
    }
}
