class Connection {
    /**
     * @param {SocketIO.Socket} socket
     * @param {import('./User')} user
     */
    constructor(socket, user) {
        this.socket = socket;
        this.user = user;
        /**@type {string} */
        this.ip = (socket.handshake.headers['x-forwarded-for'] || '').split(',')[0] || socket.request.connection.remoteAddress;
        /**@type {number} */
        this.id = null;
        /**@type {import('./World')} */
        this.world = null;
        this.pos = { x: 0, y: 0, c: 0 };
        /**
         * @type {(event:string, ...args:any[])=>boolean}
         */
        this.emit = socket.emit.bind(socket);
        /**
         * @type {(event:string, listener: (...args: any[]) => void)=>SocketIO.Socket}
         */
        this.on = socket.on.bind(socket);
        if (user) user.add(this);
    }
    get connected() {
        return this.socket.connected;
    }
    /**
     * @param {import('./World')} world
     */
    join(world) {
        this.world = world;
        world.join(this);
        this.id = world.nextId();
        this.socket.emit('id', this.id);
        if (this.user) this.emit('stack', this.user.stack, this.user.stackMax, this.user.lastStackRefresh);
    }
    leave() {
        if (!this.world) return;
        this.world.leave(this);
        this.world = null;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} color
     */
    setPixel(x, y, color) {
        if (!this.user.hidden) this.setPos(x, y, color);
        // if (dist(this.pos.x, this.pos.y, x, y) < 8)
        this.world.setPixel(x, y, color);
        this.user.stats.pixels++;
        this.user.stats.colors[color]++;
        if (this.user.faction) {
            this.user.faction.stats.pixels++;
            this.user.faction.stats.colors[color]++;
            this.user.faction.stats.memberPixels[this.user.id] = (this.user.faction.stats.memberPixels[this.user.id] || 0) + 1;
        }
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} c
     */
    setPos(x, y, c) {
        this.pos.x = x;
        this.pos.y = y;
        this.pos.c = c & 0xf;
        this.world.updatePlayer(this);
    }
}

module.exports = Connection;

function dist(x0, y0, x1, y1) {
    return Math.abs(x1 - x0) + Math.abs(y1 - y0);
}
