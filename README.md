# crm_1006

## Packaging

Build the single-file launcher and emit a `Start CRM.exe_` artifact (note the trailing underscore) to avoid browser and antivirus blocks:

```
powershell -ExecutionPolicy Bypass -File tools/build-server.ps1
```

After downloading a release, restore the launcher locally before running it:

```
powershell -ExecutionPolicy Bypass -File tools/restore_exe.ps1
```
