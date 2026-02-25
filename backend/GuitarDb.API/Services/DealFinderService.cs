using System.Diagnostics;

namespace GuitarDb.API.Services;

public class DealFinderService
{
    private readonly ILogger<DealFinderService> _logger;
    private readonly IConfiguration _configuration;
    private static bool _isRunning = false;
    private static readonly object _lock = new();

    public DealFinderService(ILogger<DealFinderService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public bool IsRunning => _isRunning;

    public async Task<DealFinderResult> RunAsync(CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            if (_isRunning)
            {
                return new DealFinderResult
                {
                    Success = false,
                    Message = "Deal finder is already running"
                };
            }
            _isRunning = true;
        }

        var startTime = DateTime.UtcNow;
        var result = new DealFinderResult();

        try
        {
            _logger.LogInformation("Starting Deal Finder scraper...");

            // Get the scraper project path
            var scraperPath = _configuration["DealFinder:ScraperPath"]
                ?? Path.Combine(Directory.GetCurrentDirectory(), "..", "GuitarDb.Scraper");

            var startInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                Arguments = "run -- --deal-finder",
                WorkingDirectory = scraperPath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = startInfo };
            var outputLines = new List<string>();
            var errorLines = new List<string>();

            process.OutputDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    outputLines.Add(e.Data);
                    _logger.LogDebug("[DealFinder] {Line}", e.Data);
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    errorLines.Add(e.Data);
                    _logger.LogWarning("[DealFinder Error] {Line}", e.Data);
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync(cancellationToken);

            result.Duration = DateTime.UtcNow - startTime;
            result.OutputLines = outputLines;
            result.ErrorLines = errorLines;

            if (process.ExitCode == 0)
            {
                result.Success = true;
                result.Message = "Deal finder completed successfully";

                // Parse summary from output
                var summaryLine = outputLines.LastOrDefault(l => l.Contains("Listings Checked:"));
                var dealsLine = outputLines.LastOrDefault(l => l.Contains("Deals Found:"));

                if (summaryLine != null)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(summaryLine, @"Listings Checked:\s*(\d+)");
                    if (match.Success) result.ListingsChecked = int.Parse(match.Groups[1].Value);
                }
                if (dealsLine != null)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(dealsLine, @"Deals Found:\s*(\d+)");
                    if (match.Success) result.DealsFound = int.Parse(match.Groups[1].Value);
                }

                _logger.LogInformation("Deal finder completed: {ListingsChecked} listings checked, {DealsFound} deals found",
                    result.ListingsChecked, result.DealsFound);
            }
            else
            {
                result.Success = false;
                result.Message = $"Deal finder failed with exit code {process.ExitCode}";
                result.Error = string.Join("\n", errorLines);
                _logger.LogError("Deal finder failed: {Error}", result.Error);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deal finder failed with exception");
            result.Success = false;
            result.Message = "Deal finder failed";
            result.Error = ex.Message;
            result.Duration = DateTime.UtcNow - startTime;
            return result;
        }
        finally
        {
            lock (_lock)
            {
                _isRunning = false;
            }
        }
    }
}

public class DealFinderResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Error { get; set; }
    public int ListingsChecked { get; set; }
    public int DealsFound { get; set; }
    public TimeSpan Duration { get; set; }
    public List<string> OutputLines { get; set; } = new();
    public List<string> ErrorLines { get; set; } = new();
}
