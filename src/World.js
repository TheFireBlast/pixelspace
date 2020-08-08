const Connection = require('./Connection');
const { chunkKey, pixelKey } = require('./util');

class World {
    /**
     * @param {string} name
     * @param {number} cooldown
     */
    constructor(name, cooldown) {
        this.name = name;
        /**@type {Set<Connection>} */
        this.players = new Set();
        /**@type {Set<Connection>} */
        this.playerUp = new Set();
        /**@type {Set<number>} Chunks to update */
        this.dirtyChunks = new Set();
        /**@type {Map<number,number>} */
        this.pixels = new Map();
        /**@type {Map<number,Map<number,number>>} */
        this.chunks = new Map();
        this.cd = cooldown || 5000;

        this._nextId = 0;
    }
    nextId() {
        var i = 0;
        main: while (i < 0xffff) {
            this._nextId++;
            if (this._nextId > 0xffff) this._nextId = 0;
            for (var c of this.players) if (c.id == this._nextId) continue main;
            return this._nextId;
        }
    }

    get online() {
        var users = new Set();
        for (var p of this.players) users.add(p.user);
        return users.size;
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    chunkToString(x, y) {
        var ch = this.chunks.get(chunkKey(x, y));
        if (!ch || ch.size == 0) return;
        var compressed = [];
        var last = 0;
        for (var i = 0; i < 65536; i += 2) {
            var px1 = ch.get(i);
            var px2 = ch.get(i | 1);
            if (px1 !== undefined) last = i;
            else px1 = 3;
            if (px2 !== undefined) last = i;
            else px2 = 3;
            compressed.push(px1 | (px2 << 4));
        }
        return Buffer.from(compressed.slice(0, last / 2 + 1)).toString('base64');
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {boolean} generate add new chunk if it doesn't exist
     * @returns {Map<number,number>}
     */
    getChunk(x, y, generate = false) {
        let key = chunkKey(x, y);
        let chunk = this.chunks.get(key);
        if (!chunk) {
            if (!generate) return null;
            let c = new Map();
            this.chunks.set(key, c);
            return c;
        }
        return chunk;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} color
     */
    setPixel(x, y, color) {
        color = color & 0xf;
        this.pixels.set((((y & 0xffff) << 16) | (x & 0xffff)) >>> 0, color);
        this.getChunk(x >> 8, y >> 8, true).set(pixelKey(x & 0xffff, y & 0xffff), color);
        this.dirtyChunks.add(chunkKey(x >> 8, y >> 8));
    }
    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} ex
     * @param {number} ey
     * @param {number} color
     */
    fillArea(sx, sy, ex, ey, color) {
        color = color & 0xf;
        for (var y = sy; y <= ey; y++) {
            for (var x = sx; x <= ex; x++) {
                this.pixels.set((((y & 0xffff) << 16) | (x & 0xffff)) >>> 0, color);
                this.getChunk(x >> 8, y >> 8, true).set(pixelKey(x & 0xffff, y & 0xffff), color);
                this.dirtyChunks.add(chunkKey(x >> 8, y >> 8));
            }
        }
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    getPixel(x, y) {
        this.getChunk(x >> 8, y >> 8).get(pixelKey(x & 0xffff, y & 0xffff));
    }

    /**
     * @param {Connection} conn
     */
    join(conn) {
        this.players.add(conn);
        this.updatePlayer(conn);
        this.players.forEach((c) => c.emit('on', this.online));
        let packet = Buffer.alloc(this.players.size * 6);
        let i = 0;
        this.players.forEach((player) => {
            let pos = player.pos;
            packet.writeUInt16LE(player.id, i);
            packet.writeUInt32LE((((pos.y & 0xffff) << 16) | (pos.x & 0xffff)) >>> 0, i + 1);
            packet.writeUInt8(((pos.c << 1) & 0xff) | +player.connected, i + 5);
            i += 6;
        });
        conn.emit('ps', packet.toString('base64'));
    }
    /**
     * @param {Connection} conn
     */
    leave(conn) {
        this.players.delete(conn);
        this.updatePlayer(conn);
        this.players.forEach((c) => c.emit('on', this.online));
    }
    /**
     * @param {Connection} conn
     */
    updatePlayer(conn) {
        this.playerUp.add(conn);
    }

    update() {
        if (this.pixels.size) {
            let packet = Buffer.alloc(this.pixels.size * 5);
            let i = 0;
            this.pixels.forEach((clr, px) => {
                packet.writeUInt32LE(px, i);
                packet.writeUInt8(clr, i + 4);
                i += 5;
            });
            this.pixels.clear();
            this.emitAll('px', packet.toString('base64'));
        }
        if (this.playerUp.size) {
            let packet = Buffer.alloc(this.playerUp.size * 7);
            let i = 0;
            this.playerUp.forEach((player) => {
                let pos = player.pos;
                packet.writeUInt16LE(player.id, i);
                var visible = player.connected && (player.user ? !player.user.hidden : true);
                if (visible) packet.writeUInt32LE((((pos.y & 0xffff) << 16) | (pos.x & 0xffff)) >>> 0, i + 2);
                else packet.writeUInt32LE(0, i + 2);
                packet.writeUInt8((pos.c << 1) | +visible, i + 6);
                i += 7;
            });
            this.playerUp.clear();
            this.emitAll('ps', packet.toString('base64'));
        }
    }
    /**
     * @param {string} event
     * @param {any[]} args
     */
    emitAll(event, ...args) {
        this.players.forEach((c) => c.emit(event, ...args));
    }
}

module.exports = World;
