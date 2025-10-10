# crm_1006

## Packaging

Build single-file EXE:

```
dotnet publish tools/server -c Release -r win-x64 -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishTrimmed=false
```
