/**@typedef {import('./User')} User */

const { normalize } = require('./util');
const UserManager = require('./UserManager');
const Chat = require('./Chat');
const Discord = require('./Discord');

/**@typedef {{
    pixels: number;
    memberPixels: { [id:string]: number };
    colors: number[];
}} FactionStats */
/**@typedef {{
    id?: string;
    name: string;
    color: string;
    owner: User | string;
    stats?: FactionStats;
    members?: string[];
    requests?: string[];
}} FactionInit */

class Faction {
    /**
     * @param {FactionInit} init
     */
    constructor(init) {
        this.id = (init.id || Date.now()) + '';
        this.name = init.name;
        this.color = init.color;
        this.flatName = normalize(this.name).replace(/ /g, '');
        this.owner = typeof init.owner === 'string' ? UserManager.get(init.owner) : init.owner;
        this.owner.faction = this;
        // this.chat = new Chat();
        /**@type {Map<string,User>} */
        this.members = new Map();
        if (init.members) {
            for (var m of init.members) {
                var u = UserManager.get(m);
                this.members.set(u.id, u);
                u.faction = this;
            }
        } else this.members.set(this.owner.id, this.owner);
        /**@type {FactionStats} */
        this.stats = Object.assign(
            {
                pixels: 0,
                memberPixels: {},
                colors: new Array(16).fill(0)
            },
            init.stats
        );
        /**@type {Set<string>} */
        this.requests = new Set(init.requests);
        /**@type {User[]} */
        this.topCache = [];
        this.topLastUpdate = 0;
    }
    /**
     * @param {User} member
     */
    join(member) {
        this.members.set(member.id, member);
        member.faction = this;
        this.topLastUpdate = 0;
        console.log(`User ${member.username} (${member.id}) joined faction ${this.name} (${this.id}) OWNER:${this.owner.username}`);
        Discord.log({
            title: 'Usuário entrou em uma facção',
            fields: [
                { name: 'Usuário', value: `${member.username} <@!${member.discord.id}> (${member.id})` },
                { name: 'Facção', value: this.name, inline: true },
                { name: 'Dono', value: `${this.owner.username} <@!${this.owner.discord.id}> (${this.owner.id})`, inline: true },
                { name: 'ID', value: this.id, inline: true }
            ]
        });
    }
    /**
     * @param {User} member
     */
    leave(member) {
        this.members.delete(member.id);
        member.faction = null;
        this.topLastUpdate = 0;
        console.log(`User ${member.username} (${member.id}) left faction ${this.name} (${this.id}) OWNER:${this.owner.username}`);
        Discord.log({
            title: 'Usuário saiu de uma facção',
            fields: [
                { name: 'Usuário', value: `${member.username} <@!${member.discord.id}> (${member.id})` },
                { name: 'Facção', value: this.name, inline: true },
                { name: 'Dono', value: `${this.owner.username} <@!${this.owner.discord.id}> (${this.owner.id})`, inline: true },
                { name: 'ID', value: this.id, inline: true }
            ]
        });
    }
    getTop(page = 0) {
        var now = Date.now();
        if (now - this.topLastUpdate > 10_000) {
            this.topLastUpdate = now;
            this.topCache = [...this.members.values()].sort((a, b) => this.stats.memberPixels[b.id] - this.stats.memberPixels[a.id]);
        }
        var o = page * 15;
        return this.topCache.slice(o, o + 15);
    }

    save() {
        var members = [];
        for (var m of this.members) members.push(m[0]);
        return {
            id: this.id,
            color: this.color,
            name: this.name,
            owner: this.owner.id,
            members: members,
            stats: this.stats,
            requests: [...this.requests]
        };
    }
    toString() {
        return JSON.stringify(this.save());
    }
}

module.exports = Faction;
