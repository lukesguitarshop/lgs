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

        var expiredConversations = await mongoDbService.GetExpiredOfferConversationsAsync();

        if (expiredConversations.Count == 0)
        {
            return;
        }

        _logger.LogInformation("Processing {Count} expired conversations", expiredConversations.Count);

        foreach (var conversation in expiredConversations)
        {
            try
            {
                // Add expire event
                await mongoDbService.AddOfferConversationEventAsync(conversation.Id!, new ConversationEvent
                {
                    Type = ConversationEventType.Expire,
                    MessageText = "Offer expired after 48 hours with no response"
                });

                // Update status
                await mongoDbService.ExpireOfferConversationAsync(conversation.Id!);

                // Send emails to both parties
                var listing = await mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
                if (listing != null)
                {
                    var buyer = await mongoDbService.GetUserByIdAsync(conversation.BuyerId);
                    var seller = await mongoDbService.GetUserByIdAsync(conversation.SellerId);

                    if (buyer?.Email != null)
                    {
                        await emailService.SendOfferExpiredNotificationAsync(
                            buyer.Email,
                            listing.ListingTitle,
                            conversation.Id!);
                    }

                    if (seller?.Email != null)
                    {
                        await emailService.SendOfferExpiredNotificationAsync(
                            seller.Email,
                            listing.ListingTitle,
                            conversation.Id!);
                    }
                }

                _logger.LogInformation("Expired conversation {ConversationId}", conversation.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error expiring conversation {ConversationId}", conversation.Id);
            }
        }
    }
}
