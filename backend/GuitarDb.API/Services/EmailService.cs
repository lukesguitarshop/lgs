using System.Net;
using System.Net.Mail;

namespace GuitarDb.API.Services;

public class EmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;
    private readonly string? _smtpHost;
    private readonly int _smtpPort;
    private readonly string? _smtpUsername;
    private readonly string? _smtpPassword;
    private readonly string? _fromEmail;
    private readonly string _fromName;
    private readonly string? _sellerEmail;
    private readonly string? _frontendUrl;
    private readonly bool _isEnabled;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;

        _smtpHost = _configuration["Email:SmtpHost"];
        _smtpPort = int.TryParse(_configuration["Email:SmtpPort"], out var port) ? port : 587;
        _smtpUsername = _configuration["Email:SmtpUsername"];
        _smtpPassword = _configuration["Email:SmtpPassword"];
        _fromEmail = _configuration["Email:FromEmail"] ?? _smtpUsername;
        _fromName = _configuration["Email:FromName"] ?? "Luke's Guitar Shop";
        _sellerEmail = _configuration["Seller:Email"];
        _frontendUrl = _configuration["FrontendUrl"];

        // Email is enabled if SMTP credentials are configured
        _isEnabled = !string.IsNullOrEmpty(_smtpHost) &&
                     !string.IsNullOrEmpty(_smtpUsername) &&
                     !string.IsNullOrEmpty(_smtpPassword);

        if (!_isEnabled)
        {
            _logger.LogWarning("Email service is disabled - SMTP credentials not configured");
        }
    }

    /// <summary>
    /// Send email notification to seller when a new offer is received
    /// </summary>
    public async Task SendNewOfferNotificationAsync(
        string listingTitle,
        decimal offerAmount,
        string buyerName,
        string? buyerMessage = null)
    {
        if (!_isEnabled || string.IsNullOrEmpty(_sellerEmail))
        {
            _logger.LogDebug("Skipping new offer notification - email not configured");
            return;
        }

        var subject = $"New Offer: {offerAmount:C} for {listingTitle}";
        var body = $@"
<h2>New Offer Received</h2>
<p>You have received a new offer on your listing.</p>

<h3>Offer Details</h3>
<ul>
    <li><strong>Listing:</strong> {listingTitle}</li>
    <li><strong>Offer Amount:</strong> {offerAmount:C}</li>
    <li><strong>Buyer:</strong> {buyerName}</li>
</ul>

{(string.IsNullOrEmpty(buyerMessage) ? "" : $@"
<h3>Message from Buyer</h3>
<p>{buyerMessage}</p>
")}

<p>Log in to your admin panel to respond to this offer.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(_sellerEmail, subject, body);
    }

    /// <summary>
    /// Send email notification to buyer when seller makes a counter-offer
    /// </summary>
    public async Task SendCounterOfferNotificationAsync(
        string buyerEmail,
        string listingTitle,
        decimal originalOffer,
        decimal counterOffer,
        string? sellerMessage = null)
    {
        if (!_isEnabled || string.IsNullOrEmpty(buyerEmail))
        {
            _logger.LogDebug("Skipping counter offer notification - email not configured or buyer email missing");
            return;
        }

        var subject = $"Counter Offer: {counterOffer:C} for {listingTitle}";
        var body = $@"
<h2>Counter Offer Received</h2>
<p>The seller has made a counter offer on your offer.</p>

<h3>Offer Details</h3>
<ul>
    <li><strong>Listing:</strong> {listingTitle}</li>
    <li><strong>Your Offer:</strong> {originalOffer:C}</li>
    <li><strong>Counter Offer:</strong> {counterOffer:C}</li>
</ul>

{(string.IsNullOrEmpty(sellerMessage) ? "" : $@"
<h3>Message from Seller</h3>
<p>{sellerMessage}</p>
")}

<p>Log in to your account to accept or decline this counter offer.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(buyerEmail, subject, body);
    }

    /// <summary>
    /// Send email notification when an offer is accepted
    /// </summary>
    public async Task SendOfferAcceptedNotificationAsync(
        string recipientEmail,
        string listingTitle,
        decimal acceptedAmount,
        bool isBuyer)
    {
        if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
        {
            _logger.LogDebug("Skipping offer accepted notification - email not configured");
            return;
        }

        var subject = $"Offer Accepted: {listingTitle}";
        var body = isBuyer
            ? $@"
<h2>Congratulations! Your Offer Was Accepted</h2>
<p>The seller has accepted your offer.</p>

<h3>Order Details</h3>
<ul>
    <li><strong>Listing:</strong> {listingTitle}</li>
    <li><strong>Accepted Price:</strong> {acceptedAmount:C}</li>
</ul>

<p>Please proceed to checkout to complete your purchase.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
"
            : $@"
<h2>Offer Accepted</h2>
<p>You have accepted an offer on your listing.</p>

<h3>Sale Details</h3>
<ul>
    <li><strong>Listing:</strong> {listingTitle}</li>
    <li><strong>Sale Price:</strong> {acceptedAmount:C}</li>
</ul>

<p>The buyer has been notified to complete their purchase.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(recipientEmail, subject, body);
    }

    /// <summary>
    /// Send email notification to seller when an offer is accepted by the buyer
    /// </summary>
    public async Task SendOfferAcceptedToSellerAsync(
        string listingTitle,
        decimal acceptedAmount,
        string buyerName)
    {
        if (!_isEnabled || string.IsNullOrEmpty(_sellerEmail))
        {
            _logger.LogDebug("Skipping seller notification - email not configured");
            return;
        }

        var subject = $"Offer Accepted: {listingTitle}";
        var body = $@"
<h2>Offer Accepted</h2>
<p>A buyer has accepted an offer on your listing.</p>

<h3>Sale Details</h3>
<ul>
    <li><strong>Listing:</strong> {listingTitle}</li>
    <li><strong>Sale Price:</strong> {acceptedAmount:C}</li>
    <li><strong>Buyer:</strong> {buyerName}</li>
</ul>

<p>The buyer should proceed to checkout shortly.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(_sellerEmail, subject, body);
    }

    /// <summary>
    /// Send email notification when an offer is rejected
    /// </summary>
    public async Task SendOfferRejectedNotificationAsync(
        string buyerEmail,
        string listingTitle,
        decimal offerAmount,
        string? reason = null)
    {
        if (!_isEnabled || string.IsNullOrEmpty(buyerEmail))
        {
            _logger.LogDebug("Skipping offer rejected notification - email not configured");
            return;
        }

        var subject = $"Offer Update: {listingTitle}";
        var body = $@"
<h2>Offer Not Accepted</h2>
<p>Unfortunately, your offer was not accepted.</p>

<h3>Offer Details</h3>
<ul>
    <li><strong>Listing:</strong> {listingTitle}</li>
    <li><strong>Your Offer:</strong> {offerAmount:C}</li>
</ul>

{(string.IsNullOrEmpty(reason) ? "" : $@"
<h3>Seller's Response</h3>
<p>{reason}</p>
")}

<p>You may submit a new offer if you're still interested.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(buyerEmail, subject, body);
    }

    /// <summary>
    /// Send password reset email
    /// </summary>
    public async Task SendPasswordResetEmailAsync(
        string recipientEmail,
        string resetLink)
    {
        if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
        {
            _logger.LogDebug("Skipping password reset email - email not configured");
            return;
        }

        var subject = "Reset Your Password - Luke's Guitar Shop";
        var body = $@"
<h2>Password Reset Request</h2>
<p>We received a request to reset your password. Click the link below to create a new password:</p>

<p><a href=""{resetLink}"" style=""display: inline-block; padding: 12px 24px; background-color: #df5e15; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;"">Reset Password</a></p>

<p>Or copy and paste this link into your browser:</p>
<p style=""word-break: break-all; color: #666;"">{resetLink}</p>

<p><strong>This link will expire in 1 hour.</strong></p>

<p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(recipientEmail, subject, body);
    }

    /// <summary>
    /// Send email verification email
    /// </summary>
    public async Task SendEmailVerificationAsync(
        string recipientEmail,
        string verificationLink)
    {
        if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
        {
            _logger.LogDebug("Skipping email verification - email not configured");
            return;
        }

        var subject = "Verify Your Email - Luke's Guitar Shop";
        var body = $@"
<h2>Welcome to Luke's Guitar Shop!</h2>
<p>Thank you for creating an account. Please verify your email address by clicking the link below:</p>

<p><a href=""{verificationLink}"" style=""display: inline-block; padding: 12px 24px; background-color: #df5e15; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;"">Verify Email</a></p>

<p>Or copy and paste this link into your browser:</p>
<p style=""word-break: break-all; color: #666;"">{verificationLink}</p>

<p><strong>This link will expire in 24 hours.</strong></p>

<p>If you didn't create an account, you can safely ignore this email.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(recipientEmail, subject, body);
    }

    /// <summary>
    /// Send email notification for new message
    /// </summary>
    public async Task SendNewMessageNotificationAsync(
        string recipientEmail,
        string senderName,
        string messagePreview,
        string? listingTitle = null,
        string? conversationId = null)
    {
        if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
        {
            _logger.LogDebug("Skipping message notification - email not configured");
            return;
        }

        var subject = listingTitle != null
            ? $"New Message from {senderName} about {listingTitle}"
            : $"New Message from {senderName}";

        var conversationLink = !string.IsNullOrEmpty(conversationId) && !string.IsNullOrEmpty(_frontendUrl)
            ? $@"<p><a href=""{_frontendUrl}/messages/{conversationId}"" style=""display: inline-block; background-color: #df5e15; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;"">View Conversation</a></p>"
            : "";

        var body = $@"
<h2>New Message</h2>
<p>You have received a new message from {senderName}.</p>

{(string.IsNullOrEmpty(listingTitle) ? "" : $@"
<p><strong>Regarding:</strong> {listingTitle}</p>
")}

<h3>Message Preview</h3>
<p style=""background-color: #f5f5f5; padding: 15px; border-radius: 5px;"">{messagePreview}</p>

{conversationLink}

<p>Log in to your account to view the full conversation and reply.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

        await SendEmailAsync(recipientEmail, subject, body);
    }

    private async Task SendEmailAsync(string toEmail, string subject, string htmlBody)
    {
        if (!_isEnabled)
        {
            _logger.LogDebug("Email service disabled, not sending: {Subject} to {Email}", subject, toEmail);
            return;
        }

        try
        {
            using var client = new SmtpClient(_smtpHost!, _smtpPort);
            client.EnableSsl = true;
            client.Credentials = new NetworkCredential(_smtpUsername, _smtpPassword);

            var message = new MailMessage
            {
                From = new MailAddress(_fromEmail!, _fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            await client.SendMailAsync(message);
            _logger.LogInformation("Email sent successfully: {Subject} to {Email}", subject, toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email: {Subject} to {Email}", subject, toEmail);
            // Don't throw - email failures shouldn't break the main functionality
        }
    }
}
