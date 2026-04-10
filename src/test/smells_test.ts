import * as fs from 'fs';

// 1. Existing Smell: High-frequency setInterval
setInterval(() => {
    console.log("Too fast!");
}, 50);

// 2. New Smell: Recursive high-frequency setTimeout
function tick() {
    console.log("Recursive tick");
    setTimeout(tick, 30);
}
tick();

// 3. New Smell: Synchronous I/O
const data = fs.readFileSync('./package.json', 'utf8');
console.log(data);

// 4. New Smell: DOM queries in a loop
function updateList() {
    for (let i = 0; i < 10; i++) {
        const el = document.getElementById('item-' + i); // DOM query inside loop
        if (el) el.innerText = 'Updated ' + i;
    }
}
