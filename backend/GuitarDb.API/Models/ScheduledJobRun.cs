using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

/// <summary>
/// One record per scheduled job execution. Acts as the idempotency marker that
/// stops a job running twice on the same day across restarts and deploys.
/// </summary>
public class ScheduledJobRun
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("job_name")]
    public string JobName { get; set; } = string.Empty;

    /// <summary>
    /// The date the run belongs to, in the job's configured time zone, as "yyyy-MM-dd".
    /// Stored as a string so the calendar date is unambiguous regardless of server time zone.
    /// </summary>
    [BsonElement("run_date")]
    public string RunDate { get; set; } = string.Empty;

    [BsonElement("started_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime StartedAt { get; set; }

    [BsonElement("completed_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    /// <summary>running | success | partial | failed</summary>
    [BsonElement("outcome")]
    public string Outcome { get; set; } = "running";

    [BsonElement("details")]
    public string? Details { get; set; }
}
