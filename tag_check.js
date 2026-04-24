import fs from 'fs';
const content = fs.readFileSync('f:/app/components/AdminDashboard.tsx', 'utf8');

let braceCount = 0;
let parenCount = 0;

for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') braceCount++;
  if (content[i] === '}') braceCount--;
  if (content[i] === '(') parenCount++;
  if (content[i] === ')') parenCount--;
}

const divOpenMatches = content.match(/<div/g) || [];
const divCloseMatches = content.match(/<\/div/g) || [];

console.log('Brace Balance:', braceCount);
console.log('Paren Balance:', parenCount);
console.log('Div Open:', divOpenMatches.length);
console.log('Div Close:', divCloseMatches.length);
