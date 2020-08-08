/**@type {(url: RequestInfo, init?: RequestInit)=>Promise<Response>} */
const fetch = require('node-fetch');
const FormData = require('form-data');
const API = 'https://discordapp.com/api/v6/';
const REDIRECT_URI = {
    local: 'http://localhost/return',
    glitch: 'https://pixelspace.glitch.me/return',
    heroku: 'https://pxspace.herokuapp.com/return'
}[process.env.dev];

/**
 * @typedef {{
 *     access_token: string,
 *     expires_in: number,
 *     refresh_token: string,
 *     scope: string,
 *     token_type: string
 * }} DiscordToken
 *
 * @typedef {{
 *      id: string,
 *      username: string,
 *      avatar: string,
 *      discriminator: string,
 *      locale: string,
 *      flags: number
 * }} DiscordUser
 */

/**
 * @param {string} authorization
 * @returns {Promise<DiscordUser>}
 */
async function getUser(authorization) {
    var res = await fetch(API + 'users/@me', { method: 'GET', headers: { authorization } }).then((r) => r.json());
    delete res.mfa_enabled;
    return res;
}
/**
 * @param {string} refreshToken
 * @returns {Promise<DiscordToken>}
 */
function refreshToken(refreshToken) {
    var body = new FormData();
    body.append('grant_type', 'refresh_token');
    body.append('client_id', process.env.discord_id);
    body.append('client_secret', process.env.discord_secret);
    body.append('refresh_token', refreshToken);
    body.append('redirect_uri', REDIRECT_URI);
    body.append('scope', 'identify');
    return fetch(API + 'oauth2/token', { method: 'POST', body }).then((r) => r.json());
}
/**
 * @param {string} code
 * @returns {Promise<DiscordToken>}
 */
function getToken(code) {
    var body = new FormData();
    body.append('grant_type', 'authorization_code');
    body.append('client_id', process.env.discord_id);
    body.append('client_secret', process.env.discord_secret);
    body.append('code', code);
    body.append('redirect_uri', REDIRECT_URI);
    body.append('scope', 'identify');
    return fetch(API + 'oauth2/token', { method: 'POST', body }).then((r) => r.json());
}
/**
 * @param {string} path
 * @param {any} data
 */
function sendWebhook(path, data) {
    return fetch('https://discordapp.com/api/webhooks/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        redirect: 'follow'
    });
}
function hookLog(data) {
    if (process.env.dev == 'local') return;
    data.timestamp = new Date().toISOString();
    data = { embeds: [data] };
    return sendWebhook(process.env.discord_webhook, data);
}

module.exports = { getUser, getToken, refreshToken, sendWebhook, log: hookLog };
