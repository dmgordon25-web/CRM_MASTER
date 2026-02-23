CRM Release Package
===================

How to run
----------
1) Double-click Start CRM.bat
2) Wait for status lines in the launcher window
3) Browser opens automatically when ready

What the launcher guarantees
----------------------------
- Visible progress output for every step.
- Creates launcher.log in this folder.
- Reuses an existing CRM server on 8080-8100 when /health responds.
- Starts server.js on a free port from 8080-8100 when needed.
- Waits up to 20 seconds for readiness, then shows a clear error.
- Opens launcher.log automatically on failure.
- Uses bundled node\\node.exe first, then PATH node.exe fallback.

If launch fails
---------------
- Read launcher.log (opens automatically).
- Install Node.js LTS only if bundled node folder is missing/corrupt.
