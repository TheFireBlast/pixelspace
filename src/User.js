/**@typedef {import('./Connection')} Connection */

const { hash, normalize } = require('./util');

/**@typedef {{
    pixels: number;
    colors: number[];
}} UserStats */
/**@typedef {{
    username: string;
    id?: string;
    admin?: boolean;
    banned?: boolean;
    lastTokenUpdate: number;
    discordToken: import('./Discord').DiscordToken;
    discord: import('./Discord').DiscordUser;
    stats?: UserStats;
}} UserInit */

class User {
    /**@param {UserInit} init */
    constructor(init) {
        this.id = (init.id || Date.now()) + '';
        this.username = init.username || (init.discord && init.discord.username) || 'INVALIDNAME';
        this.flatUsername = normalize(this.username).replace(/ /g, '');
        /**@type {import('./Faction')} */
        this.faction = null;
        /**@type {string} */
        this.ip = null;
        /**@type {Set<Connection>} */
        this.connections = new Set();
        /**@type {number} */
        this.stack = 1; //stack de pixels
        this.stackMax = 10; //stack de pixels
        this.lastStackRefresh = Date.now();

        this.hidden = false;

        /**@type {boolean} */
        this.banned = init.banned || false;
        /**@type {boolean} */
        this.banReason = init.banReason;
        /**@type {boolean} */
        this.admin = init.admin || false;
        this.lastTokenUpdate = init.lastTokenUpdate;
        this.discordToken = init.discordToken;
        this.discord = init.discord;

        /**@type {{pixels:number,colors:number[]}} */
        this.stats = Object.assign(
            {
                pixels: 0,
                colors: new Array(16).fill(0)
                //TODO: onlineTime: 0
            },
            init.stats
        );
        this.secret = init.secret || hash((Math.random() * 10000).toString());
    }
    get online() {
        return this.connections.size > 0;
    }
    updateStack() {
        var now = Date.now();
        var add = (now - this.lastStackRefresh) / 500;
        this.stack = Math.min(this.stackMax, add + this.stack);
        this.lastStackRefresh = now;
    }
    emit() {
        this.connections.forEach((c) => c.emit.apply(c, arguments));
    }
    add(/**@type {Connection} */ conn) {
        this.connections.add(conn);
    }
    remove(/**@type {Connection} */ conn) {
        if (conn.world) conn.world.leave(conn);
        this.connections.delete(conn);
    }
    save() {
        return {
            id: this.id,
            username: this.username,
            secret: this.secret,
            lastTokenUpdate: this.lastTokenUpdate,
            discordToken: this.discordToken,
            discord: this.discord,
            stats: this.stats,
            admin: this.admin,
            banned: this.banned,
            banReason: this.banReason
        };
    }
    toString() {
        return JSON.stringify(this.save());
    }
}

module.exports = User;
