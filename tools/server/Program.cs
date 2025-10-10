using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ServerApp;

internal static class Program
{
    [STAThread]
    public static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        using var logManager = LogManager.Create();
        var logger = logManager.Logger;

        try
        {
            var executableDirectory = Path.GetDirectoryName(Environment.ProcessPath) ?? Directory.GetCurrentDirectory();
            var defaultRoot = Path.Combine(executableDirectory, "crm-app");
            var options = LauncherOptions.Parse(args, defaultRoot);
            var rootDirectory = Path.GetFullPath(options.RootDirectory);

            if (!Directory.Exists(rootDirectory))
            {
                logger.LogError($"Root directory not found: {rootDirectory}");
                return 1;
            }

            var indexPath = Path.Combine(rootDirectory, "index.html");
            if (!File.Exists(indexPath))
            {
                logger.LogError($"Missing index.html at {indexPath}");
                return 1;
            }

            logger.LogInfo($"Serving static content from {rootDirectory}");

            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                Args = Array.Empty<string>(),
                ContentRootPath = rootDirectory
            });

            builder.Logging.ClearProviders();
            builder.WebHost.ConfigureKestrel(serverOptions =>
            {
                serverOptions.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(5);
                serverOptions.Limits.MaxRequestBodySize = 0;
                var port = options.Port;
                serverOptions.Listen(IPAddress.Loopback, port > 0 ? port : 0);
            });

            var fileProvider = new PhysicalFileProvider(rootDirectory);
            var contentTypeProvider = BuildContentTypeProvider();

            builder.Services.AddRouting();

            var app = builder.Build();

            string LogsDir()
            {
                var basePath = Environment.GetEnvironmentVariable("LOCALAPPDATA")
                               ?? Environment.GetEnvironmentVariable("APPDATA")
                               ?? AppContext.BaseDirectory;
                var dir = Path.Combine(basePath, "CRM", "logs");
                Directory.CreateDirectory(dir);
                return dir;
            }

            app.MapPost("/__log", async (HttpContext ctx) =>
            {
                using var reader = new StreamReader(ctx.Request.Body);
                var body = await reader.ReadToEndAsync();
                var line = System.Text.Json.JsonSerializer.Serialize(new
                {
                    t = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    body
                });
                await File.AppendAllTextAsync(Path.Combine(LogsDir(), "frontend.log"), line + "\n");
                return Results.NoContent();
            });

            app.MapGet("/healthz", () => Results.Text("ok"));

            if (options.EnableCors)
            {
                app.Use(async (context, next) =>
                {
                    context.Response.Headers["Access-Control-Allow-Origin"] = "*";
                    context.Response.Headers["Access-Control-Allow-Methods"] = "GET,HEAD,OPTIONS";
                    context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
                    if (HttpMethods.IsOptions(context.Request.Method))
                    {
                        context.Response.StatusCode = StatusCodes.Status204NoContent;
                        return;
                    }

                    await next();
                });
            }

            var defaultFilesOptions = new DefaultFilesOptions
            {
                FileProvider = fileProvider
            };
            defaultFilesOptions.DefaultFileNames.Clear();
            defaultFilesOptions.DefaultFileNames.Add("index.html");

            var staticFileOptions = new StaticFileOptions
            {
                FileProvider = fileProvider,
                ContentTypeProvider = contentTypeProvider,
                ServeUnknownFileTypes = false
            };

            app.UseDefaultFiles(defaultFilesOptions);
            app.UseStaticFiles(staticFileOptions);

            var indexFileInfo = fileProvider.GetFileInfo("index.html");
            var indexPhysicalPath = indexFileInfo.Exists
                ? indexFileInfo.PhysicalPath ?? Path.Combine(rootDirectory, "index.html")
                : Path.Combine(rootDirectory, "index.html");

            app.MapFallback(async context =>
            {
                if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
                {
                    context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
                    return;
                }

                context.Response.StatusCode = StatusCodes.Status200OK;
                context.Response.ContentType = "text/html; charset=utf-8";

                if (HttpMethods.IsHead(context.Request.Method))
                {
                    if (indexFileInfo.Exists && indexFileInfo.Length >= 0)
                    {
                        context.Response.ContentLength = indexFileInfo.Length;
                    }
                    else
                    {
                        var info = new FileInfo(indexPhysicalPath);
                        context.Response.ContentLength = info.Exists ? info.Length : 0;
                    }

                    return;
                }

                await context.Response.SendFileAsync(indexPhysicalPath);
            });

            try
            {
                await app.StartAsync();
            }
            catch (AddressInUseException)
            {
                logger.LogError($"Port {options.Port} is unavailable.");
                await app.DisposeAsync();
                return 1;
            }
            catch (IOException ioEx) when (ioEx.InnerException is AddressInUseException)
            {
                logger.LogError($"Port {options.Port} is unavailable.");
                await app.DisposeAsync();
                return 1;
            }
            catch (Exception startEx)
            {
                logger.LogError($"Failed to start server: {startEx.Message}");
                logger.LogDebug(startEx.ToString());
                await app.DisposeAsync();
                return 1;
            }

            var address = app.Urls.FirstOrDefault();
            if (string.IsNullOrEmpty(address))
            {
                logger.LogError("Unable to determine server address.");
                await app.StopAsync(TimeSpan.FromSeconds(5));
                await app.DisposeAsync();
                return 1;
            }

            var baseUri = new Uri(address);
            logger.LogInfo($"Listening at {baseUri}");

            if (!await ConfirmHealthAsync(baseUri, logger))
            {
                logger.LogError("Health check failed; shutting down server.");
                await app.StopAsync(TimeSpan.FromSeconds(5));
                await app.DisposeAsync();
                return 1;
            }

            logger.LogInfo($"LAUNCH OK : {baseUri}");

            var lifetime = app.Lifetime;

            void HandleCancel(object? sender, ConsoleCancelEventArgs eventArgs)
            {
                eventArgs.Cancel = true;
                logger.LogInfo("Shutdown requested. Stopping server...");
                lifetime.StopApplication();
            }

            void HandleProcessExit(object? _, EventArgs __)
            {
                lifetime.StopApplication();
            }

            Console.CancelKeyPress += HandleCancel;
            AppDomain.CurrentDomain.ProcessExit += HandleProcessExit;

            try
            {
                var shellTask = Shell.RunAsync(baseUri.ToString(), logger, lifetime, lifetime.ApplicationStopping);

                await Task.WhenAll(app.WaitForShutdownAsync(), shellTask);

                logger.LogInfo("Server stopped cleanly.");
                return 0;
            }
            finally
            {
                Console.CancelKeyPress -= HandleCancel;
                AppDomain.CurrentDomain.ProcessExit -= HandleProcessExit;
                await app.StopAsync(TimeSpan.FromSeconds(5));
                await app.DisposeAsync();
            }
        }
        catch (ArgumentException ex)
        {
            logger.LogError(ex.Message);
            return 1;
        }
        catch (Exception ex)
        {
            logger.LogError($"Unhandled exception: {ex.Message}");
            logger.LogDebug(ex.ToString());
            return 1;
        }
    }

    private static FileExtensionContentTypeProvider BuildContentTypeProvider()
    {
        var provider = new FileExtensionContentTypeProvider();

        provider.Mappings[".html"] = "text/html; charset=utf-8";
        provider.Mappings[".css"] = "text/css; charset=utf-8";
        provider.Mappings[".js"] = "application/javascript; charset=utf-8";
        provider.Mappings[".json"] = "application/json; charset=utf-8";
        provider.Mappings[".svg"] = "image/svg+xml";
        provider.Mappings[".png"] = "image/png";
        provider.Mappings[".jpg"] = "image/jpeg";
        provider.Mappings[".jpeg"] = "image/jpeg";
        provider.Mappings[".gif"] = "image/gif";
        provider.Mappings[".ico"] = "image/x-icon";
        provider.Mappings[".woff"] = "font/woff";
        provider.Mappings[".woff2"] = "font/woff2";
        provider.Mappings[".map"] = "application/json";

        return provider;
    }

    private static async Task<bool> ConfirmHealthAsync(Uri baseUri, Logger logger)
    {
        using var client = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(2)
        };

        var targets = new[]
        {
            new Uri(baseUri, "/"),
            new Uri(baseUri, "/index.html"),
            new Uri(baseUri, "/healthz")
        };

        for (var attempt = 0; attempt < 20; attempt++)
        {
            var allHealthy = true;

            foreach (var target in targets)
            {
                try
                {
                    using var response = await client.GetAsync(target);
                    if (!response.IsSuccessStatusCode)
                    {
                        allHealthy = false;
                        break;
                    }
                }
                catch
                {
                    allHealthy = false;
                    break;
                }
            }

            if (allHealthy)
            {
                return true;
            }

            await Task.Delay(250);
        }

        logger.LogWarn("Timed out waiting for server readiness.");
        return false;
    }
}

internal sealed class LauncherOptions
{
    private LauncherOptions(string rootDirectory, int port, bool enableCors)
    {
        RootDirectory = rootDirectory;
        Port = port;
        EnableCors = enableCors;
    }

    public string RootDirectory { get; }

    public int Port { get; }

    public bool EnableCors { get; }

    public static LauncherOptions Parse(string[] args, string defaultRoot)
    {
        var root = defaultRoot;
        var port = 0;
        var enableCors = false;

        var queue = new Queue<string>(args);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            switch (current)
            {
                case "--root":
                    if (queue.Count == 0)
                    {
                        throw new ArgumentException("--root requires a path value.");
                    }

                    root = queue.Dequeue();
                    break;
                case "--port":
                    if (queue.Count == 0)
                    {
                        throw new ArgumentException("--port requires a numeric value.");
                    }

                    if (!int.TryParse(queue.Dequeue(), NumberStyles.Integer, CultureInfo.InvariantCulture, out port))
                    {
                        throw new ArgumentException("--port must be an integer.");
                    }

                    if (port < 0 || port > 65535)
                    {
                        throw new ArgumentOutOfRangeException(nameof(port), "Port must be between 0 and 65535.");
                    }

                    break;
                case "--cors":
                    enableCors = ParseBoolean(queue);
                    break;
                default:
                    throw new ArgumentException($"Unknown argument: {current}");
            }
        }

        return new LauncherOptions(root, port, enableCors);
    }

    private static bool ParseBoolean(Queue<string> queue)
    {
        if (queue.Count == 0 || queue.Peek().StartsWith("--", StringComparison.Ordinal))
        {
            return true;
        }

        var value = queue.Dequeue();
        if (bool.TryParse(value, out var parsed))
        {
            return parsed;
        }

        if (string.Equals(value, "1", StringComparison.Ordinal))
        {
            return true;
        }

        if (string.Equals(value, "0", StringComparison.Ordinal))
        {
            return false;
        }

        if (string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(value, "no", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        throw new ArgumentException($"Invalid boolean value: {value}");
    }
}

internal sealed class LogManager : IDisposable
{
    private readonly StreamWriter? _writer;
    private readonly object _gate = new();

    private LogManager(StreamWriter? writer)
    {
        _writer = writer;
        Logger = new Logger(WriteLine);
    }

    public Logger Logger { get; }

    public static LogManager Create()
    {
        try
        {
            var baseDirectory = AppContext.BaseDirectory;
            string logDirectory;

            try
            {
                var toolsDirectory = Path.GetFullPath(Path.Combine(baseDirectory ?? Environment.CurrentDirectory, ".."));
                logDirectory = Path.Combine(toolsDirectory, "logs");
            }
            catch
            {
                logDirectory = Path.Combine(Environment.CurrentDirectory, "logs");
            }

            Directory.CreateDirectory(logDirectory);
            var fileName = $"launch_{DateTimeOffset.Now:yyyyMMdd_HHmmss}.log";
            var logPath = Path.Combine(logDirectory, fileName);
            var stream = new FileStream(logPath, FileMode.CreateNew, FileAccess.Write, FileShare.ReadWrite);
            var writer = new StreamWriter(stream) { AutoFlush = true };
            return new LogManager(writer);
        }
        catch
        {
            return new LogManager(null);
        }
    }

    private void WriteLine(string message)
    {
        var timestamp = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        var formatted = $"{timestamp} {message}";
        Console.WriteLine(formatted);

        if (_writer == null)
        {
            return;
        }

        lock (_gate)
        {
            _writer.WriteLine(formatted);
        }
    }

    public void Dispose()
    {
        _writer?.Dispose();
    }
}

internal sealed class Logger
{
    private readonly Action<string> _sink;

    public Logger(Action<string> sink)
    {
        _sink = sink;
    }

    public void LogInfo(string message) => _sink($"INFO  {message}");

    public void LogWarn(string message) => _sink($"WARN  {message}");

    public void LogError(string message) => _sink($"ERROR {message}");

    public void LogDebug(string message) => _sink($"DEBUG {message}");
}
