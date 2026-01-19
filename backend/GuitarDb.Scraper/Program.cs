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
    })
    .ConfigureLogging(logging =>
    {
        logging.ClearProviders();
        logging.AddConsole();
        logging.SetMinimumLevel(LogLevel.Information);
    })
    .Build();

var orchestrator = host.Services.GetRequiredService<ScraperOrchestrator>();
var logger = host.Services.GetRequiredService<ILogger<Program>>();

// Check for --help flag
if (args.Contains("--help") || args.Contains("-h"))
{
    PrintHelp();
    return 0;
}

// Check for --keep flag (don't clear existing listings)
var clearExisting = !args.Contains("--keep");

try
{
    logger.LogInformation("Shop Listing Scraper");
    logger.LogInformation("Clear existing: {Clear}", clearExisting);
    
    await orchestrator.RunAsync(clearExisting);
    
    logger.LogInformation("Scraper completed successfully");
    return 0;
}
catch (Exception ex)
{
    logger.LogError(ex, "Scraper failed");
    return 1;
}

static void PrintHelp()
{
    Console.WriteLine();
    Console.WriteLine("Shop Listing Scraper - Usage:");
    Console.WriteLine();
    Console.WriteLine("  dotnet run [options]");
    Console.WriteLine();
    Console.WriteLine("Options:");
    Console.WriteLine("  --keep         Don't clear existing listings before scraping");
    Console.WriteLine("  --help, -h     Show this help message");
    Console.WriteLine();
    Console.WriteLine("Examples:");
    Console.WriteLine("  dotnet run              # Scrape and replace all listings");
    Console.WriteLine("  dotnet run --keep       # Scrape and append to existing listings");
    Console.WriteLine();
}
