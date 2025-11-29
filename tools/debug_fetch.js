const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const url = 'http://127.0.0.1:8080/js/app.js';
const filePath = path.join(__dirname, '../crm-app/js/app.js');

http.get(url, (res) => {
    const hash = crypto.createHash('md5');
    let len = 0;
    res.on('data', (chunk) => {
        hash.update(chunk);
        len += chunk.length;
    });
    res.on('end', () => {
        const remoteHash = hash.digest('hex');
        console.log('Remote MD5:', remoteHash);
        console.log('Remote Length:', len);

        const localContent = fs.readFileSync(filePath);
        const localHash = crypto.createHash('md5').update(localContent).digest('hex');
        console.log('Local MD5: ', localHash);
        console.log('Local Length:', localContent.length);

        if (remoteHash === localHash) {
            console.log('SUCCESS: Hashes match.');
        } else {
            console.log('FAILURE: Hashes mismatch!');
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
