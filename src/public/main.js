/// <reference path="../types/browser-socket.io.d.ts" />

//#region variables
var selectedColor = 0,
    pselectedColor = 0,
    colors = ['#000000', '#353131', '#9e9e9e', '#ffffff', '#f51515', '#ea7c12', '#f5da15', '#7b4906', '#101065', '#2525e3', '#0af0e2', '#226813', '#43cb25', '#14a23b', '#611266', '#ce2385'],
    zoom = 2,
    dragging = false,
    hoveringOverlay = false,
    socket = io();
/**@type {{[id:number]:{x:number,y:number,c:number,sx:number,sy:number}}} */
var cursors = {};
/**@type {Set<number>} */
var requestedChunks = new Set();
/**@type {Set<number>} */
var loadedChunks = new Set();
var loggedIn = false,
    settings = {
        showGrid: true,
        showCursors: true,
        showChat: true,
        pixelIndicator: false
    },
    lastPos = [0, 0],
    emitPos,
    chunkInterval,
    user = {},
    userLogin,
    cursorId,
    stackRefresh = 0,
    stack = 0,
    lang = {},
    stackMax = 10,
    lupa = false,
    redrawCanvas = false,
    stackInterval = null,
    serVer = null;
window.settings = settings;
window.colors = colors;
var pixelsPlaced = new Set();
var loadLangRetries = 0;
(function loadLang() {
    if (loadLangRetries++ > 5) return console.error('Failed to load language');
    $.getJSON('/locale', (l) => {
        lang = l;
        $('#login').text(lang['loginDiscord']);
        $('#profile .stats .pixels span:eq(0)').text(lang['stats.pixelsPlaced']);
        $('#profile .stats .faction span:eq(0)').text(lang['stats.faction']);
        $('#profile>.titlebar>span:eq(0)').text(lang['profile']);
        $('#settings>.titlebar>span:eq(0)').text(lang['settings']);
        $('#factions>.titlebar>span:eq(0)').text(lang['factions']);
        $('#chat > input').attr('placeholder', lang['chat.send']);
        $('#faction .facinfo > h3:eq(0)').text(lang['stats']);
        $('#faction .facinfo > h3:eq(1)').text(lang['members']);
        $('#faction .openreq').text(lang['faction.requests']);
        $('#factions .faccreate > span').text(lang['faction.create']);
        $('#factions .faccreate > .submit').attr('value', lang['faction.createbtn']);
    }).catch(loadLang);
})();
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    $('#zoom').css('display', '');
}
delete io;
//#endregion variables

//#region colors
/**@type {number[][]} */
const palette = [
    [0, 0, 0, 255],
    [53, 49, 49, 255],
    [158, 158, 158, 255],
    [255, 255, 255, 255],
    [245, 21, 21, 255],
    [234, 124, 18, 255],
    [245, 218, 21, 255],
    [123, 73, 6, 255],
    [16, 16, 101, 255],
    [37, 37, 227, 255],
    [10, 240, 226, 255],
    [34, 104, 19, 255],
    [67, 203, 37, 255],
    [20, 162, 59, 255],
    [97, 18, 102, 255],
    [206, 35, 133, 255]
];
var $colorPerc = $('.stats .colorperc');
var $colorStats = $('.stats .colors');
for (let i = 0; i < colors.length; i++) {
    let div = $('<div>').css('background', colors[i]);
    if (i == 0) div.addClass('selected');
    div.click((ev) => {
        selectedColor = i;
        localStorage.setItem('selectedColor', selectedColor);
        $('.selected').removeClass('selected');
        div.addClass('selected');
    }).appendTo('#picker');
    let span = $('<span>')
        .css('border', '1px solid ' + colors[i])
        .css('background', colors[i] + '20');
    span.append($('<span>').text('-'));
    $colorStats.append(span);
    span = $('<div>').css('background', colors[i]);
    $colorPerc.append(span);
}
//#endregion colors

//#region buttons
var sub;
$('#pickers').hover(
    () => clearTimeout(sub),
    () => (sub = setTimeout(() => $('#subPicker').fadeOut(), 300))
);
$('.overlay').hover(
    () => (hoveringOverlay = true),
    () => (hoveringOverlay = false)
);
var tltp;
$('#menu>div').hover(
    function (ev) {
        var $this = $(this);
        let name = $this.attr('lang');
        if (!name || !lang[name]) return;
        clearTimeout(tltp);
        $('#tooltip')
            .css('top', $this.position().top + 6 + 'px')
            .css('opacity', '1');
        $('#tooltip a').text(lang[name]);
    },
    () => {
        tltp = setTimeout(() => $('#tooltip').css('opacity', ''), 100);
    }
);
$('#menu>div').click(function () {
    var $this = $(this);
    let opt = $this.find('i');
    switch ($this.attr('name')) {
        case 'cursors':
            if ((settings.showCursors = !settings.showCursors)) {
                opt.text('border_outer');
                $this.attr('lang', 'hideCursors');
            } else {
                opt.text('border_clear');
                $this.attr('lang', 'showCursors');
            }
            saveSettings();
            $('#tooltip a').text(lang[$this.attr('lang')]);
            break;
        case 'grid':
            if ((settings.showGrid = !settings.showGrid)) {
                opt.text('grid_on');
                $this.attr('lang', 'hideGrid');
            } else {
                opt.text('grid_off');
                $this.attr('lang', 'showGrid');
            }
            saveSettings();
            $('#tooltip a').text(lang[$this.attr('lang')]);
            break;
        case 'chat':
            if ((settings.showChat = !settings.showChat)) {
                opt.text('chat');
                $this.attr('lang', 'hideChat');
                openWindow('chat');
            } else {
                opt.text('chat_bubble_outline');
                $this.attr('lang', 'showChat');
                closeWindow('chat');
            }
            saveSettings();
            $('#tooltip a').text(lang[$this.attr('lang')]);
            break;
        case 'lupa':
            lupa = !lupa;
            $this.css('opacity', lupa ? '1' : '0.5');
            break;
        case 'settings':
            // openWindow('settings');
            break;
        case 'factions':
            socket.emit('ft', 0);
            openWindow('factions');
            break;
        case 'profile':
            if(userLogin) socket.emit('pf', userLogin[0]);
            openWindow('profile');
            break;
        case 'info':
            //TODO
            break;
        case 'menu':
            let c = $('#menu');
            c.toggleClass('active');
            if (c.css('top') == '0px') {
                c.css('top', '');
                opt.text('menu');
            } else {
                c.css('top', '0');
                opt.text('clear');
            }
            break;
    }
});
$('#chat > input').keyup((ev) => {
    if (ev.keyCode == 13) sendMessage();
});
$('#chat > i').click(sendMessage);
function sendMessage() {
    if (!loggedIn) return addNotification(lang['notLoggedIn']);
    var msg = $('#chat > input').val().trim();
    if (msg) {
        socket.emit('msg', msg);
        $('#chat > input').val('');
    }
}
$('.faclist').mouseup(function (ev) {
    if (ev.target.className != 'join' || user.faction) return;
    socket.emit('fr', ev.target.parentElement.attributes.fid.value);
    addNotification(lang['faction.requestsent'], '#555');
});
$('#faction .openreq').mouseup(function (ev) {
    $('#faction .requests').toggle();
});
(function () {
    try {
        let ns = JSON.parse(localStorage.getItem('settings'));
        if (!ns.showCursors) $('#menu>[name=cursors]').click();
        if (!ns.showGrid) $('#menu>[name=grid]').click();
        if (!ns.showChat) $('#menu>[name=chat]').click();
    } catch (e) {}
    let nc = +localStorage.getItem('selectedColor');
    if (!isNaN(nc) && nc > -1 && nc < 16) $('#picker>div:eq(' + nc + ')').click();

    if (window.location.search.startsWith('?login=')) {
        userLogin = window.location.search.slice(7);
        localStorage.setItem('user', userLogin);
        userLogin = userLogin.split(',');
        window.location.search = '';
    } else if (!userLogin) {
        userLogin = localStorage.getItem('user');
        userLogin = userLogin && userLogin.split(',');
    }
    if (!userLogin) $('#menu>[name=profile]>.alert').show();

    /**@type {JQuery<HTMLElement>} */
    var windowDrag = null;
    /**@type {JQuery.Coordinates} */
    var wpos = null;
    var px = 0,
        py = 0;
    $('.window').mousedown(function (ev) {
        $('.window').css('z-index', '');
        $(this).css('z-index', '3');
    });
    $('.window > .titlebar').mousedown(function (ev) {
        if (ev.target.className.includes('nodrag')) return;
        windowDrag = $(this.parentElement);
        wpos = windowDrag.position();
        px = ev.clientX;
        py = ev.clientY;
    });
    $(document).mouseup(function (ev) {
        if (ev.target.className.includes('close')) {
            closeWindow(ev.target.parentElement.parentElement);
        } else if (ev.target.className == 'userlink') {
            if (!ev.target.attributes.uid) return;
            openWindow('profile', false);
            socket.emit('pf', ev.target.attributes.uid.value);
        } else if (ev.target.className == 'faclink') {
            if (!ev.target.attributes.fid) return;
            openWindow('faction', false);
            socket.emit('fa', ev.target.attributes.fid.value);
            socket.emit('fm', ev.target.attributes.fid.value, 0);
        } else windowDrag = undefined;
    });
    $(document).mousemove(function (ev) {
        if (!windowDrag) return;
        wpos.left += ev.clientX - px;
        wpos.top += ev.clientY - py;
        windowDrag.css('left', wpos.left).css('top', wpos.top);
        px = ev.clientX;
        py = ev.clientY;
    });
})();
$('#factions .faccreate > .submit').click(() => {
    socket.emit('fc', $('#factions .faccreate > .name').val());
});
//#endregion buttons

//#region canvas

var tiled = new TiledCanvas($('#world')[0], { chunkSize: 256, fadeTime: 200, maxLoadedChunks: 30 });
window.tiled = tiled;
(function () {
    var go;
    if (document.location.search) {
        go = document.location.search.slice(1).split(',');
        go = [parseInt(go[0]) || 0, parseInt(go[1]) || 0, parseInt(go[2]) || 1];
    } else go = [0, 0];
    tiled.goto(0, 0);
    zoom = tiled.zoom = go[2] || 1;
    var center = getCoord(window.innerWidth / 2, window.innerHeight / 2);
    tiled.goto(go[0] - (center[0] - tiled.leftTopX), go[1] - (center[1] - tiled.leftTopY));
    var bg = new Image();
    bg.src = 'bg.png';
    tiled.loadingImage = bg;
    tiled.drawingRegion(-2560, -2560, 2560, 2560);
})();

var canvas = new p5((s) => {
    /**@type {import('p5').Graphics} */
    var grid;
    var holdingRight = false;
    var cWheel;
    var cWheelIndex;
    /**@type {import('p5').Vector} */
    var cWheelPos;
    var cWheelAnim = -1;
    const cWheelUnit = s.TAU / 16;
    var lHover = 0;
    var pZoom = zoom;

    s.setup = function () {
        s.createCanvas(s.windowWidth, s.windowHeight);
        $('.p5Canvas').attr('oncontextmenu', 'return false;');
        s.strokeWeight(0.1);
        s.noFill();
        s.textAlign(s.CENTER, s.TOP);
        s.noSmooth();
        grid = s.createGraphics(s.width + 32, s.height + 32);
        grid.strokeWeight(1);
        grid.stroke(100, 100);
        grid.draw = function () {
            grid.clear();
            for (let y = 0; y < grid.height; y += 16) grid.line(0, y, grid.width, y);
            for (let x = 0; x < grid.width; x += 16) grid.line(x, 0, x, grid.height);
        };
        cWheel = s.createGraphics(200, 200);

        $('#zoom .in').click(() => {
            zoom = s.constrain(zoom * 2, 1, 32);
            updateUrl();
        });
        $('#zoom .out').click(() => {
            zoom = s.constrain(zoom / 2, 1, 32);
            updateUrl();
        });

        s.windowResized();

        //TODO: zoom mobile
        // var mc = new Hammer.Manager($('.p5Canvas:eq(1)')[0]);
        // var pinch = new Hammer.Pinch();
        // // add to the Manager
        // mc.add([pinch]);
        // mc.on('pinch', function(ev) {
        //     socket.emit('debug',ev)
        // });
    };
    s.draw = function () {
        s.clear();
        if (tiled.zoom != zoom) {
            let d = zoom - tiled.zoom;
            if (Math.abs(d) < 0.1) tiled.zoom = zoom;
            else tiled.zoom += d * 0.6;
            tiled.leftTopX += s.mouseX / pZoom - s.mouseX / tiled.zoom;
            tiled.leftTopY += s.mouseY / pZoom - s.mouseY / tiled.zoom;
            tiled.leftTopX = s.constrain(tiled.leftTopX, -2600, 2600 - s.width / tiled.zoom);
            tiled.leftTopY = s.constrain(tiled.leftTopY, -2600, 2600 - s.height / tiled.zoom);
            redrawCanvas = true;
        }
        if (settings.showGrid && tiled.zoom > 13) {
            // if (pZoom != tiled.zoom) grid.draw();
            let f = tiled.zoom / 16;
            s.image(grid, -((2560 + tiled.leftTopX) % 1) * tiled.zoom, -((2560 + tiled.leftTopY) % 1) * tiled.zoom, grid.width * f, grid.height * f);
        }
        pZoom = tiled.zoom;

        s.push();
        s.scale(tiled.zoom);
        if (!holdingRight) {
            var [x, y] = getCoord(s.mouseX, s.mouseY);
            s.push();
            s.translate(x - tiled.leftTopX + 0.5, y - tiled.leftTopY + 0.5);
            s.rotate(Math.sin(s.millis() * 0.004) * 0.25);
            s.rectMode(s.CENTER);
            s.stroke(255);
            s.fill(colors[selectedColor]);
            s.strokeWeight(0.11);
            s.rect(0, 0, 1, 1);
            s.noFill();
            s.strokeWeight(0.09);
            s.stroke(0);
            s.rect(0, 0, 1, 1);
            s.pop();
        }
        if (settings.showCursors) {
            let cur;
            s.noFill();
            let i = 0;
            for (let id in cursors) {
                if (++i > 50) break;
                cur = cursors[id];
                cur.sx = (cur.sx + cur.x) / 2;
                cur.sy = (cur.sy + cur.y) / 2;
                if (zoom > 2) {
                    s.strokeWeight(0.11);
                    s.stroke(cur.c == 255 ? 0 : 255);
                    s.rect(cur.sx - tiled.leftTopX, cur.sy - tiled.leftTopY, 1, 1);
                    s.strokeWeight(0.09);
                    s.stroke(colors[cur.c] || 0);
                    s.rect(cur.sx - tiled.leftTopX, cur.sy - tiled.leftTopY, 1, 1);
                }
            }
        }
        s.pop();
        if (settings.showCursors) {
            s.fill(255);
            s.stroke(0);
            s.strokeWeight(1.5);
            let i = 0;
            for (let id in cursors) {
                if (++i > 50) break;
                let cur = cursors[id];
                s.text(id, (cur.sx - tiled.leftTopX + 0.5) * tiled.zoom, (cur.sy - tiled.leftTopY + 1.5) * tiled.zoom);
            }
            s.strokeWeight(0.1);
        }

        if (holdingRight) {
            let sub = new p5.Vector(s.mouseX, s.mouseY).sub(cWheelPos);
            if (sub.magSq() > 1000) {
                let nhover = sub.heading();
                if (nhover < 0) nhover += s.TAU;
                nhover = Math.floor(nhover / cWheelUnit);
                if (cWheelIndex != nhover) {
                    cWheelIndex = nhover;
                    updateWheel();
                }
            } else if (cWheelIndex > -1) {
                cWheelIndex = -1;
                updateWheel();
            }
            let cwsize = Math.min(s.millis() - cWheelAnim, 80) * 2.5;
            let cwhalf = cwsize / 2;
            s.image(cWheel, cWheelPos.x - cwhalf, cWheelPos.y - cwhalf, cwsize, cwsize);
        } else if (cWheelAnim > -1) {
            let diff = s.millis() - cWheelAnim;
            if (diff >= 80) cWheelAnim = -1;
            else {
                let cwsize = (80 - Math.min(diff, 80)) * 2.5;
                let cwhalf = cwsize / 2;
                s.image(cWheel, cWheelPos.x - cwhalf, cWheelPos.y - cwhalf, cwsize, cwsize);
            }
        }

        if (settings.pixelIndicator) {
            let now = Date.now();
            s.strokeWeight(1);
            s.noFill();
            for (var p of pixelsPlaced) {
                var size = now - p[3];
                if (size > 400) {
                    pixelsPlaced.delete(p);
                    continue;
                }
                size /= 5;
                s.stroke(p[2]);
                s.ellipse((p[0] - tiled.leftTopX) * tiled.zoom, (p[1] - tiled.leftTopY) * tiled.zoom, size, size);
            }
            s.strokeWeight(0.1);
        }
        if (redrawCanvas) {
            tiled.redrawOnce();
            redrawCanvas = false;
        }
    };
    s.mouseMoved = function () {
        document.querySelector('#coords').textContent = getCoord(s.mouseX, s.mouseY).join(', ');
    };
    s.mousePressed = function (ev) {
        if (ev.button == 2 && !hoveringOverlay && !lupa) {
            cWheelPos = new p5.Vector(s.mouseX, s.mouseY);
            holdingRight = true;
            cWheelAnim = s.millis();
            updateWheel();
        } else {
            lHover = hoveringOverlay;
        }
    };
    s.keyPressed = function (ev) {
        if (ev.key == ' ' && ev.target.tagName == 'BODY') {
            s.mouseReleased({ button: 0 });
        }
    };
    s.mouseReleased = function (ev) {
        if (lupa && !hoveringOverlay && ev.button != 1) {
            if (ev.button == 0 && zoom > 1) zoom << 1;
            if (ev.button == 2 && zoom < 32) zoom >> 1;
            updateUrl();
        } else if (ev.button == 2 && holdingRight) {
            holdingRight = false;
            cWheelAnim = s.millis();
            if (cWheelIndex > -1) {
                selectedColor = cWheelIndex;
                localStorage.setItem('selectedColor', selectedColor);
                $('.selected').removeClass('selected');
                $('#picker>div:eq(' + cWheelIndex + ')').addClass('selected');
            }
        } else if (dragging) {
            updateUrl();
            dragging = false;
            s.cursor();
        } else if (ev.button == 0 && !hoveringOverlay && stack >= 1) {
            if (!loggedIn) addNotification(lang['notLoggedIn']);
            let [x, y] = getCoord(s.mouseX, s.mouseY),
                cx = x >> 8,
                cy = y >> 8;
            var chunk = tiled.chunks[cx] && tiled.chunks[cx][cy];
            if (chunk) {
                let px = chunk.canvas.getContext('2d').getImageData(x & 0xff, y & 0xff, 1, 1).data;
                let clr = palette[selectedColor];
                if (px[0] == clr[0] && px[1] == clr[1] && px[2] == clr[2]) return;
            } else return;
            pixel(x, y, colors[selectedColor]);
            socket.emit('px', { x, y, c: selectedColor });
            stack--;
        }
    };
    s.mouseDragged = function (ev) {
        if (lHover || holdingRight || (ev.buttons != 4 && lupa)) return;
        let x = tiled.leftTopX + (s.pmouseX - s.mouseX) / zoom;
        let y = tiled.leftTopY + (s.pmouseY - s.mouseY) / zoom;
        x = s.constrain(x, -2600, 2600 - s.width / zoom);
        y = s.constrain(y, -2600, 2600 - s.height / zoom);
        tiled.goto(x, y);
        dragging = true;
        s.cursor('move');

        let pos = getCoord(s.mouseX, s.mouseY);
        document.querySelector('#coords').textContent = pos.join(', ');
    };
    s.mouseWheel = function (ev) {
        if (hoveringOverlay) return;
        if (ev.delta > 0) zoom /= 2;
        else zoom *= 2;
        zoom = s.constrain(zoom, 1, 32);
        updateUrl();
    };
    s.windowResized = function () {
        tiled.canvas.width = s.windowWidth;
        tiled.canvas.height = s.windowHeight;
        tiled.ctx.imageSmoothingEnabled = false;
        tiled.redrawOnce();
        s.resizeCanvas(s.windowWidth, s.windowHeight);
        if (grid) {
            grid.resizeCanvas(s.width + 32, s.height + 32);
            grid.draw();
        }
    };
    function updateWheel() {
        cWheel.clear();
        cWheel.stroke(0);
        cWheel.noFill();
        cWheel.ellipse(100, 100, 150, 150);
        var angle = 0;
        for (var i = 0; i < 16; i++) {
            cWheel.fill(colors[i]);
            var radius = i == cWheelIndex ? 170 : 150;
            cWheel.arc(100, 100, radius, radius, angle, (angle += cWheelUnit));
        }
        cWheel.drawingContext.globalCompositeOperation = 'destination-out';
        cWheel.fill(255);
        cWheel.ellipse(100, 100, 100, 100);
        cWheel.drawingContext.globalCompositeOperation = 'source-over';
        cWheel.stroke(0);
        cWheel.noFill();
        cWheel.ellipse(100, 100, 100, 100);
    }
});
window.canvas = canvas;

//#endregion canvas

//#region socketio
socket.on('connect', (d) => {
    console.info('Socket connected', socket.id);
    cursors = {};
    $('#disconnected').slideUp();
    $('#online').css('background', '');
});
socket.on('disconnect', (d) => {
    console.info('Socket disconnected');
    clearInterval(stackInterval);
    clearInterval(chunkInterval);
    $('#disconnected').slideDown();
    $('#online').css('background', 'rgb(251, 30, 30)');
    for (var ck of loadedChunks) {
        var [cx, cy] = fromChunkKey(ck);
        cx *= 256;
        cy *= 256;
        tiled.drawingRegion(cx, cy, cx + 256, cy + 256);
        tiled.context.fillStyle = '#00000070';
        tiled.context.fillRect(cx, cy, 256, 256);
        tiled.execute();
    }
    requestedChunks.clear();
    loadedChunks.clear();
    loggedIn = false;
});
socket.on('rd', (d) => {
    if (userLogin) {
        socket.emit('lg', userLogin[0], userLogin[1]);
    } else $('#menu>[name=profile]>.alert').show();
    stackInterval = setInterval(updateStack, 250);
    loadedChunks.clear();
    requestedChunks.clear();
    cursors = {};
    clearInterval(emitPos);
    clearInterval(chunkInterval);
    emitPos = setInterval(() => {
        let pos = getCoord(canvas.mouseX, canvas.mouseY);
        if (pos[0] == lastPos[0] && pos[1] == lastPos[1] && selectedColor == pselectedColor) return;
        socket.emit('ps', { x: pos[0], y: pos[1], c: selectedColor });
        lastPos = pos;
        pselectedColor = selectedColor;
    }, 80);
    chunkInterval = setInterval(() => {
        var visibleChunks = getVisibleChunks();
        visibleChunks.forEach((key) => {
            if (!requestedChunks.has(key)) {
                socket.emit('ch', key);
                requestedChunks.add(key);
            }
        });
    }, 500);
});
socket.on('ps', (d) => {
    if (!settings.showCursors) return;
    var data = Base64Binary.decode(d);
    for (var i = 0; i < data.length; i += 7) {
        var _id = (data[1 + i] << 8) + data[i];
        if (_id == cursorId) continue;
        var status = data[6 + i] & 1;
        if (!status) {
            delete cursors[_id];
            continue;
        }
        var x = (data[3 + i] << 8) + data[2 + i];
        var y = (data[5 + i] << 8) + data[4 + i];
        if (x >> 15) x = -(((~x >>> 0) & 0xffff) + 1);
        if (y >> 15) y = -(((~y >>> 0) & 0xffff) + 1);
        if (!cursors[_id]) cursors[_id] = { sx: y, sy: y };
        cursors[_id].x = x;
        cursors[_id].y = y;
        cursors[_id].c = (data[6 + i] >> 1) & 0xf;
    }
});
socket.on('id', (id) => {
    cursorId = id;
    addMessage(null, lang['chat.cursorid'].replace('$1', id), { color: '#14ff00' });
});
socket.on('on', (d) => {
    $('#online a').text(d);
});
socket.on('px', (u) => {
    var data = Base64Binary.decode(u);
    var x, y;
    for (var i = 0; i < data.length; i += 5) {
        x = (data[1 + i] << 8) + data[0 + i];
        y = (data[3 + i] << 8) + data[2 + i];
        if (x >> 15) x = -(((~x >>> 0) & 0xffff) + 1);
        if (y >> 15) y = -(((~y >>> 0) & 0xffff) + 1);
        if (settings.pixelIndicator) pixelsPlaced.add([x, y, colors[data[4 + i]], Date.now()]);
        pixel(x, y, colors[data[4 + i]]);
    }
});
const CCHUNKSIZE = 128 * 256;
socket.on('ch', (chunkKey, chunkData) => {
    loadedChunks.add(chunkKey);
    var [cx, cy] = fromChunkKey(chunkKey);
    var chunk = Base64Binary.decode(chunkData || '');
    var pixels = [];
    var row;
    var ci, rowmax;
    for (var i = 0; i < CCHUNKSIZE; i += 128) {
        row = new Array(256).fill(3);
        if (i < chunk.length) {
            ci = i;
            rowmax = i + Math.min(128, chunk.length - i);
            for (var j = 0; ci < rowmax; j += 2) {
                row[j] = chunk[ci] & 0b1111;
                row[j + 1] = chunk[ci] >> 4;
                ci++;
            }
        }
        pixels.push(row);
    }
    pzntg.create({
        pixels: pixels,
        palette: palette,
        scale: 1,
        callback: function (data) {
            var img = new Image();
            img.src = data;
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                tiled.setUserChunk(cx, cy, img);
                redrawCanvas = true;
            };
        }
    });
});
socket.on('msg', addMessage);
socket.on('an', addNotification);
socket.on('mh', (messages) => {
    $('#chat>.history').children().remove();
    for (var m of messages) addMessage([m[0], m[1]], m[2], m[3]);
    addMessage(null, lang['chat.welcome'], { links: true, linebreak: true, color: '#3fb7ff' });
});
socket.on('lg', (user) => {
    if (user.error) {
        $('#menu>[name=profile]>.alert').show();
        $('#profile > .user-card').addClass('lg');
        addNotification(lang['loginFail']);
        localStorage.removeItem('user');
        user = {};
        return;
    }
    loggedIn = true;
    $('#menu>[name=profile]>.alert').hide();
    socket.emit('pf', userLogin[0]);
    $('#profile > .user-card').removeClass('login');
});
socket.on('ft', (list, page) => {
    var $list = $('#factions .faclist');
    $list.children().remove();
    var place = page * 15;
    for (var fac of list) {
        place++;
        var $div = $('<div class="faclink">').attr('fid', fac[1]);
        if (!user.faction) $div.append($('<input type="button" class="join">').attr('value', lang['faction.join']));
        $div.append($('<span>').text(place + '. ' + fac[0])).append($('<span>').html(`${lang['stats.members'].replace('$1', fac[2])}<br> ${fac[3]} pixels`));
        $list.append($div);
    }
});
socket.on('fa', (fac) => {
    $('#faction>.titlebar>span:eq(0)').text(fac.name);
    var max = fac.stats.pixels;
    for (var i in fac.stats.colors) {
        $(`#faction .stats .colorperc > div:eq(${i})`).css('width', max ? (fac.stats.colors[i] / max) * 100 + '%' : '');
        $(`#faction .stats .colors > span:eq(${i}) > span`).text(fac.stats.colors[i]);
    }
    if (fac.requests) {
        $('#faction .openreq').show();
        var $reqlist = $('#faction .requests');
        $reqlist.children().remove();
        for (var req of fac.requests) {
            var $div = $('<div>')
                .append($('<span>').text(req[0]))
                .append(
                    $('<i class="material-icons">')
                        .text('group_add')
                        .click(() => {
                            socket.emit('fra', req[1]);
                            socket.emit('fa', user.faction[1]);
                            $div.remove();
                        })
                );
            $reqlist.append($div);
        }
    } else $('#faction .openreq').hide();
});
socket.on('fc', (res) => {
    if (res.error) {
        addNotification(lang[fid.error]);
    } else {
        closeWindow('factions');
        openWindow('faction', false);
        socket.emit('fa', res.id);
        socket.emit('fm', res.id, 0);
        user.faction = [$('.faccreate .name').val(), res.id];
        addNotification(lang['faction.create.success'], '#0f0');
        $('.faccreate').css('display', 'none');
    }
});
socket.on('fm', (list, page) => {
    var $list = $('#faction .memberlist');
    $list.children().remove();
    var place = page * 15;
    for (var u of list) {
        place++;
        var $div = $('<div class="userlink">').attr('uid', u[1]);
        $div.append($('<span>').text(place + '. ' + u[0]));
        $div.append($('<span>').html(u[2] + ' pixels'));
        $list.append($div);
    }
});
socket.on('pf', (target) => {
    if (target.id == userLogin[0]) {
        user = target;
        if (user.faction) $('.faccreate').css('display', 'none');
    }
    var color = '#000';
    if (target.admin) color = '#f30';
    else if (target.online) color = '#3f3';
    $('#profile>.user-card .avatar')
        .attr('src', `https://cdn.discordapp.com/avatars/${target.discord.id}/${target.discord.avatar}.png?size=128`)
        .css('border', '2px solid ' + color);
    $('#profile>.user-card .name').text(target.username);
    $('#profile>.user-card .discordname')
        .text(target.discord.username)
        .append($('<span class="discriminator">').text('#' + target.discord.discriminator));
    $('#profile>.user-card .userid').text(target.id);

    $('#profile .stats .pixels span:eq(1)').text(target.stats.pixels);
    if (target.faction) {
        $('#profile .stats .faction').css('display', '');
        $('#profile .stats .faction span:eq(1)').text(target.faction[0]).attr('fid', target.faction[1]);
    } else $('#profile .stats .faction').css('display', 'none');
    var max = target.stats.colors.reduce((p, v) => p + v, 0);
    for (var i in target.stats.colors) {
        $(`#profile .stats .colorperc > div:eq(${i})`).css('width', max ? (target.stats.colors[i] / max) * 100 + '%' : '');
        $(`#profile .stats .colors > span:eq(${i}) > span`).text(target.stats.colors[i]);
    }
});
socket.on('stack', (s, smax, stime) => {
    stack = s;
    stackMax = smax;
    stackRefresh = stime;
    updateStack();
    if (stack < 0) stack = s;
});
socket.on('vs', (ver) => {
    if (serVer && serVer != ver) return addNotification(lang['outdated']);
    serVer = ver;
});
//#endregion socketio

//#region functions
function getVisibleChunks() {
    /**@type {number[][]} */
    var chunks = [];
    var sx = tiled.leftTopX >> 8;
    var sy = tiled.leftTopY >> 8;
    var ex = (tiled.leftTopX + window.innerWidth / zoom) >> 8;
    var ey = (tiled.leftTopY + window.innerHeight / zoom) >> 8;
    for (let y = sy; y < ey + 1; y++) for (let x = sx; x < ex + 1; x++) chunks.push(toChunkKey(x, y));
    return chunks;
}
function pixel(x, y, c, w = 1, h = 1) {
    tiled.context.fillStyle = c;
    tiled.context.fillRect(x, y, w, h);
    tiled.drawingRegion(x, y, x + w, y + h);
    tiled.execute();
}
function getCoord(x, y) {
    if (!tiled) return [0, 0];
    return [Math.floor(x / tiled.zoom + tiled.leftTopX), Math.floor(y / tiled.zoom + tiled.leftTopY)];
}
function toChunkKey(x, y) {
    return ((y & 0x1f) << 5) + (x & 0x1f);
}
function fromChunkKey(k) {
    let x = k & 0x1f;
    let y = k >> 5;
    if (x >> 4) x = -(((~x >>> 0) & 0x1f) + 1);
    if (y >> 4) y = -(((~y >>> 0) & 0x1f) + 1);
    return [x, y];
}
function updateStack() {
    var now = Date.now();
    var add = (now - stackRefresh) / 500;
    stack = Math.min(stackMax, add + stack);
    stackRefresh = now;
    var f = Math.floor(stack);
    $('#stack').text(f + '/' + stackMax);
    document.title = `PixelSpace (${f}/${stackMax})`;
}
var lastMessageUser = null;
var lastMessageUserRepeat = 0;
function addMessage(user, message, options = {}) {
    var $chat = $('#chat>.history');
    var chat = $chat[0];
    if (chat.children.length > 60) $chat.find('div:first').remove();
    var shouldScroll = chat.scrollTop + chat.clientHeight === chat.scrollHeight;
    var merge = user && lastMessageUser == user[1] && ++lastMessageUserRepeat < 4;
    var div = merge ? $('#chat>.history>div:last') : $('<div>');
    lastMessageUser = user && user[1];
    if (user && !merge) {
        lastMessageUserRepeat = 0;
        message = ' ' + message;
        let $a = $('<a>')
            .text(user[0] + ':')
            .css('color', options.userColor || '');
        if (user[1] !== '0') {
            $a.addClass('userlink').attr('uid', user[1]);
        }
        div.append($a);
    }
    var text = $('<p>').text(message);
    var html = text.html();
    if (options.linebreak) html = html.replace(/\n/g, '<br>');
    if (options.color) text.css('color', options.color);
    if (options.links) html = html.replace(/https?:\/\/[^ ]+/g, (s) => `<a target="_blank" href="${s}">${s}</a>`);
    html = html.replace(/&lt;:([^:]+):(\d+)&gt;/g, (s, name, id) => {
        var img = document.createElement('img');
        img.src = `https://cdn.discordapp.com/emojis/${id}.png`;
        img.width = '24';
        img.height = '24';
        img.title = name;
        img.className = 'emote';
        return img.outerHTML;
    });
    html = html.replace(/&lt;@([^#]+)#(\d+)&gt;/g, (s, name, id) => {
        if (id == user.id) div.css('background', '#331');
        return `<a uid="${id}" class="userlink">@${name}</a>`;
    });
    text.html(html.replace(/\*\*((\\\*|[^*])+)\*\*/g, (s, a) => `<b>${a}</b>`));
    var content = merge ? $('#chat>.history>div:last>.content') : $('<div>').addClass('content');
    content.append(text);
    if (!merge) $('#chat > .history').append(div.append(content));
    if (shouldScroll) {
        chat.scrollTop = chat.scrollHeight;
    }
}
function updateUrl() {
    let [x, y] = getCoord(canvas.width / 2, canvas.height / 2);
    window.history.replaceState('', '', '/' + '?' + x + ',' + y + (zoom == 1 ? '' : ',' + zoom));
}
function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
}
function addNotification(msg, color) {
    var el = document.createElement('span');
    el.textContent = msg;
    el.style.background = color;
    el.style.marginBottom = '-40px';
    el.style.opacity = '0';
    document.querySelector('#notif>div').appendChild(el);
    setTimeout(() => (el.style.marginBottom = el.style.opacity = ''), 30);
    setTimeout(() => {
        el.style.marginBottom = '-40px';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 20000);
}
/**@param {string | JQuery<HTMLElement>} win */
function openWindow(win, resetPos = true) {
    var $el = typeof win == 'string' ? $('#' + win) : $(win);
    if (resetPos) $el.css('left', '').css('top', '');
    $('.window').css('z-index', '');
    $el.css('display', '').css('z-index', '3');
    setTimeout(() => $el.css('opacity', ''), 0);
}
/**@param {string | JQuery<HTMLElement>} win */
function closeWindow(win) {
    var $el = typeof win == 'string' ? $('#' + win) : $(win);
    $el.css('opacity', '0');
    setTimeout(() => $el.css('display', 'none'), 100);
}
//#endregion functions
