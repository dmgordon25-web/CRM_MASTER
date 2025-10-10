using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;
using System.Windows.Forms;

namespace ShellApp;
internal static class Program {
  [STAThread]
  static void Main(string[] args) {
    ApplicationConfiguration.Initialize();
    var url = args.Length > 0 ? args[0] : "http://127.0.0.1:0/";
    try {
      var form = new Form { Text = "CRM", Width = 1280, Height = 800 };
      var web = new WebView2{ Dock = DockStyle.Fill };
      form.Controls.Add(web);
      form.Shown += async (_,__) => {
        await web.EnsureCoreWebView2Async();
        web.CoreWebView2.Settings.AreDevToolsEnabled = true;
        web.Source = new Uri(url);
      };
      Application.Run(form);
    } catch {
      // Fallback: launch Edge as app window
      System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo {
        FileName = "msedge",
        Arguments = $"--app=\"{url}\"",
        UseShellExecute = true
      });
    }
  }
}
