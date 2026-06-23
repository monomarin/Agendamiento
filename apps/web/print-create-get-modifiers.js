const fs = require('fs');
const path = require('path');

const file = 'd:/agendamiento/apps/web/node_modules/react-day-picker/dist/esm/helpers/createGetModifiers.js';
const code = fs.readFileSync(file, 'utf8');
console.log(code);
