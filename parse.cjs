const fs = require('fs');
const html = fs.readFileSync('Digital SAT Prep ｜ AI-Powered Practice Tests & Score Calculator ｜ DSATUZ (20.07.2026 07：39：57).html', 'utf-8');

const jsdom = require('jsdom'); // We might not have jsdom installed, let's just use regex safely.
const headings = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/g)].map(m => m[1].replace(/<[^>]+>/g, '')).slice(0, 30);
console.log('Headings:', headings);

// Find some text chunks that might contain features
const mainContentMatches = html.match(/Student Question Bank.*?Score Calculator/is);
if (mainContentMatches) {
    console.log('Found main content section...');
}
