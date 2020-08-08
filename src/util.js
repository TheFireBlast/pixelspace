const crypto = require('crypto');

/**
 * @param {number} x
 * @param {number} y
 */
function chunkKey(x, y) {
    return ((y & 0x1f) << 5) + (x & 0x1f);
}
/**
 * @param {number} key
 */
function fromChunkKey(k) {
    let x = k & 0x1f;
    let y = k >> 5;
    //Se o ultimo bit (o da esquerda) for 1 então a coordenada é negativa
    if (x >> 4) x = -(((~x >>> 0) & 0x1f) + 1);
    if (y >> 4) y = -(((~y >>> 0) & 0x1f) + 1);
    return [x, y];
}
/**
 * @param {number} x
 * @param {number} y
 */
function pixelKey(x, y) {
    return (pymod(y, 256) << 8) + pymod(x, 256);
}
/**
 * @param {number} key
 */
function fromPixelKey(key) {
    return [key & 0xff, key >> 8];
}
/**
 * @param {number} n
 * @param {number} M
 */
function pymod(n, M) {
    return ((n % M) + M) % M;
}
/**
 * @param {string|number} snowflake 
 */
function snowflakeToMillis(snowflake) {
    return parseInt(snowflake) / 4194304 + 1420070400000;
}

const colors = ['#000000', '#353131', '#9e9e9e', '#ffffff', '#f51515', '#ea7c12', '#f5da15', '#7b4906', '#101065', '#2525e3', '#0af0e2', '#226813', '#43cb25', '#14a23b', '#611266', '#ce2385'];
/**
 * @returns {string}
 */
function hash(str) {
    return crypto.createHash('sha256').update(str).digest('base64');
}
/**
 * @param {string} string
 * @returns {string}
 */
function normalize(string) {
    return string
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

module.exports = { chunkKey, fromChunkKey, pixelKey, fromPixelKey, pymod, colors, hash, snowflakeToMillis, normalize };
