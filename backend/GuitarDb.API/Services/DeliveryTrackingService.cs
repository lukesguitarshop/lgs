namespace GuitarDb.API.Services;

public class DeliveryTrackingService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DeliveryTrackingService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    public DeliveryTrackingService(
        IServiceProvider serviceProvider,
        ILogger<DeliveryTrackingService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Delivery tracking service started");

        try
        {
            // Wait a bit before first check to let the app fully start
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckDeliveriesAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking deliveries");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown, don't let this propagate and crash the host
        }

        _logger.LogInformation("Delivery tracking service stopped");
    }

    private async Task CheckDeliveriesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<MongoDbService>();
        var upsTrackingService = scope.ServiceProvider.GetRequiredService<UpsTrackingService>();

        if (!upsTrackingService.IsEnabled)
        {
            _logger.LogDebug("UPS tracking not enabled, skipping delivery check");
            return;
        }

        var shippedOrders = await mongoDbService.GetShippedOrdersAsync();
        _logger.LogInformation("Checking delivery status for {Count} shipped orders", shippedOrders.Count);

        foreach (var order in shippedOrders)
        {
            if (stoppingToken.IsCancellationRequested) break;

            // Only check UPS packages
            if (order.TrackingCarrier?.ToUpper() != "UPS" || string.IsNullOrEmpty(order.TrackingNumber))
            {
                continue;
            }

            try
            {
                var status = await upsTrackingService.GetTrackingStatusAsync(order.TrackingNumber);

                if (status?.IsDelivered == true)
                {
                    _logger.LogInformation(
                        "Order {OrderId} with tracking {TrackingNumber} has been delivered",
                        order.Id, order.TrackingNumber);

                    await mongoDbService.UpdateOrderStatusAsync(order.Id!, "delivered");
                }

                // Add a small delay between API calls to avoid rate limiting
                await Task.Delay(500, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking delivery status for order {OrderId}", order.Id);
            }
        }
    }
}
