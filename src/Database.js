/// <reference path="types/gspreadsheet.d.ts" />

const { GoogleSpreadsheet } = require('google-spreadsheet');
const World = require('./World');
const User = require('./User');
const Faction = require('./Faction');
const FactionManager = require('./FactionManager');
const UserManager = require('./UserManager');
const { pixelKey, chunkKey, fromChunkKey } = require('./util');

var sheetIds = { world: '0', users: '1372086893', factions: '1283481443', stack: '1599285628', ipbans: '1198003923' };

class Database {
    constructor() {
        this.db = new GoogleSpreadsheet(process.env.sheet_key);
        this.users = UserManager.users;
        this.factions = FactionManager.factions;
        this.bannedIps = new Set();
        /**@type {World} */
        this.world;
        /**@type {import('google-spreadsheet').GoogleSpreadsheetWorksheet} */
        this.usersSheet;
        /**@type {import('google-spreadsheet').GoogleSpreadsheetWorksheet} */
        this.factionsSheet;
        /**@type {import('google-spreadsheet').GoogleSpreadsheetWorksheet} */
        this.worldSheet;
        this.ready = false;
    }
    async load() {
        console.log('Loading database');
        await this.db.useServiceAccountAuth({
            client_email: process.env.sheet_client_email,
            private_key: process.env.sheet_private_key.replace(/\\n/g, '\n')
        });
        await this.db.loadInfo();

        // Users
        this.usersSheet = this.db.sheetsById[sheetIds.users];
        await this.usersSheet.loadCells('A1:Z1');
        var data = '';
        for (var i = 0; i < 26; i++) {
            var cell = this.usersSheet.getCellByA1(getCellByIndex(i)).value;
            if (!cell) break;
            data += cell;
        }
        var arr = JSON.parse(data);
        for (var u of arr) this.users.set(u.id, new User(u));
        console.log(`Loaded ${arr.length} users`);

        // Factions
        this.factionsSheet = this.db.sheetsById[sheetIds.factions];
        await this.factionsSheet.loadCells('A1:Z1');
        var data = '';
        for (var i = 0; i < 26; i++) {
            var cell = this.factionsSheet.getCellByA1(getCellByIndex(i)).value;
            if (!cell) break;
            data += cell;
        }
        var arr = JSON.parse(data);
        for (var f of arr) {
            this.factions.set(f.id, new Faction(f));
        }
        console.log(`Loaded ${this.factions.size} factions`);

        // World
        this.worldSheet = this.db.sheetsById[0];
        await this.worldSheet.loadCells('A1:Z40');
        this.world = new World(this.worldSheet.getCell(0, 0).value, this.worldSheet.getCell(0, 1).value);

        var chunk;
        for (var cy = -10; cy < 10; cy++) {
            for (var cx = -10; cx < 10; cx++) {
                chunk = this.worldSheet.getCellByA1(getChunkCell(cx, cy)).value;
                if (!chunk) continue; //pular chunks vazios
                this.world.chunks.set(chunkKey(cx, cy), uncompressChunk(chunk));
            }
        }
        console.log('Loaded chunks');

        this.ready = true;
    }
    async save() {
        if (!this.ready) return;

        var userList = [];
        for (var user of this.users) userList.push(user[1].save());
        var arr = JSON.stringify(userList).match(/.{1,30000}/g);
        arr.push(null);
        for (var i = 0; i < arr.length; i++) {
            this.usersSheet.getCellByA1(getCellByIndex(i)).value = arr[i];
        }
        await this.usersSheet.saveUpdatedCells();
        console.log(`Saved ${userList.length} users into ${arr.length} cells`);

        var facList = [];
        for (var fac of this.factions) facList.push(fac[1].save());
        var arr = JSON.stringify(facList).match(/.{1,30000}/g);
        arr.push(null);
        for (var i = 0; i < arr.length; i++) {
            this.factionsSheet.getCellByA1(getCellByIndex(i)).value = arr[i];
        }
        await this.factionsSheet.saveUpdatedCells();
        console.log(`Saved ${this.factions.size} factions into ${arr.length} cells`);

        var n = 0;
        if (this.world.dirtyChunks.size) {
            for (var chunk of this.world.dirtyChunks) {
                n++;
                var [cx, cy] = fromChunkKey(chunk);
                this.worldSheet.getCellByA1(getChunkCell(cx, cy)).value = this.world.chunkToString(cx, cy);
            }
            await this.worldSheet.saveUpdatedCells();
            this.world.dirtyChunks.clear();
            if (n) console.log(`Saved ${n} chunks`);
        }
    }
}

/**
 * @param {string} compressed
 * @returns {Map<number,number>}
 */
function uncompressChunk(compressed) {
    // console.log(compressed);
    /**@type {Map<number,number>} */
    var chunk = new Map();
    if (!compressed) return chunk;
    var buffer = Buffer.from(compressed, 'base64');
    var x = 0,
        y = 0;
    for (var i = 0; i < buffer.length; i++) {
        var p1 = buffer[i] & 0b1111;
        var p2 = buffer[i] >> 4;
        if (p1 !== 3) chunk.set(pixelKey(x, y), p1);
        x++;
        if (p2 !== 3) chunk.set(pixelKey(x, y), p2);
        x++;
        if (x == 256) y++;
        x %= 256;
    }
    // console.log(chunk);
    return chunk;
}
/**
 * @param {number} column 1-indexed
 * @returns {string}
 */
function columnToLetter(column) {
    let temp;
    let letter = '';
    let col = column;
    while (col > 0) {
        temp = (col - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        col = (col - temp - 1) / 26;
    }
    return letter;
}
/**
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
function getChunkCell(x, y) {
    x += 16;
    y += 16;
    var index = x + y * 32 + 2; //as duas primeiras celulas sao o nome e o cooldown do mundo
    return columnToLetter((index % 26) + 1) + (Math.floor(index / 26) + 1);
}
function getCellByIndex(index) {
    return columnToLetter((index % 26) + 1) + (Math.floor(index / 26) + 1);
}

module.exports = Database;
