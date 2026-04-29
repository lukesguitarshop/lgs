namespace GuitarDb.API.Services;

/// <summary>
/// Abstraction for object/file storage. Implementations may target local disk,
/// S3, or any other backend. Keys are forward-slash separated paths (no leading slash).
/// </summary>
public interface IFileStorageService
{
    /// <summary>
    /// Upload <paramref name="content"/> to <paramref name="key"/> with the given content type.
    /// Returns a publicly accessible URL to the object.
    /// </summary>
    Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>
    /// Delete a single object by key. Idempotent (no error if the object does not exist).
    /// </summary>
    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// Delete every object whose key starts with <paramref name="prefix"/>.
    /// Used to clean up "directories" of files. Idempotent.
    /// </summary>
    Task DeletePrefixAsync(string prefix, CancellationToken ct = default);
}
