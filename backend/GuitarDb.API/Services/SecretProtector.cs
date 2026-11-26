using System.Security.Cryptography;
using System.Text;

namespace GuitarDb.API.Services;

/// <summary>
/// Encrypts small secrets (a guest seller's Reverb token) before they are stored in MongoDB,
/// so a database dump alone does not hand out working credentials.
///
/// AES-256-GCM. The key is derived from Jwt:SecretKey, which production already keeps as a
/// Fly secret, so there is no extra secret to provision. Rotating the JWT secret makes stored
/// tokens unreadable; the seller then simply pastes their token again.
/// </summary>
public static class SecretProtector
{
    private const string Version = "v1";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static string Protect(string plaintext, string masterSecret)
    {
        var key = DeriveKey(masterSecret);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plainBytes, cipher, tag);

        var payload = new byte[NonceSize + TagSize + cipher.Length];
        nonce.CopyTo(payload, 0);
        tag.CopyTo(payload, NonceSize);
        cipher.CopyTo(payload, NonceSize + TagSize);

        return $"{Version}:{Convert.ToBase64String(payload)}";
    }

    /// <summary>
    /// Returns the original secret, or null when the value is missing, malformed, tampered
    /// with, or was encrypted under a different master secret.
    /// </summary>
    public static string? Unprotect(string? protectedValue, string masterSecret)
    {
        if (string.IsNullOrEmpty(protectedValue) || !protectedValue.StartsWith(Version + ":"))
        {
            return null;
        }

        try
        {
            var payload = Convert.FromBase64String(protectedValue[(Version.Length + 1)..]);
            if (payload.Length < NonceSize + TagSize) return null;

            var nonce = payload.AsSpan(0, NonceSize);
            var tag = payload.AsSpan(NonceSize, TagSize);
            var cipher = payload.AsSpan(NonceSize + TagSize);
            var plain = new byte[cipher.Length];

            using var aes = new AesGcm(DeriveKey(masterSecret), TagSize);
            aes.Decrypt(nonce, cipher, tag, plain);

            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            return null;
        }
    }

    private static byte[] DeriveKey(string masterSecret) =>
        HKDF.DeriveKey(
            HashAlgorithmName.SHA256,
            Encoding.UTF8.GetBytes(masterSecret),
            outputLength: 32,
            info: Encoding.UTF8.GetBytes("lgs-seller-reverb-token"));
}
