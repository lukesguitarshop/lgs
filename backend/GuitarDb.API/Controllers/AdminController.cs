using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly ILogger<AdminController> _logger;
    private readonly IConfiguration _configuration;

    public AdminController(ILogger<AdminController> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Manually trigger the Reverb scraper to refresh listings
    /// </summary>
    [HttpPost("run-scraper")]
    public async Task<IActionResult> RunScraper()
    {
        _logger.LogInformation("Manual scraper trigger requested");

        try
        {
            var scraperPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "GuitarDb.Scraper"));

            _logger.LogInformation("Running scraper from: {Path}", scraperPath);

            var startInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                Arguments = "run",
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
                    _logger.LogInformation("[Scraper] {Output}", e.Data);
                }
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    errorLines.Add(e.Data);
                    _logger.LogWarning("[Scraper Error] {Error}", e.Data);
                }
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
            {
                _logger.LogError("Scraper exited with code {ExitCode}", process.ExitCode);
                return StatusCode(500, new
                {
                    success = false,
                    message = "Scraper failed",
                    exitCode = process.ExitCode,
                    errors = errorLines,
                    output = outputLines
                });
            }

            _logger.LogInformation("Scraper completed successfully");

            return Ok(new
            {
                success = true,
                message = "Scraper completed successfully",
                output = outputLines
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run scraper");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to start scraper",
                error = ex.Message
            });
        }
    }
}
