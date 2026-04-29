using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Reflection;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Version = "v1",
        Title = "Guitar Price Database API",
        Description = "A comprehensive API for tracking Gibson guitar prices and market data from Reverb",
        Contact = new() { Name = "Luke's Guitar Shop", Email = "lukesguitarshop@gmail.com" }
    });

    // Include XML comments for better documentation
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFilename);
    options.IncludeXmlComments(xmlPath);
});

// Register MongoDB service as singleton
builder.Services.AddSingleton<MongoDbService>();

// Register S3-compatible file storage (Tigris on Fly.io). Lazy-init: it does not
// hit env vars until first use, so the API still boots locally without S3 creds.
builder.Services.AddSingleton<IFileStorageService, S3FileStorageService>();

// Register ScraperService with HttpClient for Reverb API
builder.Services.AddHttpClient<ScraperService>(client =>
{
    client.Timeout = TimeSpan.FromMinutes(5); // Scraper may take a while
});

// Register ReviewScraperService with HttpClient for Reverb API
builder.Services.AddHttpClient<ReviewScraperService>(client =>
{
    client.Timeout = TimeSpan.FromMinutes(5);
});

// Register AuthService
builder.Services.AddSingleton<AuthService>();

// Register EmailService
builder.Services.AddSingleton<EmailService>();

// Register Deal Finder services
builder.Services.AddHttpClient<ReverbDealFinderClient>(client =>
{
    client.Timeout = TimeSpan.FromMinutes(10);
});
builder.Services.AddSingleton<PriceGuideCache>();
builder.Services.AddSingleton<DealFinderService>();

// Register Sweetwater Deal Finder services
builder.Services.AddSingleton(sp =>
{
    var httpClientFactory = sp.GetRequiredService<IHttpClientFactory>();
    var httpClient = httpClientFactory.CreateClient("SweetwaterScraper");
    httpClient.Timeout = TimeSpan.FromMinutes(10);
    return new SweetwaterScraperClient(
        httpClient,
        sp.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>(),
        sp.GetRequiredService<ILogger<SweetwaterScraperClient>>());
});
builder.Services.AddHttpClient("SweetwaterScraper");
builder.Services.AddSingleton<SweetwaterDealFinderService>();

// Register UPS tracking service
builder.Services.AddHttpClient<UpsTrackingService>();
builder.Services.AddSingleton<UpsTrackingService>();

// Register background services
builder.Services.AddHostedService<OfferExpirationService>();
builder.Services.AddHostedService<DeliveryTrackingService>();

// Configure JWT Authentication
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("JWT secret key is not configured");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "LukesGuitarShop";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "LukesGuitarShopUsers";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey))
    };
});

// Configure CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.SetIsOriginAllowed(origin =>
                {
                    // Allow configured origins
                    if (allowedOrigins.Contains(origin)) return true;
                    // Allow all Vercel preview URLs
                    if (origin.EndsWith(".vercel.app")) return true;
                    return false;
                })
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Guitar Price Database API v1");
        options.RoutePrefix = "swagger";
        options.DocumentTitle = "Guitar Price Database API";
        options.DefaultModelsExpandDepth(2);
        options.DefaultModelExpandDepth(2);
    });
}

app.UseHttpsRedirection();

// Uploaded files are now served directly from Tigris (S3) — no static-file middleware needed.
// wwwroot/ is intentionally not served because it only ever held /uploads/ which has been migrated.

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
