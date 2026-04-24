import fs from 'fs';
const content = fs.readFileSync('f:/app/components/AdminDashboard.tsx', 'utf8');

const start = content.indexOf('{(isAdmin || activeShop) && adminTab === \'config\' && (');
const end = content.indexOf('{adminTab === \'settlement\' && (');
const configBlock = content.substring(start, end);

const divOpenMatches = configBlock.match(/<div/g) || [];
const divCloseMatches = configBlock.match(/<\/div/g) || [];
const selfClosingDivs = configBlock.match(/<div[^>]*\/>/g) || [];

console.log('Config Block Div Open:', divOpenMatches.length);
console.log('Config Block Div Close:', divCloseMatches.length);
console.log('Config Block Self-Closing Divs:', selfClosingDivs.length);
console.log('Missing Closes (excluding self-closing):', (divOpenMatches.length - selfClosingDivs.length) - divCloseMatches.length);
