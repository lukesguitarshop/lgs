using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace GuitarDb.API.Services;

/// <summary>
/// S3-compatible file storage. Targets Tigris on Fly.io by default but works against any
/// S3-compatible endpoint via env vars:
///   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION, BUCKET_NAME.
///
/// The client is created lazily on first use so the API can boot for endpoints that don't
/// touch storage even when the env vars are missing in dev.
/// </summary>
public class S3FileStorageService : IFileStorageService, IDisposable
{
    private readonly ILogger<S3FileStorageService> _logger;
    private readonly Lazy<S3Context> _context;

    public S3FileStorageService(ILogger<S3FileStorageService> logger)
    {
        _logger = logger;
        _context = new Lazy<S3Context>(BuildContext, isThreadSafe: true);
    }

    private record S3Context(IAmazonS3 Client, string Bucket, string PublicBaseUrl);

    private S3Context BuildContext()
    {
        var accessKey = Environment.GetEnvironmentVariable("AWS_ACCESS_KEY_ID");
        var secretKey = Environment.GetEnvironmentVariable("AWS_SECRET_ACCESS_KEY");
        var endpoint = Environment.GetEnvironmentVariable("AWS_ENDPOINT_URL_S3");
        var region = Environment.GetEnvironmentVariable("AWS_REGION") ?? "auto";
        var bucket = Environment.GetEnvironmentVariable("BUCKET_NAME");

        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(accessKey)) missing.Add("AWS_ACCESS_KEY_ID");
        if (string.IsNullOrWhiteSpace(secretKey)) missing.Add("AWS_SECRET_ACCESS_KEY");
        if (string.IsNullOrWhiteSpace(endpoint)) missing.Add("AWS_ENDPOINT_URL_S3");
        if (string.IsNullOrWhiteSpace(bucket)) missing.Add("BUCKET_NAME");
        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"S3 file storage is misconfigured. Missing required environment variable(s): {string.Join(", ", missing)}. " +
                "On Fly.io, run `fly storage create` to provision a Tigris bucket and have these injected automatically.");
        }

        var config = new AmazonS3Config
        {
            ServiceURL = endpoint,
            ForcePathStyle = true,
            // Tigris ignores the region but the SDK requires one resolvable from a system name.
            AuthenticationRegion = region
        };

        var credentials = new BasicAWSCredentials(accessKey, secretKey);
        var client = new AmazonS3Client(credentials, config);

        // Public URL pattern for path-style S3 endpoints: {endpoint}/{bucket}/{key}
        var publicBase = $"{endpoint!.TrimEnd('/')}/{bucket}";
        _logger.LogInformation("S3 file storage initialised. Endpoint={Endpoint} Bucket={Bucket}", endpoint, bucket);
        return new S3Context(client, bucket!, publicBase);
    }

    public async Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var ctx = _context.Value;
        var request = new PutObjectRequest
        {
            BucketName = ctx.Bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            CannedACL = S3CannedACL.PublicRead,
            DisablePayloadSigning = true
        };
        await ctx.Client.PutObjectAsync(request, ct);
        return $"{ctx.PublicBaseUrl}/{key}";
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var ctx = _context.Value;
        try
        {
            await ctx.Client.DeleteObjectAsync(new DeleteObjectRequest
            {
                BucketName = ctx.Bucket,
                Key = key
            }, ct);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Idempotent: deleting a missing key is fine.
        }
    }

    public async Task DeletePrefixAsync(string prefix, CancellationToken ct = default)
    {
        var ctx = _context.Value;
        string? continuationToken = null;

        do
        {
            var listRequest = new ListObjectsV2Request
            {
                BucketName = ctx.Bucket,
                Prefix = prefix,
                ContinuationToken = continuationToken
            };
            var listResponse = await ctx.Client.ListObjectsV2Async(listRequest, ct);
            if (listResponse.S3Objects != null && listResponse.S3Objects.Count > 0)
            {
                // S3 DeleteObjects accepts up to 1000 keys per request.
                foreach (var batch in listResponse.S3Objects.Chunk(1000))
                {
                    var del = new DeleteObjectsRequest
                    {
                        BucketName = ctx.Bucket,
                        Objects = batch.Select(o => new KeyVersion { Key = o.Key }).ToList(),
                        Quiet = true
                    };
                    await ctx.Client.DeleteObjectsAsync(del, ct);
                }
            }

            continuationToken = listResponse.IsTruncated == true ? listResponse.NextContinuationToken : null;
        } while (!string.IsNullOrEmpty(continuationToken));
    }

    public void Dispose()
    {
        if (_context.IsValueCreated)
        {
            _context.Value.Client.Dispose();
        }
        GC.SuppressFinalize(this);
    }
}
