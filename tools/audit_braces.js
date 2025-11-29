const fs = require('fs');

const code = fs.readFileSync('crm-app/js/app.js', 'utf8');
const lines = code.split('\n');

let stack = [];
let inString = false;
let stringChar = '';
let inComment = false; // Multi-line comment

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 3563) console.log(`Line 3564 content: "${line}"`); // 0-indexed i=3563 is line 3564
    let inLineComment = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (inLineComment) break;

        if (inString) {
            if (char === stringChar && line[j - 1] !== '\\') {
                inString = false;
            }
            continue;
        }

        if (inComment) {
            if (char === '*' && line[j + 1] === '/') {
                inComment = false;
                j++;
            }
            continue;
        }

        if (char === '/' && line[j + 1] === '/') {
            inLineComment = true;
            j++;
            continue;
        }

        if (char === '/' && line[j + 1] === '*') {
            inComment = true;
            j++;
            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            inString = true;
            stringChar = char;
            continue;
        }

        // Check for regex literals (simplified)
        if (char === '/' && !inString && !inComment && !inLineComment) {
            // This is hard to detect perfectly without a full parser, skipping for now
            // assuming code is mostly standard.
        }

        if (['{', '(', '['].includes(char)) {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (['}', ')', ']'].includes(char)) {
            if (stack.length === 0) {
                console.log(`Extra closing delimiter '${char}' at line ${i + 1}, col ${j + 1}`);
            } else {
                const last = stack.pop();

                if (i === 3563) {
                    console.log(`Line 3564 Pop: ${last.char} (from Line ${last.line}) with ${char}. Stack size: ${stack.length}`);
                }

                const expected = last.char === '{' ? '}' : last.char === '(' ? ')' : ']';
                if (char !== expected) {
                    console.log(`Mismatched delimiter at line ${i + 1}, col ${j + 1}. Expected '${expected}' but found '${char}'. Opened at line ${last.line}, col ${last.col}`);
                }
            }
        }
    }
}

console.log(`Final Stack Length: ${stack.length}`);
if (stack.length > 0) {
    console.log(`Unclosed delimiters found:`);
    for (let k = 0; k < stack.length; k++) {
        const item = stack[k];
        console.log(`[${k}] '${item.char}' at Line ${item.line}, Col ${item.col}`);
    }
} else {
    console.log('All delimiters balanced.');
}

console.log(`Final State: inString=${inString}, inComment=${inComment}`);
