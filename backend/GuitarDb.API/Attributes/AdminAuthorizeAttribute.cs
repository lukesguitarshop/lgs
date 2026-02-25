using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GuitarDb.API.Attributes;

/// <summary>
/// Authorization attribute that requires the user to be authenticated AND have is_admin claim set to true.
/// Returns 401 Unauthorized if not authenticated, 403 Forbidden if authenticated but not admin.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public class AdminAuthorizeAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // Check if user is authenticated
        if (user.Identity == null || !user.Identity.IsAuthenticated)
        {
            context.Result = new UnauthorizedObjectResult(new { error = "Authentication required" });
            return;
        }

        // Check if user has is_admin claim set to true
        var isAdminClaim = user.FindFirst("is_admin")?.Value;
        if (string.IsNullOrEmpty(isAdminClaim) || !bool.TryParse(isAdminClaim, out var isAdmin) || !isAdmin)
        {
            context.Result = new ObjectResult(new { error = "Admin access required" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }
    }
}
