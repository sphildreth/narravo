using Microsoft.EntityFrameworkCore;
using Narravo.Data;
using Narravo.Core.Interfaces;
using Narravo.Web.Services;
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
            options.UseSqlite(connectionString, b => b.MigrationsAssembly("Narravo.Web"));
        });

        // Add Razor Pages for public site
        services.AddRazorPages();

        // Add Blazor Server for admin
        services.AddServerSideBlazor();

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

        // Add application services
        services.AddScoped<IPostService, PostService>();
        services.AddSingleton<IFileStore, LocalFileStore>();
        services.AddScoped<IDataSeeder, DataSeeder>();
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

        // Map fallback page for admin area only
        app.MapFallbackToPage("/admin/{*path:nonfile}", "/Admin/Index");

        // Seed the database in development
        if (app.Environment.IsDevelopment())
        {
            using var scope = app.Services.CreateScope();
            var seeder = scope.ServiceProvider.GetRequiredService<IDataSeeder>();
            seeder.SeedAsync().GetAwaiter().GetResult();
        }
    }
}
