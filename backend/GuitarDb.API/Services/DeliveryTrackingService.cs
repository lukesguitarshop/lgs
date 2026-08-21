namespace GuitarDb.API.Services;

public class DeliveryTrackingService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DeliveryTrackingService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    /// <summary>How far back to keep polling a package that never reports delivered.</summary>
    private const int DefaultMaxTrackingAgeDays = 45;

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

        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var maxAgeDays = configuration.GetValue<int?>("UPS:MaxTrackingAgeDays") ?? DefaultMaxTrackingAgeDays;

        // The query already narrows to UPS packages still worth asking about, so everything
        // that comes back gets a call.
        var shippedOrders = await mongoDbService.GetShippedOrdersAsync("UPS", maxAgeDays);
        _logger.LogInformation("Checking delivery status for {Count} shipped UPS orders", shippedOrders.Count);

        foreach (var order in shippedOrders)
        {
            if (stoppingToken.IsCancellationRequested) break;

            if (string.IsNullOrEmpty(order.TrackingNumber)) continue;

            try
            {
                var status = await upsTrackingService.GetTrackingStatusAsync(order.TrackingNumber);

                if (status?.IsDelivered == true)
                {
                    _logger.LogInformation(
                        "Order {OrderId} with tracking {TrackingNumber} was delivered {DeliveredAt}",
                        order.Id, order.TrackingNumber,
                        status.DeliveredAt?.ToString("u") ?? "(date not reported)");

                    await mongoDbService.UpdateOrderStatusAsync(order.Id!, "delivered", status.DeliveredAt);
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
