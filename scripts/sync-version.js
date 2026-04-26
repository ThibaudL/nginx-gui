#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const frontendPath = path.join(__dirname, '..', 'app-vue', 'package.json');
const frontendPkg = JSON.parse(fs.readFileSync(frontendPath, 'utf8'));

frontendPkg.version = rootPkg.version;
fs.writeFileSync(frontendPath, JSON.stringify(frontendPkg, null, 2) + '\n');

console.log(`app-vue version synced to ${rootPkg.version}`);
