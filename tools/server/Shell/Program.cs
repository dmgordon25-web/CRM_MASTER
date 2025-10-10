using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;
using System.Windows.Forms;

namespace ShellApp;

internal static class Program {
  [STAThread]
  static void Main(string[] args) {
    ApplicationConfiguration.Initialize();

    var urlText = args.Length > 0 ? args[0] : Environment.GetEnvironmentVariable("CRM_SERVER_URL");
    if (string.IsNullOrWhiteSpace(urlText) || !Uri.TryCreate(urlText, UriKind.Absolute, out var targetUri)) {
      MessageBox.Show(
        "CRM server URL was not provided. Start the shell via run.ps1 or pass the server URL as the first argument.",
        "CRM Shell",
        MessageBoxButtons.OK,
        MessageBoxIcon.Error
      );
      return;
    }

    try {
      var form = new Form { Text = "CRM", Width = 1280, Height = 800 };
      var web = new WebView2 { Dock = DockStyle.Fill };
      form.Controls.Add(web);
      form.Shown += async (_, __) => {
        await web.EnsureCoreWebView2Async();
        web.CoreWebView2.Settings.AreDevToolsEnabled = true;
        web.Source = targetUri;
      };
      Application.Run(form);
    } catch {
      // Fallback: launch Edge as app window
      System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo {
        FileName = "msedge",
        Arguments = $"--app=\"{targetUri.AbsoluteUri}\"",
        UseShellExecute = true
      });
    }
  }
}
