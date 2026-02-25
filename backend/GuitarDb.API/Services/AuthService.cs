using GuitarDb.API.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace GuitarDb.API.Services;

public class AuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IConfiguration configuration, ILogger<AuthService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public string GenerateJwtToken(User user)
    {
        var secretKey = _configuration["Jwt:SecretKey"]
            ?? throw new InvalidOperationException("JWT secret key is not configured");
        var issuer = _configuration["Jwt:Issuer"] ?? "LukesGuitarShop";
        var audience = _configuration["Jwt:Audience"] ?? "LukesGuitarShopUsers";
        var expirationDays = int.Parse(_configuration["Jwt:ExpirationDays"] ?? "7");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id!),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim("is_guest", user.IsGuest.ToString().ToLower()),
            new Claim("is_admin", user.IsAdmin.ToString().ToLower())
        };

        if (!string.IsNullOrEmpty(user.Email))
        {
            claims.Add(new Claim(ClaimTypes.Email, user.Email));
        }

        if (!string.IsNullOrEmpty(user.GuestSessionId))
        {
            claims.Add(new Claim("guest_session_id", user.GuestSessionId));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expirationDays),
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        _logger.LogInformation("Generated JWT token for user: {UserId}", user.Id);

        return tokenString;
    }

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        return BCrypt.Net.BCrypt.Verify(password, passwordHash);
    }

    public string GenerateGuestSessionId()
    {
        return Guid.NewGuid().ToString("N");
    }
}
