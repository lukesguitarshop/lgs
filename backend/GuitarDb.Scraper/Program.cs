using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((context, config) =>
    {
        config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
        config.AddJsonFile($"appsettings.{context.HostingEnvironment.EnvironmentName}.json",
            optional: true, reloadOnChange: true);
        config.AddEnvironmentVariables();
    })
    .ConfigureServices((context, services) =>
    {
        var configuration = context.Configuration;

        var mongoSettings = configuration.GetSection("MongoDB").Get<MongoDbSettings>();
        var reverbSettings = configuration.GetSection("ReverbApi").Get<ReverbApiSettings>();

        if (mongoSettings == null)
            throw new InvalidOperationException("MongoDB settings not found in configuration");
        if (reverbSettings == null)
            throw new InvalidOperationException("ReverbApi settings not found in configuration");

        if (string.IsNullOrEmpty(mongoSettings.ConnectionString))
            throw new InvalidOperationException("MongoDB ConnectionString is required");
        if (string.IsNullOrEmpty(reverbSettings.ApiKey) || reverbSettings.ApiKey == "YOUR_API_KEY_HERE")
            throw new InvalidOperationException("Reverb API Key is required");

        services.AddSingleton(mongoSettings);
        services.AddSingleton(reverbSettings);

        services.AddSingleton<MyListingRepository>();
        services.AddSingleton<ReverbApiClient>();
        services.AddSingleton<ScraperOrchestrator>();

        // Deal Finder services
        var dealFinderSettings = configuration.GetSection("DealFinder").Get<DealFinderSettings>();
        if (dealFinderSettings != null)
        {
            services.AddSingleton(dealFinderSettings);
            services.AddSingleton<PotentialBuyRepository>();
            services.AddSingleton<PriceGuideCache>();
            services.AddSingleton<DealFinderOrchestrator>();
        }
    })
    .ConfigureLogging(logging =>
    {
        logging.ClearProviders();
        logging.AddConsole();
        logging.SetMinimumLevel(LogLevel.Information);
    })
    .Build();

var logger = host.Services.GetRequiredService<ILogger<Program>>();

// Check for --help flag
if (args.Contains("--help") || args.Contains("-h"))
{
    PrintHelp();
    return 0;
}

// Check for --deal-finder flag
var runDealFinder = args.Contains("--deal-finder");

try
{
    if (runDealFinder)
    {
        logger.LogInformation("Running Deal Finder mode");
        var dealFinder = host.Services.GetRequiredService<DealFinderOrchestrator>();
        await dealFinder.RunAsync();
    }
    else
    {
        // Existing scraper logic
        var clearExisting = !args.Contains("--keep");
        logger.LogInformation("Shop Listing Scraper");
        logger.LogInformation("Clear existing: {Clear}", clearExisting);

        var orchestrator = host.Services.GetRequiredService<ScraperOrchestrator>();
        await orchestrator.RunAsync(clearExisting);
    }

    logger.LogInformation("Completed successfully");
    return 0;
}
catch (Exception ex)
{
    logger.LogError(ex, "Failed");
    return 1;
}

static void PrintHelp()
{
    Console.WriteLine();
    Console.WriteLine("GuitarDb Scraper - Usage:");
    Console.WriteLine();
    Console.WriteLine("  dotnet run [options]");
    Console.WriteLine();
    Console.WriteLine("Modes:");
    Console.WriteLine("  (default)        Scrape your own Reverb listings");
    Console.WriteLine("  --deal-finder    Search marketplace for deals below price guide");
    Console.WriteLine();
    Console.WriteLine("Options:");
    Console.WriteLine("  --keep           Don't clear existing listings before scraping");
    Console.WriteLine("  --help, -h       Show this help message");
    Console.WriteLine();
    Console.WriteLine("Examples:");
    Console.WriteLine("  dotnet run                   # Scrape your listings");
    Console.WriteLine("  dotnet run --deal-finder     # Find marketplace deals");
    Console.WriteLine();
}
