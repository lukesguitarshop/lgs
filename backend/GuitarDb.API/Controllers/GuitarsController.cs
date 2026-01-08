using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

/// <summary>
/// API endpoints for managing and querying guitar price data
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class GuitarsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<GuitarsController> _logger;

    public GuitarsController(
        MongoDbService mongoDbService,
        ILogger<GuitarsController> logger)
    {
        _mongoDbService = mongoDbService;
        _logger = logger;
    }

    /// <summary>
    /// Retrieves all guitars with pagination support
    /// </summary>
    /// <param name="skip">Number of records to skip (default: 0)</param>
    /// <param name="take">Number of records to take (default: 50, max: 100)</param>
    /// <returns>A paginated list of guitars with total count and pagination metadata</returns>
    /// <response code="200">Returns the paginated list of guitars</response>
    /// <response code="400">If pagination parameters are invalid</response>
    /// <response code="500">If an internal server error occurs</response>
    /// <remarks>
    /// Sample request:
    ///
    ///     GET /api/guitars?skip=0&amp;take=25
    ///
    /// Response includes:
    /// - Total: Total number of guitars in the database
    /// - Skip: Number of records skipped
    /// - Take: Number of records returned
    /// - Data: Array of guitar objects
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAllGuitars([FromQuery] int skip = 0, [FromQuery] int take = 50)
    {
        try
        {
            // Validate pagination parameters
            if (skip < 0)
            {
                return BadRequest("Skip parameter cannot be negative");
            }

            if (take <= 0 || take > 100)
            {
                return BadRequest("Take parameter must be between 1 and 100");
            }

            _logger.LogInformation("Fetching guitars with skip={Skip}, take={Take}", skip, take);

            var allGuitars = await _mongoDbService.GetAllGuitarsAsync();
            var paginatedGuitars = allGuitars.Skip(skip).Take(take).ToList();

            _logger.LogInformation("Retrieved {Count} guitars", paginatedGuitars.Count);

            return Ok(new
            {
                Total = allGuitars.Count,
                Skip = skip,
                Take = take,
                Data = paginatedGuitars
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching guitars");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while fetching guitars");
        }
    }

    /// <summary>
    /// Retrieves a single guitar by its unique identifier
    /// </summary>
    /// <param name="id">The MongoDB ObjectId of the guitar</param>
    /// <returns>The guitar matching the specified ID</returns>
    /// <response code="200">Returns the requested guitar</response>
    /// <response code="400">If the guitar ID is invalid or missing</response>
    /// <response code="404">If no guitar is found with the specified ID</response>
    /// <response code="500">If an internal server error occurs</response>
    /// <remarks>
    /// Sample request:
    ///
    ///     GET /api/guitars/507f1f77bcf86cd799439011
    ///
    /// </remarks>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(Guitar), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetGuitarById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest("Guitar ID is required");
            }

            _logger.LogInformation("Fetching guitar with ID: {Id}", id);

            var guitar = await _mongoDbService.GetGuitarByIdAsync(id);

            if (guitar == null)
            {
                _logger.LogWarning("Guitar with ID {Id} not found", id);
                return NotFound($"Guitar with ID {id} not found");
            }

            return Ok(guitar);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching guitar with ID: {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while fetching the guitar");
        }
    }

    /// <summary>
    /// Retrieves all guitars from a specific brand
    /// </summary>
    /// <param name="brand">The brand name (e.g., Gibson, Fender, Martin)</param>
    /// <returns>A list of guitars matching the specified brand</returns>
    /// <response code="200">Returns the list of guitars for the specified brand</response>
    /// <response code="400">If the brand parameter is missing or invalid</response>
    /// <response code="500">If an internal server error occurs</response>
    /// <remarks>
    /// Sample request:
    ///
    ///     GET /api/guitars/brand/Gibson
    ///
    /// Response includes:
    /// - Brand: The brand name queried
    /// - Count: Number of guitars found
    /// - Data: Array of guitar objects
    /// </remarks>
    [HttpGet("brand/{brand}")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetGuitarsByBrand(string brand)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(brand))
            {
                return BadRequest("Brand is required");
            }

            _logger.LogInformation("Fetching guitars for brand: {Brand}", brand);

            var guitars = await _mongoDbService.GetGuitarsByBrandAsync(brand);

            _logger.LogInformation("Retrieved {Count} guitars for brand {Brand}", guitars.Count, brand);

            return Ok(new
            {
                Brand = brand,
                Count = guitars.Count,
                Data = guitars
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching guitars for brand: {Brand}", brand);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while fetching guitars by brand");
        }
    }

    /// <summary>
    /// Searches for guitars matching a query string
    /// </summary>
    /// <param name="q">The search query (searches across model, brand, finish, and category fields)</param>
    /// <returns>A list of guitars matching the search criteria</returns>
    /// <response code="200">Returns the list of matching guitars</response>
    /// <response code="400">If the search query is missing</response>
    /// <response code="500">If an internal server error occurs</response>
    /// <remarks>
    /// Sample request:
    ///
    ///     GET /api/guitars/search?q=Les%20Paul
    ///
    /// The search performs a case-insensitive regex match across multiple fields:
    /// - Brand
    /// - Model
    /// - Finish
    /// - Category
    ///
    /// Response includes:
    /// - Query: The search query used
    /// - Count: Number of results found
    /// - Data: Array of matching guitar objects
    /// </remarks>
    [HttpGet("search")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> SearchGuitars([FromQuery] string q)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return BadRequest("Search query (q) is required");
            }

            _logger.LogInformation("Searching guitars with query: {Query}", q);

            var guitars = await _mongoDbService.SearchGuitarsAsync(q);

            _logger.LogInformation("Found {Count} guitars matching query: {Query}", guitars.Count, q);

            return Ok(new
            {
                Query = q,
                Count = guitars.Count,
                Data = guitars
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching guitars with query: {Query}", q);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while searching guitars");
        }
    }

    /// <summary>
    /// Retrieves the price history for a specific guitar
    /// </summary>
    /// <param name="id">The MongoDB ObjectId of the guitar</param>
    /// <param name="startDate">Optional start date for filtering (ISO 8601 format)</param>
    /// <param name="endDate">Optional end date for filtering (ISO 8601 format)</param>
    /// <returns>The price history for the specified guitar, optionally filtered by date range</returns>
    /// <response code="200">Returns the price history data</response>
    /// <response code="400">If the guitar ID is invalid or missing</response>
    /// <response code="404">If no guitar is found with the specified ID</response>
    /// <response code="500">If an internal server error occurs</response>
    /// <remarks>
    /// Sample request:
    ///
    ///     GET /api/guitars/507f1f77bcf86cd799439011/price-history
    ///     GET /api/guitars/507f1f77bcf86cd799439011/price-history?startDate=2024-01-01&amp;endDate=2024-12-31
    ///
    /// Response includes:
    /// - GuitarId: The guitar's ID
    /// - Brand: Guitar brand
    /// - Model: Guitar model
    /// - Year: Guitar year (if available)
    /// - Count: Number of price snapshots in the result
    /// - StartDate: Applied start date filter (if provided)
    /// - EndDate: Applied end date filter (if provided)
    /// - PriceHistory: Array of price snapshot objects sorted by date (most recent first)
    /// </remarks>
    [HttpGet("{id}/price-history")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetPriceHistory(
        string id,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest("Guitar ID is required");
            }

            _logger.LogInformation(
                "Fetching price history for guitar {Id} with date range: {StartDate} to {EndDate}",
                id, startDate, endDate);

            var guitar = await _mongoDbService.GetGuitarByIdAsync(id);

            if (guitar == null)
            {
                _logger.LogWarning("Guitar with ID {Id} not found", id);
                return NotFound($"Guitar with ID {id} not found");
            }

            var priceHistory = guitar.PriceHistory ?? new List<PriceSnapshot>();

            // Filter by date range if provided
            if (startDate.HasValue)
            {
                priceHistory = priceHistory.Where(p => p.Date >= startDate.Value).ToList();
            }

            if (endDate.HasValue)
            {
                priceHistory = priceHistory.Where(p => p.Date <= endDate.Value).ToList();
            }

            // Sort by date descending (most recent first)
            priceHistory = priceHistory.OrderByDescending(p => p.Date).ToList();

            _logger.LogInformation(
                "Retrieved {Count} price snapshots for guitar {Id}",
                priceHistory.Count, id);

            return Ok(new
            {
                GuitarId = id,
                Brand = guitar.Brand,
                Model = guitar.Model,
                Year = guitar.Year,
                Count = priceHistory.Count,
                StartDate = startDate,
                EndDate = endDate,
                PriceHistory = priceHistory
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching price history for guitar: {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while fetching price history");
        }
    }

    /// <summary>
    /// Creates a new guitar in the database
    /// </summary>
    /// <param name="guitar">The guitar object to create</param>
    /// <returns>The newly created guitar with its assigned ID</returns>
    /// <response code="201">Returns the newly created guitar</response>
    /// <response code="400">If the guitar data is invalid or missing required fields</response>
    /// <response code="500">If an internal server error occurs</response>
    /// <remarks>
    /// Sample request:
    ///
    ///     POST /api/guitars
    ///     {
    ///        "brand": "Gibson",
    ///        "model": "Les Paul Standard",
    ///        "year": 1959,
    ///        "finish": "Sunburst",
    ///        "category": "Electric Guitar"
    ///     }
    ///
    /// Required fields:
    /// - brand
    /// - model
    ///
    /// Note: This endpoint is intended for admin use only. Authentication will be added in a future update.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(Guitar), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> CreateGuitar([FromBody] Guitar guitar)
    {
        try
        {
            if (guitar == null)
            {
                return BadRequest("Guitar data is required");
            }

            // Validate required fields
            if (string.IsNullOrWhiteSpace(guitar.Brand))
            {
                return BadRequest("Brand is required");
            }

            if (string.IsNullOrWhiteSpace(guitar.Model))
            {
                return BadRequest("Model is required");
            }

            _logger.LogInformation("Creating new guitar: {Brand} {Model}", guitar.Brand, guitar.Model);

            var createdGuitar = await _mongoDbService.CreateGuitarAsync(guitar);

            _logger.LogInformation("Successfully created guitar with ID: {Id}", createdGuitar.Id);

            return CreatedAtAction(
                nameof(GetGuitarById),
                new { id = createdGuitar.Id },
                createdGuitar);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating guitar");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while creating the guitar");
        }
    }
}
