using Microsoft.EntityFrameworkCore;
using Narravo.Data;
using Serilog;

namespace Narravo.Web;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Configure Serilog
        Log.Logger = new LoggerConfiguration()
            .ReadFrom.Configuration(builder.Configuration)
            .CreateLogger();

        builder.Host.UseSerilog();

        // Add services to the container
        ConfigureServices(builder.Services, builder.Configuration);

        var app = builder.Build();

        // Configure the HTTP request pipeline
        ConfigurePipeline(app);

        app.Run();
    }

    private static void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        // Database configuration
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Data Source=data/blog.db";
        
        services.AddDbContext<NarravoDbContext>(options =>
        {
            options.UseSqlite(connectionString);
        });

        // Add Razor Pages for public site
        services.AddRazorPages();

        // Add Blazor Server for admin
        services.AddServerSideBlazor();
        services.AddAntDesign();

        // Add authentication
        services.AddAuthentication("Cookies")
            .AddCookie("Cookies", options =>
            {
                options.LoginPath = "/Account/Login";
                options.LogoutPath = "/Account/Logout";
            });

        services.AddAuthorization();

        // Add output caching
        services.AddOutputCache();

        // Add HTTP context accessor
        services.AddHttpContextAccessor();

        // Add health checks
        services.AddHealthChecks()
            .AddDbContextCheck<NarravoDbContext>();
    }

    private static void ConfigurePipeline(WebApplication app)
    {
        // Configure the HTTP request pipeline
        if (!app.Environment.IsDevelopment())
        {
            app.UseExceptionHandler("/Error");
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseStaticFiles();

        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

        app.UseOutputCache();

        // Map health checks
        app.MapHealthChecks("/health");

        // Map Razor Pages for public site
        app.MapRazorPages();

        // Map Blazor hub for admin
        app.MapBlazorHub("/admin/_blazor");

        // Map fallback page for admin area
        app.MapFallbackToPage("/admin/{*path:nonfile}", "/Admin/Index");

        // Map root redirect
        app.MapGet("/", () => Results.Redirect("/Home"));
        app.MapGet("/Home", () => Results.Redirect("/"));

        // Map fallback for admin
        app.MapFallbackToPage("/Admin/Index");
    }
}
