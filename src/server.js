require('dotenv').config();
const VERSION = require('../package.json').version;
console.log('Starting PixelSpace v' + VERSION);

const http = require('http');
const express = require('express');
const path = require('path');
const marked = require('marked');
const { inspect } = require('util');
const Discord = require('./Discord');
const Connection = require('./Connection');
const Database = require('./Database');
const FactionManager = require('./FactionManager');
const UserManager = require('./UserManager');
const User = require('./User');
const Chat = require('./Chat');
const { fromChunkKey, hash, normalize } = require('./util');

const web = express();
const server = http.createServer(web).listen(process.env.PORT || 3002, '0.0.0.0', () => console.log('Web server active'));
const io = require('socket.io')(server);
const DB = new Database();
const lang = require('./lang.json');

var changelogPage =
    '<span class="markdown-body">' +
    marked(require('fs').readFileSync(path.join(__dirname, '../changelog.md'), 'utf8')) +
    '</span><link href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/4.0.0/github-markdown.min.css" rel="stylesheet" />';
var publicRoot = { root: path.join(__dirname, 'public') };
var loginFailPath = path.join(__dirname, 'login_fail.html');
const bodyParser = require('body-parser');
const urlParser = bodyParser.urlencoded({ extended: true });

Discord.log({ title: 'Servidor iniciado v' + VERSION });
const errorCatch = (err) => {
    console.log('Uncaught Exception:', err);
    Discord.log({ title: 'ERRO: ' + (err.name || ''), description: (err.message || err) + '' });
};
process.on('uncaughtException', errorCatch);
process.on('uncaughtRejection', errorCatch);

DB.load().then(() => {
    world = DB.world;
    dbwait.forEach((c) => {
        c.emit('rd');
        c.join(world);
        console.log(`#${c.id} has joined the world (${c.socket.id})`);
    });
    setInterval(() => world.update(), 80);
    if (process.env.dev != 'local') setInterval(() => DB.save(), 5 * 60 * 1000);
});

/**@type {import('./World')} */
var world;
var globalChat = new Chat();
/**@type {Map<string,User>} */
var userByIP = new Map();

//TODO: https://www.npmjs.com/package/express-rate-limit

//#region web
web.use('/', express.static(publicRoot.root));

web.post('/api/eval', urlParser, (req, res) => {
    // console.log(req.body, req.params, req.query, req.headers, req.headers.authorization);
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    res.send(inspect(eval(req.body.code)));
});
web.get('/api/save', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    DB.save().then(() => res.send('OK'));
});
web.get('/api/factions', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    var facList = {};
    for (var f of FactionManager.factions) facList[f[0]] = f[1].save();
    res.send(facList);
});
web.get('/api/users', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    var userList = {};
    for (var u of DB.users) userList[u[0]] = Object.assign(u[1].save(), { faction: u[1].faction && u[1].faction.id });
    res.send(userList);
});
web.get('/api/user(/:id)?', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    if (!req.params.id) return res.status(400).send('400 Bad Request');
    var u = DB.users.get(req.params.id);
    if (!u) return res.status(400).send({ error: 'Unknown user' });
    res.send(u.save());
});
web.get('/api/user/:id/connections', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    var u = DB.users.get(req.params.id);
    if (!u) return res.status(400).send({ error: 'Unknown user' });
    var conn = [];
    for (var c of u.connections) conn.push(c.id);
    res.send(conn);
});
web.post(['/api/user/:id/ban', '/api/user/:id/unban'], (req, res) => {
    var ban = path.parse(req.url).name == 'ban';
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    if (!req.params.id) return res.status(400).send('400 Bad Request');
    var u = DB.users.get(req.params.id);
    if (!u) return res.status(400).send({ error: 'Unknown user' });
    if (ban) UserManager.ban(req.params.id);
    else UserManager.unban(req.params.id);
    res.send({ success: true });
});
web.get('/api/connection(/:id)?', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    if (!req.params.id) return res.status(400).send('400 Bad Request');
    for (var u of DB.users) {
        for (var c of u[1].connections) {
            if (c.id == req.params.id) {
                return res.send(c.user.save());
            }
        }
    }
    res.status(400).send({ error: 'Unknown connection' });
});
web.get('/api/online', (req, res) => {
    // console.log(req.body, req.params, req.query, req.headers,req.headers.authorization);
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    var list = {};
    for (var u of DB.users) {
        if (u[1].connections.size == 0) continue;
        var conn = [];
        for (var c of u[1].connections) conn.push(c.id);
        list[u[1].id] = conn;
    }
    res.send(list);
});
web.get('/api/disconnect(/:id)?', (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    if (!req.params.id) return res.status(400).send('400 Bad Request');
    if (req.params.id[0] == '#') {
        var cid = +req.params.id.slice(1);
        for (var u of DB.users) {
            for (var c of u[1].connections) {
                if (c.id == cid) {
                    c.socket.disconnect();
                    return res.send({ success: true });
                }
            }
        }
        res.status(400).send({ error: 'Unknown connection' });
    } else {
        var u = DB.users.get(req.params.id);
        if (!u) return res.status(400).send({ error: 'Unknown user' });
        for (var c of u.connections) c.socket.disconnect();
        return res.send({ success: true });
    }
});
web.get('/api/status', (req, res) => {
    res.send({
        online: [...DB.users].reduce((a, b) => (b[1].connections.size ? 1 : 0) + a, 0),
        uptime: process.uptime(),
        version: VERSION
    });
});
web.post('/api/message', urlParser, (req, res) => {
    if (req.headers.authorization != process.env.admin) return res.status(403).send('403 Forbidden');
    globalChat.send({ username: req.body.name, id: req.body.id }, req.body.message, JSON.parse(req.body.options));
    res.send({ success: true });
});

web.get('/online', (req, res) => {
    res.send({
        online: [...DB.users].reduce((a, b) => (b[1].connections.size ? 1 : 0) + a, 0)
    });
});
web.get('/changelog', (req, res) => {
    res.send(changelogPage);
});
web.get('/locale', (req, res) => {
    var preffered = req.acceptsLanguages('pt', 'en');
    if (preffered == 'pt') res.send(lang.pt);
    else res.send(lang.en);
});
web.get('/return', async (req, res) => {
    let code = req.query.code;
    if (!code) {
        console.log('Login failed (get code)', code);
        return res.sendFile(loginFailPath);
    }
    var token = await Discord.getToken(code);
    if (!token || token.error) {
        console.log('Login failed (get token)', code, token);
        return res.sendFile(loginFailPath);
    }
    var data = await Discord.getUser(`${token.token_type} ${token.access_token}`);
    if (!data || data.error || !data.username) {
        console.log('Login failed (get user)', code, token, data);
        return res.sendFile(loginFailPath);
    }
    var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0];
    var user = UserManager.getByDiscordID(data.id);
    if (!user) user = UserManager.create(data, token, ip);
    else {
        user.lastTokenUpdate = Date.now();
        user.discordToken = token;
        user.discord = data;
    }
    console.log(`User ${user.id} logged in as @${user.discord.username}#${user.discord.discriminator}`);
    res.redirect('/?login=' + user.id + ',' + user.secret);
});
web.get('/', (req, res) => {
    res.sendFile('index.html', publicRoot);
});
//#endregion web
/**@type {Set<Connection>} */
var connections = new Set();
/**@type {Connection[]} */
var dbwait = [];
io.on('connection', async function (socket) {
    var disconnectReason = null;
    var ip = (socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress).split(',')[0];
    var connectionsOpen = 1;
    for (var c of connections) {
        if (c.ip == ip) {
            if (++connectionsOpen > 10) {
                socket.emit('an', 'Too many connections');
                return socket.disconnect(true);
            }
        }
    }
    var connectionTimeout = setTimeout(() => {
        socket.emit('an', 'Log in to play');
        disconnectReason = 'Timeout';
        socket.disconnect(true);
    }, 60_000);
    /**@type {User} */
    var user;
    var conn = new Connection(socket, null);
    connections.add(conn);
    var fill = null;
    console.log(`Socket ${socket.id} connected`);

    globalChat.listeners.add(conn);
    socket.emit(
        'mh',
        globalChat.getMessages(30).map((m) => [m.sender[0], m.sender[1], m.text, m.options])
    );
    socket.emit('msg', null, ':v', {});
    socket.emit('vs', VERSION);
    if (DB.ready) {
        socket.emit('rd');
        conn.join(world);
        console.log(`${user ? user.id : ''}#${conn.id} has joined the world (${socket.id})`);
    } else dbwait.push(conn);

    socket.on('lg', (id, secret) => {
        if (!DB.ready) return;
        var _user = UserManager.get(id);
        if (_user && _user.secret == secret) {
            // for (var c of connections) {
            //     if (c.ip == ip && c.user && c.user != _user) {
            //         disconnectReason = `${c.user.username} (${c.user.id}) tried to log in as ${_user.username} (${_user.id})`;
            //         UserManager.ban(_user, "Alt (logged in with another account)")
            //         return socket.disconnect(true);
            //     }
            // }
            if (_user.banned) {
                socket.emit('msg', null, `[ You have been banned ]\nReason: ${_user.banReason || 'No reason specified'}\nYou may appeal your ban by joining the discord server`, {
                    color: '#ff0000',
                    linebreak: true
                });
                return socket.disconnect(true);
            }
            console.log(`${user ? user.id : ''}#${conn.id} logged in as ${_user.id} (@${_user.discord.username}#${_user.discord.discriminator})`);
            _user.ip = ip;
            userByIP.set(ip, _user);
            conn.user = _user;
            _user.connections.add(conn);
            user = _user;
            socket.emit('lg', { username: user.username, discord: user.discord });
            user.updateStack();
            user.emit('stack', user.stack, user.stackMax, user.lastStackRefresh);
            clearTimeout(connectionTimeout);
        } else {
            console.log(`#${conn.id} failed to login`);
            socket.emit('lg', { error: 'Unknown user' });
        }
    });
    socket.on('disconnect', (reason) => {
        if (user && user.banned) disconnectReason = `Banned (@${_user.discord.username}#${_user.discord.discriminator})`;
        console.log(`${user ? user.id : ''}#${conn.id} has been disconnected REASON:${disconnectReason || reason}`);
        if (user) user.remove(conn);
        conn.leave();
        connections.delete(conn);
        globalChat.listeners.delete(conn);
    });
    socket.on('px', (d) => {
        // Pixel
        if (!user || user.banned || !conn.world) return;
        if (fill) {
            if (fill.length > 0) {
                socket.emit('msg', null, `[FILL] Ponto 2: ${d.x},${d.y}`);
                var sx = Math.min(fill[0], d.x);
                var sy = Math.min(fill[1], d.y);
                var ex = Math.max(fill[0], d.x);
                var ey = Math.max(fill[1], d.y);
                //TODO: fazer o fill de pouco em pouco para evitar lag
                conn.world.fillArea(sx, sy, ex, ey, d.c);
                socket.emit('msg', null, '[FILL] Area preenchida');
                Discord.log({
                    title: 'Área preenchida',
                    fields: [
                        { name: 'Área', value: `De ${sx},${sy} até ${ex},${ey}`, inline: true },
                        { name: 'Admin', value: `<@${user.discord.id}> (${user.id})`, inline: true }
                    ]
                });
                fill = null;
            } else {
                fill.push(d.x, d.y);
                socket.emit('msg', null, `[FILL] Ponto 1: ${d.x},${d.y}`);
            }
            return;
        }
        user.updateStack();
        if (user.stack < 1 || d.x < -2560 || d.x >= 2560 || d.y < -2560 || d.y >= 2560) return;
        user.stack--;
        // user.emit('stack', user.stack, user.stackMax, user.lastStackRefresh);
        conn.setPixel(d.x, d.y, d.c);
    });
    socket.on('ps', (pos) => {
        // Position
        if (!user || user.banned || user.hidden) return;
        if (typeof pos !== 'object' || !Number.isSafeInteger(pos.x) || !Number.isSafeInteger(pos.y) || !Number.isSafeInteger(pos.c)) return;
        conn.setPos(pos.x, pos.y, pos.c);
    });
    socket.on('ch', (ch) => {
        // Chunk
        if (!conn.world || !Number.isSafeInteger(ch)) return; //Cancelar caso não esteja em um mundo ou chunk não seja um número
        let [x, y] = fromChunkKey(ch);
        if (x > 9 || x < -10 || y > 9 || y < -10) return; //Nao enviar chunks fora da area de jogo
        socket.emit('ch', ch, world.chunkToString(x, y));
    });
    var lastMessage = 0;
    //TODO: CHAT ROOMS
    socket.on('msg', (msg) => {
        // Message
        if (typeof msg !== 'string' || !user || user.banned) return;
        var now = Date.now();
        if (user.admin || now - lastMessage > 500) lastMessage = now;
        else return;
        msg = msg.trim().slice(0, 200);
        if (msg[0] == '/') {
            let args = msg.slice(1).split(/\s+/g);
            let cmd = args.shift();
            if (cmd == 'fill' && user.admin) {
                socket.emit('msg', null, '[FILL] Esperando por pontos');
                fill = [];
            } else if (cmd == 'hide' && user.admin) {
                socket.emit('msg', null, '[Você está invisível]');
                user.hidden = true;
            } else if (cmd == 'show' && user.admin) {
                socket.emit('msg', null, '[Você está visível]');
                user.hidden = false;
            }
            return;
        }
        if (!msg || !msg.length) return;
        msg = msg.replace(/@([A-Za-z0-9_!]+)/g, (x, name) => {
            name = normalize(name).replace(/ /g, '');
            var target = null;
            for (var [id, u] of DB.users) {
                if (u.flatUsername.startsWith(name)) {
                    target = u;
                    break;
                }
            }
            return (target && `<@${target.username}#${target.id}>`) || '@' + name;
        });
        globalChat.send(user, msg);
    });
    socket.on('ft', (page) => {
        // Faction Top
        if (!Number.isSafeInteger(page) || !user || user.banned) return;
        var top = FactionManager.getTop(page);
        socket.emit(
            'ft',
            top.map((f) => [f.name, f.id, f.members.size, f.stats.pixels]),
            page
        );
    });
    socket.on('fc', (name) => {
        // Faction Create
        if (typeof name !== 'string' || !user || user.banned) return;
        if (!name.match(/^[A-Za-z0-9_ ]+$/)) return socket.emit('fc', { error: 'faction.create.error.alredyin' });
        if (user.faction) return socket.emit('fc', { error: 'faction.create.error.invalidname' });
        if (!user.admin && user.stats.pixels < 100_000) return socket.emit('fc', { error: 'faction.create.error.pixels' });
        var fac = FactionManager.create({ name, color: '#ffffff', owner: user });
        socket.emit('fc', { id: fac.id });
    });
    socket.on('fr', (fid) => {
        // Faction Request
        if (typeof fid !== 'string' || !user || user.banned) return;
        var target = FactionManager.get(fid);
        if (target) {
            target.requests.add(user.id);
            target.owner.emit('fr');
        }
    });
    socket.on('fra', (uid) => {
        // Faction Request Accept
        if (typeof uid !== 'string' || !user || user.banned || !user.faction) return;
        if (user.faction.owner !== user) return;
        if (user.faction.requests.has(uid)) {
            user.faction.requests.delete(uid);
            var u = UserManager.get(uid);
            if (!u.faction) user.faction.join(u);
        }
    });
    socket.on('fa', (fid) => {
        // Faction
        if (typeof fid !== 'string' || !user || user.banned) return;
        var target = FactionManager.get(fid);
        if (target) {
            var data = {
                name: target.name,
                id: target.id,
                stats: {
                    pixels: target.stats.pixels,
                    colors: target.stats.colors
                },
                owner: [target.owner.username, target.owner.id]
            };
            if (target.owner == user) data.requests = [...target.requests].map((id) => [UserManager.get(id).username, id]);
            socket.emit('fa', data);
        }
    });
    socket.on('fm', (fid, page) => {
        // Faction Members
        if (typeof fid !== 'string' || !Number.isSafeInteger(page) || !user || user.banned) return;
        var target = FactionManager.get(fid);
        if (target) {
            var top = target.getTop(page);
            socket.emit(
                'fm',
                top.map((u) => [u.username, u.id, target.stats.memberPixels[u.id] || 0]),
                page
            );
        }
    });
    socket.on('pf', (uid) => {
        // Profile
        if (!user || user.banned || typeof uid != 'string') return;
        var target = DB.users.get(uid);
        if (target) {
            socket.emit('pf', {
                username: target.username,
                id: target.id,
                online: !target.admin && target.online,
                stats: target.stats,
                admin: target.admin,
                faction: target.faction && [target.faction.name, target.faction.id],
                discord: {
                    id: target.discord.id,
                    username: target.discord.username,
                    discriminator: target.discord.discriminator,
                    avatar: target.discord.avatar
                }
            });
        }
    });
});

if (process.env.dev == 'local') {
    const stdin = process.openStdin();
    stdin.on('data', async (d) => {
        const msg = d.toString().trim();
        try {
            var ret = eval(msg);
            console.log(ret);
        } catch (err) {
            console.error(err);
        }
    });
}
