using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly AuthService _authService;
    private readonly EmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        MongoDbService mongoDbService,
        AuthService authService,
        EmailService emailService,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _mongoDbService = mongoDbService;
        _authService = authService;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Register a new user account
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest(new { error = "Email, password, and full name are required" });
        }

        if (request.Password.Length < 6)
        {
            return BadRequest(new { error = "Password must be at least 6 characters" });
        }

        if (request.FullName.Trim().Length > 40)
        {
            return BadRequest(new { error = "Full name must be 40 characters or less" });
        }

        var email = request.Email.ToLowerInvariant().Trim();

        var existingUser = await _mongoDbService.GetUserByEmailAsync(email);
        if (existingUser != null)
        {
            // If user exists but is not verified, resend verification email
            if (!existingUser.EmailVerified)
            {
                var newVerificationToken = await _mongoDbService.CreateEmailVerificationTokenAsync(existingUser.Id!);
                var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:3000";
                var newVerificationLink = $"{frontendUrl}/verify-email?token={newVerificationToken.Token}";
                await _emailService.SendEmailVerificationAsync(email, newVerificationLink);

                return Ok(new { message = "A verification email has been sent. Please check your inbox." });
            }
            return BadRequest(new { error = "Email already registered" });
        }

        var user = new User
        {
            Email = email,
            PasswordHash = _authService.HashPassword(request.Password),
            FullName = request.FullName.Trim(),
            IsGuest = false,
            EmailVerified = false
        };

        await _mongoDbService.CreateUserAsync(user);
        _logger.LogInformation("User registered: {Email}", email);

        // Link any guest orders to the new user account
        var linkedCount = 0;

        // Try linking by guest session ID first
        if (!string.IsNullOrEmpty(request.GuestSessionId))
        {
            linkedCount += await _mongoDbService.LinkGuestOrdersToUserAsync(request.GuestSessionId, user.Id!);
        }

        // Also link any orders with matching guest email
        linkedCount += await _mongoDbService.LinkGuestOrdersByEmailToUserAsync(email, user.Id!);

        if (linkedCount > 0)
        {
            _logger.LogInformation("Linked {Count} guest orders to new user {UserId}", linkedCount, user.Id);
        }

        // Create verification token and send email
        var verificationToken = await _mongoDbService.CreateEmailVerificationTokenAsync(user.Id!);
        var frontendBaseUrl = _configuration["FrontendUrl"] ?? "http://localhost:3000";
        var verificationLink = $"{frontendBaseUrl}/verify-email?token={verificationToken.Token}";
        await _emailService.SendEmailVerificationAsync(email, verificationLink);

        _logger.LogInformation("Verification email sent to: {Email}", email);

        return Ok(new { message = "Registration successful! Please check your email to verify your account." });
    }

    /// <summary>
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required" });
        }

        var email = request.Email.ToLowerInvariant().Trim();
        var user = await _mongoDbService.GetUserByEmailAsync(email);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
        {
            return Unauthorized(new { error = "Invalid email or password" });
        }

        if (!_authService.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { error = "Invalid email or password" });
        }

        // Check if email is verified
        if (!user.EmailVerified)
        {
            return Unauthorized(new { error = "Please verify your email before signing in. Check your inbox for the verification link.", code = "EMAIL_NOT_VERIFIED" });
        }

        _logger.LogInformation("User logged in: {Email}", email);

        var token = _authService.GenerateJwtToken(user);

        return Ok(new AuthResponse
        {
            Token = token,
            User = MapToUserDto(user)
        });
    }

    /// <summary>
    /// Get current user profile
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        return Ok(MapToUserDto(user));
    }

    /// <summary>
    /// Update user profile
    /// </summary>
    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound(new { error = "User not found" });
        }

        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            if (request.FullName.Trim().Length > 40)
            {
                return BadRequest(new { error = "Full name must be 40 characters or less" });
            }
            user.FullName = request.FullName.Trim();
        }

        if (request.ShippingAddress != null)
        {
            user.ShippingAddress = new UserShippingAddress
            {
                FullName = request.ShippingAddress.FullName,
                Line1 = request.ShippingAddress.Line1,
                Line2 = request.ShippingAddress.Line2,
                City = request.ShippingAddress.City,
                State = request.ShippingAddress.State,
                PostalCode = request.ShippingAddress.PostalCode,
                Country = request.ShippingAddress.Country
            };
        }

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            if (request.NewPassword.Length < 6)
            {
                return BadRequest(new { error = "Password must be at least 6 characters" });
            }

            if (!user.IsGuest && string.IsNullOrWhiteSpace(request.CurrentPassword))
            {
                return BadRequest(new { error = "Current password is required to change password" });
            }

            if (!user.IsGuest && !string.IsNullOrEmpty(user.PasswordHash))
            {
                if (!_authService.VerifyPassword(request.CurrentPassword!, user.PasswordHash))
                {
                    return BadRequest(new { error = "Current password is incorrect" });
                }
            }

            user.PasswordHash = _authService.HashPassword(request.NewPassword);
        }

        await _mongoDbService.UpdateUserAsync(userId, user);
        _logger.LogInformation("Profile updated for user: {UserId}", userId);

        return Ok(MapToUserDto(user));
    }

    /// <summary>
    /// Get user's order history
    /// </summary>
    [HttpGet("orders")]
    [Authorize]
    public async Task<IActionResult> GetUserOrders()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        var orders = await _mongoDbService.GetOrdersByUserIdAsync(userId);
        return Ok(orders.Select(o => new OrderSummaryDto
        {
            Id = o.Id!,
            TotalAmount = o.TotalAmount,
            Currency = o.Currency,
            Status = o.Status,
            CreatedAt = o.CreatedAt,
            ItemCount = o.Items?.Count ?? 0,
            Items = o.Items?.Select(i => new OrderItemDto
            {
                ListingTitle = i.ListingTitle,
                Price = i.Price,
                Quantity = i.Quantity
            }).ToList() ?? new List<OrderItemDto>()
        }));
    }

    /// <summary>
    /// Request password reset email
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { error = "Email is required" });
        }

        var email = request.Email.ToLowerInvariant().Trim();
        var user = await _mongoDbService.GetUserByEmailAsync(email);

        // Always return success to prevent email enumeration
        if (user == null || user.IsGuest)
        {
            _logger.LogInformation("Password reset requested for non-existent email: {Email}", email);
            return Ok(new { message = "If an account exists with this email, a password reset link has been sent." });
        }

        var resetToken = await _mongoDbService.CreatePasswordResetTokenAsync(user.Id!);

        // Build reset link
        var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:3000";
        var resetLink = $"{frontendUrl}/reset-password?token={resetToken.Token}";

        await _emailService.SendPasswordResetEmailAsync(email, resetLink);
        _logger.LogInformation("Password reset email sent to: {Email}", email);

        return Ok(new { message = "If an account exists with this email, a password reset link has been sent." });
    }

    /// <summary>
    /// Reset password with token
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { error = "Reset token is required" });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { error = "New password is required" });
        }

        if (request.NewPassword.Length < 6)
        {
            return BadRequest(new { error = "Password must be at least 6 characters" });
        }

        var resetToken = await _mongoDbService.GetPasswordResetTokenAsync(request.Token);
        if (resetToken == null)
        {
            return BadRequest(new { error = "Invalid or expired reset token" });
        }

        var user = await _mongoDbService.GetUserByIdAsync(resetToken.UserId);
        if (user == null)
        {
            return BadRequest(new { error = "User not found" });
        }

        // Update password
        var passwordHash = _authService.HashPassword(request.NewPassword);
        await _mongoDbService.UpdateUserPasswordAsync(user.Id!, passwordHash);

        // Mark token as used
        await _mongoDbService.MarkPasswordResetTokenUsedAsync(request.Token);

        _logger.LogInformation("Password reset successfully for user: {UserId}", user.Id);

        return Ok(new { message = "Password has been reset successfully. You can now sign in with your new password." });
    }

    /// <summary>
    /// Verify email with token
    /// </summary>
    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { error = "Verification token is required" });
        }

        var verificationToken = await _mongoDbService.GetEmailVerificationTokenAsync(request.Token);
        if (verificationToken == null)
        {
            return BadRequest(new { error = "Invalid or expired verification token" });
        }

        var user = await _mongoDbService.GetUserByIdAsync(verificationToken.UserId);
        if (user == null)
        {
            return BadRequest(new { error = "User not found" });
        }

        if (user.EmailVerified)
        {
            return Ok(new { message = "Email already verified. You can sign in." });
        }

        // Mark email as verified
        await _mongoDbService.SetUserEmailVerifiedAsync(user.Id!);

        // Mark token as used
        await _mongoDbService.MarkEmailVerificationTokenUsedAsync(request.Token);

        _logger.LogInformation("Email verified for user: {UserId}", user.Id);

        return Ok(new { message = "Email verified successfully! You can now sign in." });
    }

    /// <summary>
    /// Resend verification email
    /// </summary>
    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { error = "Email is required" });
        }

        var email = request.Email.ToLowerInvariant().Trim();
        var user = await _mongoDbService.GetUserByEmailAsync(email);

        // Always return success to prevent email enumeration
        if (user == null || user.IsGuest)
        {
            _logger.LogInformation("Resend verification requested for non-existent email: {Email}", email);
            return Ok(new { message = "If an account exists with this email, a verification link has been sent." });
        }

        if (user.EmailVerified)
        {
            return Ok(new { message = "Email is already verified. You can sign in." });
        }

        var verificationToken = await _mongoDbService.CreateEmailVerificationTokenAsync(user.Id!);
        var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:3000";
        var verificationLink = $"{frontendUrl}/verify-email?token={verificationToken.Token}";
        await _emailService.SendEmailVerificationAsync(email, verificationLink);

        _logger.LogInformation("Resent verification email to: {Email}", email);

        return Ok(new { message = "If an account exists with this email, a verification link has been sent." });
    }

    private static UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id!,
            Email = user.Email,
            FullName = user.FullName,
            CreatedAt = user.CreatedAt,
            IsGuest = user.IsGuest,
            IsAdmin = user.IsAdmin,
            EmailVerified = user.EmailVerified,
            ShippingAddress = user.ShippingAddress != null ? new ShippingAddressDto
            {
                FullName = user.ShippingAddress.FullName,
                Line1 = user.ShippingAddress.Line1,
                Line2 = user.ShippingAddress.Line2,
                City = user.ShippingAddress.City,
                State = user.ShippingAddress.State,
                PostalCode = user.ShippingAddress.PostalCode,
                Country = user.ShippingAddress.Country
            } : null
        };
    }
}

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? GuestSessionId { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class UpdateProfileRequest
{
    public string? FullName { get; set; }
    public string? CurrentPassword { get; set; }
    public string? NewPassword { get; set; }
    public ShippingAddressDto? ShippingAddress { get; set; }
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class VerifyEmailRequest
{
    public string Token { get; set; } = string.Empty;
}

public class ResendVerificationRequest
{
    public string Email { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; } = new();
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string FullName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsGuest { get; set; }
    public bool IsAdmin { get; set; }
    public bool EmailVerified { get; set; }
    public ShippingAddressDto? ShippingAddress { get; set; }
}

public class ShippingAddressDto
{
    public string FullName { get; set; } = string.Empty;
    public string Line1 { get; set; } = string.Empty;
    public string? Line2 { get; set; }
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
}

public class OrderSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int ItemCount { get; set; }
    public List<OrderItemDto> Items { get; set; } = new();
}

public class OrderItemDto
{
    public string ListingTitle { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}
