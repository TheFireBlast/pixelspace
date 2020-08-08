const User = require('./User');
const Faction = require('./Faction');
const Discord = require('./Discord');

const FactionManager = {
    /**@type {Map<string,Faction>} */
    factions: new Map(),
    /**@type {Faction[]} */
    topCache: [],
    topLastUpdate: 0,
    /**
     * @param {import('./Faction').FactionInit} init
     */
    create(init) {
        var fac = new Faction(init);
        this.factions.set(fac.id, fac);
        this.topLastUpdate = 0;
        console.log(`Created new faction ${fac.name} (${fac.id}) OWNER:${fac.owner.username}`);
        Discord.log({
            title: 'Nova facção',
            fields: [
                { name: 'Nome', value: fac.name, inline: true },
                { name: 'Dono', value: `<@!${fac.owner.discord.id}> (${fac.owner.id})`, inline: true },
                { name: 'ID', value: fac.id, inline: true }
            ]
        });
        return fac;
    },
    /**
     * @param {string} id
     */
    get(id) {
        return this.factions.get(id);
    },
    getTop(page = 0) {
        var now = Date.now();
        if (now - this.topLastUpdate > 10_000) {
            this.topLastUpdate = now;
            this.topCache = [...this.factions.values()].sort((a, b) => b.stats.pixels - a.stats.pixels);
        }
        var o = page * 15;
        return this.topCache.slice(o, o + 15);
    }
};

module.exports = FactionManager;
