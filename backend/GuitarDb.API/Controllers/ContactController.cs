using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Net.Mail;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContactController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ContactController> _logger;

    public ContactController(IConfiguration configuration, ILogger<ContactController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Send a contact form message via email
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] ContactRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "All fields are required" });
        }

        try
        {
            var smtpHost = _configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
            var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");
            var smtpUsername = _configuration["Email:SmtpUsername"] ?? "";
            var smtpPassword = _configuration["Email:SmtpPassword"] ?? "";
            var toEmail = _configuration["Email:ToEmail"] ?? "lukesguitarshop@gmail.com";

            if (string.IsNullOrEmpty(smtpUsername) || string.IsNullOrEmpty(smtpPassword))
            {
                _logger.LogError("Email configuration is missing");
                return StatusCode(500, new { error = "Email service is not configured" });
            }

            using var client = new SmtpClient(smtpHost, smtpPort)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(smtpUsername, smtpPassword)
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(smtpUsername, "Luke's Guitar Shop Contact Form"),
                Subject = $"Contact Form: {request.Subject}",
                Body = $@"New message from Luke's Guitar Shop contact form:

Name: {request.Name}
Email: {request.Email}
Subject: {request.Subject}

Message:
{request.Message}

---
Reply directly to this email to respond to {request.Name} at {request.Email}",
                IsBodyHtml = false
            };

            mailMessage.To.Add(toEmail);
            mailMessage.ReplyToList.Add(new MailAddress(request.Email, request.Name));

            await client.SendMailAsync(mailMessage);

            _logger.LogInformation("Contact form message sent from {Email}", request.Email);

            return Ok(new { message = "Message sent successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send contact form email");
            return StatusCode(500, new { error = "Failed to send message. Please try again later." });
        }
    }
}

public class ContactRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
