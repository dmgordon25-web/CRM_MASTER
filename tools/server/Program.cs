using System.Text.Json;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:0"); // choose a free port
var app = builder.Build();

string WebRoot() => Path.Combine(AppContext.BaseDirectory, "crm-app");
string LogsDir(){
  var basePath = Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? AppContext.BaseDirectory;
  var dir = Path.Combine(basePath, "CRM", "logs");
  Directory.CreateDirectory(dir);
  return dir;
}

app.UseDefaultFiles(new DefaultFilesOptions{ FileProvider = new PhysicalFileProvider(WebRoot()) });
app.UseStaticFiles(new StaticFileOptions{ FileProvider = new PhysicalFileProvider(WebRoot()) });

app.MapPost("/__log", async (HttpContext ctx) => {
  using var reader = new StreamReader(ctx.Request.Body);
  var body = await reader.ReadToEndAsync();
  var line = JsonSerializer.Serialize(new {
    t = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
    body
  });
  await File.AppendAllTextAsync(Path.Combine(LogsDir(), "frontend.log"), line + "\n");
  return Results.NoContent();
});

app.MapGet("/healthz", () => Results.Ok(new { ok = true }));

await app.StartAsync();
Console.WriteLine(app.Urls.First()); // used by the shell to navigate
await app.WaitForShutdownAsync();
