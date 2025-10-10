using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.Versioning;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Extensions.Hosting;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ServerApp;

[SupportedOSPlatform("windows")]
internal static class Shell
{
    public static Task RunAsync(string url, Logger logger, IHostApplicationLifetime lifetime, CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            logger.LogWarn("WebView2 shell only supported on Windows. Launching Microsoft Edge.");
            return LaunchEdgeFallbackAsync(url, logger, lifetime, cancellationToken);
        }

        try
        {
            _ = CoreWebView2Environment.GetAvailableBrowserVersionString();
        }
        catch (Exception ex) when (ex is WebView2RuntimeNotFoundException or DllNotFoundException or FileNotFoundException)
        {
            logger.LogWarn("WebView2 runtime not found. Launching Microsoft Edge.");
            logger.LogDebug(ex.ToString());
            return LaunchEdgeFallbackAsync(url, logger, lifetime, cancellationToken);
        }

        return RunWebViewAsync(url, logger, lifetime, cancellationToken);
    }

    private static async Task RunWebViewAsync(string url, Logger logger, IHostApplicationLifetime lifetime, CancellationToken cancellationToken)
    {
        var completion = new TaskCompletionSource<object?>();
        BrowserForm? formInstance = null;

        var thread = new Thread(() =>
        {
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                formInstance = new BrowserForm(url, lifetime, logger, completion);

                using var registration = cancellationToken.Register(() =>
                {
                    if (formInstance is null || formInstance.IsDisposed)
                    {
                        return;
                    }

                    try
                    {
                        formInstance.BeginInvoke(new Action(() =>
                        {
                            if (!formInstance.IsDisposed)
                            {
                                formInstance.Close();
                            }
                        }));
                    }
                    catch
                    {
                        // ignored
                    }
                });

                Application.Run(formInstance);
            }
            catch (Exception ex)
            {
                completion.TrySetException(ex);
            }
            finally
            {
                completion.TrySetResult(null);
            }
        })
        {
            IsBackground = true
        };

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();

        try
        {
            await completion.Task.ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            logger.LogWarn($"WebView2 shell failed: {ex.Message}");
            logger.LogDebug(ex.ToString());
            await LaunchEdgeFallbackAsync(url, logger, lifetime, cancellationToken).ConfigureAwait(false);
        }
    }

    private static async Task LaunchEdgeFallbackAsync(string url, Logger logger, IHostApplicationLifetime lifetime, CancellationToken cancellationToken)
    {
        var process = TryStartEdgeProcess(url, logger);
        if (process is null)
        {
            logger.LogInfo("Opened system browser. Use Ctrl+C to stop the server when finished.");
            return;
        }

        logger.LogInfo("Opened Microsoft Edge. Close the window to exit.");

        using var registration = cancellationToken.Register(() =>
        {
            try
            {
                if (!process.HasExited)
                {
                    process.CloseMainWindow();
                }
            }
            catch
            {
                // ignored
            }
        });

        try
        {
            await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(true);
                }
            }
            catch
            {
                // ignored
            }
        }

        if (!lifetime.ApplicationStopping.IsCancellationRequested)
        {
            lifetime.StopApplication();
        }
    }

    private static Process? TryStartEdgeProcess(string url, Logger logger)
    {
        var arguments = $"--app=\"{url}\"";

        foreach (var candidate in GetEdgeCandidates())
        {
            if (string.IsNullOrEmpty(candidate) || !File.Exists(candidate))
            {
                continue;
            }

            try
            {
                return Process.Start(new ProcessStartInfo(candidate, arguments)
                {
                    UseShellExecute = false
                });
            }
            catch (Exception ex)
            {
                logger.LogWarn($"Failed to start Edge from {candidate}: {ex.Message}");
            }
        }

        try
        {
            return Process.Start(new ProcessStartInfo("msedge.exe", arguments)
            {
                UseShellExecute = false
            });
        }
        catch (Exception ex)
        {
            logger.LogWarn($"Failed to start msedge.exe directly: {ex.Message}");
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            logger.LogError($"Failed to open browser: {ex.Message}");
            logger.LogDebug(ex.ToString());
        }

        return null;
    }

    private static IEnumerable<string> GetEdgeCandidates()
    {
        var paths = new List<string?>
        {
            Environment.GetEnvironmentVariable("ProgramFiles(x86)") is { Length: > 0 } x86
                ? Path.Combine(x86, "Microsoft", "Edge", "Application", "msedge.exe")
                : null,
            Environment.GetEnvironmentVariable("ProgramFiles") is { Length: > 0 } x64
                ? Path.Combine(x64, "Microsoft", "Edge", "Application", "msedge.exe")
                : null
        };

        foreach (var path in paths)
        {
            if (!string.IsNullOrEmpty(path))
            {
                yield return path;
            }
        }
    }

    private sealed class BrowserForm : Form
    {
        private readonly string _url;
        private readonly IHostApplicationLifetime _lifetime;
        private readonly Logger _logger;
        private readonly TaskCompletionSource<object?> _completion;
        private readonly WebView2 _webView;
        private bool _initialized;

        public BrowserForm(string url, IHostApplicationLifetime lifetime, Logger logger, TaskCompletionSource<object?> completion)
        {
            _url = url;
            _lifetime = lifetime;
            _logger = logger;
            _completion = completion;
            Text = "Start CRM";
            StartPosition = FormStartPosition.CenterScreen;
            Width = 1280;
            Height = 800;
            MinimumSize = new System.Drawing.Size(640, 480);

            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };

            Controls.Add(_webView);

            Load += OnLoad;
            FormClosed += OnFormClosed;
        }

        private async void OnLoad(object? sender, EventArgs e)
        {
            try
            {
                await _webView.EnsureCoreWebView2Async();
                if (_webView.CoreWebView2 is { } core)
                {
                    core.Settings.AreDefaultContextMenusEnabled = false;
                    core.Settings.AreDevToolsEnabled = false;
                    core.Settings.IsZoomControlEnabled = true;
                    core.Navigate(_url);
                }

                _initialized = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarn($"Failed to initialize WebView2: {ex.Message}");
                _logger.LogDebug(ex.ToString());
                _completion.TrySetException(ex);
                BeginInvoke(new Action(Close));
            }
        }

        private void OnFormClosed(object? sender, FormClosedEventArgs e)
        {
            if (_initialized)
            {
                _lifetime.StopApplication();
            }
        }
    }
}
