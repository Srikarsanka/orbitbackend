const fs = require('fs');
const path = require('path');

const targetStr = 'https://orbit-zqsz.vercel.app/';
const replacementStr = 'https://orbit-pgd9.vercel.app/';

const targetStr2 = 'https://orbit-zqsz.vercel.app';
const replacementStr2 = 'https://orbit-pgd9.vercel.app';

function scanAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'replace_vercel_urls.js') continue;
        
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            scanAndReplace(filePath);
        } else if (stat.isFile()) {
            if (filePath.endsWith('.js') || filePath.endsWith('.json')) {
                const content = fs.readFileSync(filePath, 'utf8');
                let newContent = content;
                if (newContent.includes(targetStr)) {
                    newContent = newContent.split(targetStr).join(replacementStr);
                }
                if (newContent.includes(targetStr2)) {
                    newContent = newContent.split(targetStr2).join(replacementStr2);
                }
                if (content !== newContent) {
                    fs.writeFileSync(filePath, newContent, 'utf8');
                    console.log('Updated: ' + filePath);
                }
            }
        }
    }
}

scanAndReplace('c:\\ORBIT\\backend');
