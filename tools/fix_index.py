
import os

file_path = 'crm-app/index.html'
target_line_content = "'./js/ui/help_hints.js',"

footer = """                './js/ui/ui_mode.js'
            ];
        }
    </script>
    <script type="module" src="./js/router/init.js"></script>
    <script type="module">
        import { ensureCoreThenPatches } from './js/boot/boot_hardener.js?v=2';
        import { CORE, PATCHES, REQUIRED } from './js/boot/manifest.js?v=2';
        console.log('[INDEX] CORE modules:', CORE);
        ensureCoreThenPatches({ CORE, PATCHES, REQUIRED });
    </script>
</body>
</html>"""

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
found = False
for line in lines:
    new_lines.append(line)
    if target_line_content in line:
        found = True
        break

if found:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        f.write(footer)
    print("Successfully repaired index.html")
else:
    print("Target line not found, could not repair.")
