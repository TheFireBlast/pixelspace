const User = require('./User');
const { snowflakeToMillis, normalize } = require('./util');
const Discord = require('./Discord');

const UserManager = {
    /**@type {Map<string,User>} */
    users: new Map(),
    /**@type {Map<string,User>} */
    userByIP: new Map(),
    /**
     * @param {string} query
     */
    query(query) {
        if (!query) return null;
        if (query[0] == '#') {
            let id = parseInt(query.slice(1));
            // Connection id
            for (var [x, user] of this.users) {
                for (var c of user.connections) {
                    if (c.id == id) {
                        return user;
                    }
                }
            }
            return null;
        }
        // Discord mention
        var mentionIdMatch = query.match(/^<@!?(\d+)>$/);
        if (mentionIdMatch) {
            var mentionId = mentionIdMatch[1];
            for (var [x, user] of this.users) {
                if ((user.discord && user.discord.id) == mentionId) return user;
            }
        }
        // User id/name
        var queryNormalized = normalize(query);
        for (var [x, user] of this.users) {
            try {
                var nameNormalized = normalize(user.username);
            } catch (e) {
                console.log('Failed to normalize username', user);
                console.error(e);
            }
            if (user.id == queryNormalized || nameNormalized.startsWith(queryNormalized)) return user;
        }
        return null;
    },
    /**
     *
     * @param {import('./Discord').DiscordUser} discordData
     * @param {import('./Discord').DiscordToken} discordToken
     * @param {string} ip
     */
    create(discordData, discordToken, ip, autoban = true) {
        var user = new User({
            username: discordData.username,
            lastTokenUpdate: Date.now(),
            discordToken,
            discord: discordData
        });
        // se outra conta ja foi conectada com este ip, é alt
        var ipuser = this.userByIP.get(ip);
        // se a conta for mais nova que 14 dias (1000*60*60*24*14), é alt
        if (autoban && (ipuser || Date.now() - snowflakeToMillis(discordData.id) < 12096e5)) {
            // this.ban(user, '[AUTOBAN] Alt');
        }
        this.users.set(user.id, user);
        this.userByIP.set(ip, user);

        console.log(`Created new user ${user.id} @${discordData.username}#${discordData.discriminator}${user.banned ? ' [ALT BANNED]' : ''}`);
        var date = new Date(snowflakeToMillis(discordData.id));
        var now = new Date();
        var age = '';
        var years = now.getFullYear() - date.getFullYear();
        if (years) age = years + ' ano' + (years > 1 ? 's' : '');
        else {
            var days = (now.getTime() - date.getTime()) / 864e5;
            var weeks = Math.floor(days / 7);
            if (weeks) age = weeks + ' semanas e ';
            age += (Math.floor(days) % 7) + ' dias';
        }
        Discord.log({
            title: 'Novo usuário',
            fields: [
                { name: 'Discord', value: `<@!${discordData.id}> (${discordData.id})`, inline: true },
                { name: 'ID', value: user.id, inline: true },
                { name: 'Idade', value: age, inline: true },
                { name: 'Alt?', value: user.banned ? 'Sim' : 'Não', inline: true }
            ],
            thumbnail: { url: `https://cdn.discordapp.com/avatars/${discordData.id}/${discordData.avatar}.png?size=128` },
            author: {
                name: `${discordData.username}#${discordData.discriminator}`,
                icon_url: `https://cdn.discordapp.com/avatars/${discordData.id}/${discordData.avatar}.png?size=128`
            }
        });

        return user;
    },
    /**
     * @param {string|import('./User')} user
     * @param {string} [reason]
     */
    ban(user, reason) {
        this.setBan(user, true, reason);
    },
    /**
     * @param {string|import('./User')} user
     * @param {string} [reason]
     */
    unban(user, reason) {
        this.setBan(user, false, reason);
    },
    /**
     * @param {string|import('./User')} user
     * @param {boolean} ban
     * @param {string} reason
     */
    setBan(user, ban, reason = 'No reason') {
        var u = typeof user === 'string' ? this.users.get(user) : user;
        if (!u) return false;
        if (ban) u.connections.forEach((c) => c.socket.disconnect(true));
        u.banned = ban;
        console.log(`User ${u.username} (${u.id}) was ${ban ? '' : 'un'}banned REASON:${reason}`);
        Discord.log({
            title: `Usuário ${ban ? '' : 'des'}banido`,
            fields: [
                { name: 'Discord', value: `<@!${u.discord.id}> (${u.discord.id})`, inline: true },
                { name: 'ID', value: u.id, inline: true },
                { name: 'Motivo', value: reason }
            ],
            thumbnail: { url: `https://cdn.discordapp.com/avatars/${u.discord.id}/${u.discord.avatar}.png?size=128` },
            author: {
                name: `${u.discord.username}#${u.discord.discriminator}`,
                icon_url: `https://cdn.discordapp.com/avatars/${u.discord.id}/${u.discord.avatar}.png?size=128`
            }
        });
        return true;
    },
    /**
     * @param {string} id
     * @returns {User}
     */
    get(id) {
        return this.users.get(id);
    },
    /**
     * @param {string} id
     */
    getByDiscordID(id) {
        for (var user of this.users) {
            if (user[1].discord && user[1].discord.id == id) return user[1];
        }
        return null;
    },
    /**
     * @param {string} event
     */
    emitAll(event, ...data) {
        for (var [id, u] of this.users) u.emit(event, ...data);
    }
};

module.exports = UserManager;
