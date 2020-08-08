/**@typedef {{userColor?:string,color?:string,links?:boolean,linebreak?:boolean}} MessageOptions */

class Chat {
    constructor() {
        this._nextId = 0;
        /**@type {{sender:[string,string],text:string,options:MessageOptions,id:number}[]} */
        this.history = [];
        /**@type {Set<import('./Connection')>} */
        this.listeners = new Set();
    }
    /**
     * @param {import('./User')} user
     * @param {string} message
     * @param {MessageOptions} options
     */
    send(user, message, options = {}) {
        if (user.admin) options.userColor = '#ff3000';
        this.add([user.username, user.id], message, options);
        for (var c of this.listeners) c.emit('msg', [user.username, user.id], message, options);
    }
    /**
     * @param {string} sender user id
     * @param {string} text message content
     * @param {MessageOptions} options
     */
    add(sender, text, options) {
        this.history.push({ sender, text, options, id: this._nextId++ });
    }
    /**
     * @param {number} amount
     */
    getMessages(amount) {
        var from = this.history.length;
        return this.history.slice(from - amount, from);
    }
}

module.exports = Chat;
