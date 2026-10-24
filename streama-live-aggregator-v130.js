/**
 * Streama 组件：全平台直播聚合
 *
 * 聚合 B站 / 斗鱼 / 虎牙 / 抖音。**无需本地服务**，组件内直连各平台接口。
 *
 * 与 CapyPlayer 版的对应关系（按 Streama 原生契约改写）：
 *  - 模块 type 用 "video"（列表）/ "stream"（播放源），并声明 requiredVersion 走原生契约
 *  - 播放头字段名是 headers（Capy 是 customHeaders）
 *  - 多线路用 childItems（Capy 的 playSources 在 Streama 详情页不生效）
 *  - loadDetail 是两个参数 (link, extraParams)
 *  - 斗鱼签名用宿主注入的 crypto.md5()，无需手写实现
 *  - 标题下方主播名用 subTitle 字段（Streama 有正规副标题位）
 *  - 超时/重试/缓存宿主不消费，函数内自行用 timeout + Widget.storage TTL
 *
 * 遵循《Streama 组件开发指南》原生契约。
 */

/* ============================ 游戏分区数据 ============================ */
/* 每个游戏一个独立模块，跨平台聚合。ID 为各平台固定分类 ID */

var GAME_LIST = [
  { key: 'g00', name: '王者荣耀', huya: '2336', douyu: '181', biliArea: '35', biliParent: '3' },
  { key: 'g01', name: '英雄联盟', huya: '1', douyu: '1', biliArea: '86', biliParent: '2' },
  { key: 'g02', name: '和平精英', huya: '3203', douyu: '350', biliArea: '256', biliParent: '3' },
  { key: 'g03', name: '我的世界', huya: '1732', douyu: '44', biliArea: '216', biliParent: '6' },
  { key: 'g04', name: '穿越火线', huya: '4', douyu: '33', biliArea: '88', biliParent: '2' },
  { key: 'g05', name: '原神', huya: '5489', douyu: '1223', biliArea: '321', biliParent: '3' },
  { key: 'g06', name: '无畏契约', huya: '5937', douyu: '1554', biliArea: '329', biliParent: '2' },
  { key: 'g07', name: '炉石传说', huya: '393', douyu: '2', biliArea: '91', biliParent: '2' },
  { key: 'g08', name: '坦克世界', huya: '802', douyu: '142', biliArea: '115', biliParent: '2' },
  { key: 'g09', name: '魔兽世界', huya: '8', douyu: '5', biliArea: '83', biliParent: '2' },
  { key: 'g10', name: '永劫无间', huya: '6219', douyu: '1227', biliArea: '666', biliParent: '2' },
  { key: 'g11', name: 'DOTA2', huya: '7', douyu: '3', biliArea: '92', biliParent: '2' },
  { key: 'g12', name: '第五人格', huya: '3115', douyu: '356', biliArea: '163', biliParent: '3' },
  { key: 'g13', name: '金铲铲之战', huya: '7185', douyu: '2556', biliArea: '514', biliParent: '3' },
  { key: 'g14', name: 'QQ飞车', huya: '9', douyu: '331', biliArea: '610', biliParent: '2' },
  { key: 'g15', name: '三国杀', huya: '1669', douyu: '14', biliArea: '81', biliParent: '2' },
  { key: 'g16', name: 'CS2', huya: '862', douyu: '6', biliArea: '89', biliParent: '2' },
  { key: 'g17', name: '蛋仔派对', huya: '6909', douyu: '3358', biliArea: '571', biliParent: '3' },
  { key: 'g18', name: '问道', huya: '107', douyu: '', biliArea: '670', biliParent: '2' },
  { key: 'g19', name: '迷你世界', huya: '2683', douyu: '273', biliArea: '', biliParent: '' },
  { key: 'g20', name: '狼人杀', huya: '2785', douyu: '260', biliArea: '41', biliParent: '3' },
  { key: 'g21', name: '崩坏：星穹铁道', huya: '7349', douyu: '3379', biliArea: '549', biliParent: '3' },
  { key: 'g22', name: '元梦之星', huya: '9521', douyu: '4149', biliArea: '822', biliParent: '3' },
  { key: 'g23', name: '剑网3', huya: '900', douyu: '65', biliArea: '82', biliParent: '2' },
  { key: 'g24', name: '战争雷霆', huya: '624', douyu: '', biliArea: '316', biliParent: '2' },
  { key: 'g25', name: '守望先锋', huya: '2174', douyu: '148', biliArea: '87', biliParent: '2' },
  { key: 'g26', name: '星际争霸', huya: '5', douyu: '4', biliArea: '', biliParent: '' },
  { key: 'g27', name: '阴阳师', huya: '2598', douyu: '240', biliArea: '36', biliParent: '3' },
  { key: 'g28', name: '燕云十六声', huya: '8019', douyu: '3775', biliArea: '903', biliParent: '2' },
  { key: 'g29', name: '逆水寒', huya: '2952', douyu: '434', biliArea: '', biliParent: '' },
  { key: 'g30', name: '跑跑卡丁车', huya: '162', douyu: '90', biliArea: '664', biliParent: '2' },
  { key: 'g31', name: '明日方舟', huya: '', douyu: '531', biliArea: '255', biliParent: '3' },
  { key: 'g32', name: '卡拉彼丘', huya: '', douyu: '3010', biliArea: '782', biliParent: '2' },
  { key: 'g33', name: '主机游戏', huya: '100032', douyu: '19', biliArea: '236', biliParent: '6' }
];

/* ============================ 常量与工具 ============================ */

var PLATFORM_NAMES = { bilibili: 'B站', douyu: '斗鱼', huya: '虎牙', douyin: '抖音' };
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
var REQ_TIMEOUT = 20000;

function toInt(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : (d || 0); }
function ensureArray(v) { return Array.isArray(v) ? v : []; }
function esc(s) { return String(s == null ? '' : s); }

/**
 * 播放地址统一升级为 https
 * 虎牙/抖音接口返回的是 http:// 明文地址：会被运营商劫持插广告、部分播放器/盒子
 * 禁止明文流量；实测抖音有个房间 http 返回 404 而 https 正常，故一律升级
 */
function toHttps(u) {
  var s = esc(u).trim();
  if (s.indexOf('http://') === 0) return 'https://' + s.slice(7);
  return s;
}
function safeJson(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return {}; } }
  return {};
}

/**
 * 统一 GET。
 * Streama 的 Widget.http 在网络失败与状态码 >=400 时直接 reject，必须 try/catch。
 */
async function httpGet(url, params, headers, timeout) {
  var resp = await Widget.http.get(url, {
    params: params || {},
    headers: Object.assign({ 'User-Agent': UA }, headers || {}),
    timeout: timeout || REQ_TIMEOUT
  });
  return { data: safeJson(resp.data), headers: resp.headers || {} };
}

/** 取原始文本（抖音首页正则提取用） */
async function httpText(url, headers) {
  var resp = await Widget.http.get(url, {
    headers: Object.assign({ 'User-Agent': UA }, headers || {}),
    timeout: REQ_TIMEOUT
  });
  var text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
  return { text: text, headers: resp.headers || {} };
}

/** POST form（斗鱼签名播放地址） */
async function httpPostForm(url, form, headers) {
  var resp = await Widget.http.post(url, form, {
    headers: Object.assign({ 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, headers || {}),
    timeout: REQ_TIMEOUT
  });
  return safeJson(resp.data);
}

/** md5：优先用宿主 crypto，缺失时用内置实现 */
var MD5_FALLBACK = (function () {
  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md51(s) {
    var n = s.length;
    var state = [1732584193, -271733879, -1732584194, 271733878];
    var i;
    for (i = 64; i <= s.length; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 128 << ((i % 4) << 3);
    if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function md5blk(s) {
    var md5blks = [], i;
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  var hex_chr = '0123456789abcdef';
  function rhex(n) {
    var s = '', j;
    for (j = 0; j < 4; j++) s += hex_chr.charAt((n >> (j * 8 + 4)) & 15) + hex_chr.charAt((n >> (j * 8)) & 15);
    return s;
  }
  function hex(x) { for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(''); }
  function add32(a, b) { return (a + b) & 4294967295; }
  return function (str) { return hex(md51(unescape(encodeURIComponent(str)))); };
})();

function md5(s) {
  // 统一用内置纯 JS 实现，不用宿主 crypto.md5：
  // 各家宿主的 md5 输入编码/输出格式不保证一致（有设备上算出的签名
  // 与标准值不同，导致斗鱼两条线路全部「鉴权失败/403」），签名必须确定性
  return MD5_FALLBACK(String(s));
}

/** 从响应头取 cookie；Streama 原生契约下是字符串，Capy 协议下是数组，两种都兼容 */
function pickCookie(headers, name) {
  if (!headers) return '';
  var raw = headers['set-cookie'] || headers['Set-Cookie'] || headers['set-Cookie'] || '';
  var arr = Array.isArray(raw) ? raw : String(raw).split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
  for (var i = 0; i < arr.length; i++) {
    var pair = String(arr[i]).split(';')[0].trim();
    if (pair.indexOf(name + '=') === 0) return pair;
  }
  return '';
}

/* ---- 隔离存储（带 TTL，宿主不提供缓存，自建） ---- */
function cacheGet(key) {
  try {
    var raw = Widget.storage.get(key, '');
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.expire && o.expire > Date.now() / 1000) return o.value;
    return null;
  } catch (e) { return null; }
}
function cacheSet(key, value, ttlSeconds) {
  try {
    Widget.storage.set(key, JSON.stringify({ value: value, expire: Date.now() / 1000 + (ttlSeconds || 120) }));
  } catch (e) {}
}

function saveCookies(p) {
  try {
    if (p && p.cookieBilibili) Widget.storage.set('bili_cookie', p.cookieBilibili);
    if (p && p.cookieDouyin) Widget.storage.set('dy_cookie', p.cookieDouyin);
    if (p && p.cookieDouyu) Widget.storage.set('douyu_cookie', p.cookieDouyu);
    if (p && p.cookieHuya) Widget.storage.set('huya_cookie', p.cookieHuya);
  } catch (e) {}
}
function biliCookie() { try { return Widget.storage.get('bili_cookie', '') || ''; } catch (e) { return ''; } }
function dyCookie() { try { return Widget.storage.get('dy_cookie', '') || ''; } catch (e) { return ''; } }
function douyuCookie() { try { return Widget.storage.get('douyu_cookie', '') || ''; } catch (e) { return ''; } }
function huyaCookie() { try { return Widget.storage.get('huya_cookie', '') || ''; } catch (e) { return ''; } }

/* ============================ 播放请求头 ============================ */
/* CDN 校验 UA/Referer/Cookie，缺失会缓冲几秒即断流 */

function playHeaders(platform) {
  var h = { 'User-Agent': UA };
  if (platform === 'bilibili') {
    h['Referer'] = 'https://live.bilibili.com/';
    h['Origin'] = 'https://live.bilibili.com';
    var c = biliCookie();
    if (c) h['Cookie'] = c;
  } else if (platform === 'douyu') {
    h['Referer'] = 'https://www.douyu.com/';
    var dyc = douyuCookie();
    if (dyc) h['Cookie'] = dyc;
  } else if (platform === 'douyin') {
    h['Referer'] = 'https://live.douyin.com/';
    var dync = dyCookie();
    if (dync) h['Cookie'] = dync;
  } else if (platform === 'huya') {
    // 虎牙 CDN 不能带 Referer（会 403），只带 UA + 可选 Cookie
    var hc = huyaCookie();
    if (hc) h['Cookie'] = hc;
  }
  return h;
}

/* ============================ 平台实现 ============================ */

/* ---------------- B站 ---------------- */
var bili = {
  async getRooms(category, page) {
    var cat = esc(category) || '2:0';
    var parts = cat.split(':');
    var r = await httpGet(
      'https://api.live.bilibili.com/room/v1/Area/getRoomList',
      {
        platform: 'web',
        parent_area_id: parts[0] || '2',
        area_id: parts[1] || '0',
        sort_type: 'online',
        page: page
      },
      { Referer: 'https://live.bilibili.com/' }
    );
    return ensureArray(r.data.data).map(function (x) {
      return {
        platform: 'bilibili',
        roomId: esc(x.roomid),
        title: esc(x.title),
        anchor: esc(x.uname),
        cover: esc(x.user_cover) || esc(x.cover),
        online: toInt(x.online),
        category: esc(x.area_name),
        link: 'https://live.bilibili.com/' + esc(x.roomid)
      };
    });
  },

  async getPlay(roomId) {
    var r = await httpGet(
      'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo',
      { room_id: roomId, protocol: '0,1', format: '0,1,2', codec: '0,1', qn: 10000, platform: 'web', ptype: 8 },
      { Referer: 'https://live.bilibili.com/' }
    );
    var pu = r.data.data && r.data.data.playurl_info && r.data.data.playurl_info.playurl;
    var streams = ensureArray(pu && pu.stream);
    var qDesc = ensureArray(pu && pu.g_qn_desc);
    var best = null;
    for (var i = 0; i < streams.length; i++) {
      var fmts = ensureArray(streams[i].format);
      for (var f = 0; f < fmts.length; f++) {
        var codecs = ensureArray(fmts[f].codec);
        for (var c = 0; c < codecs.length; c++) {
          var cc = codecs[c];
          var info = ensureArray(cc.url_info)[0] || {};
          var url = esc(info.host) + esc(cc.base_url) + esc(info.extra);
          if (!url || url.indexOf('http') !== 0) continue;
          var q = toInt(cc.current_qn);
          if (!best || q > best.q) {
            var desc = '';
            for (var d = 0; d < qDesc.length; d++) {
              if (toInt(qDesc[d].qn) === q) { desc = esc(qDesc[d].desc); break; }
            }
            best = { q: q, url: url, name: desc || ('qn' + q), proto: esc(fmts[f].protocol_name) };
          }
        }
      }
    }
    if (!best) return { title: '', anchor: '', videoUrl: '', error: '未在直播或无播放地址' };
    var qLabel = best.name + (best.proto ? ' · ' + best.proto : '');
    return { title: '', anchor: '', videoUrl: toHttps(best.url), quality: qLabel };
  },

  async getFollows(page) {
    var cookie = biliCookie();
    if (!cookie) return { needCookie: true, rooms: [] };
    var r = await httpGet(
      'https://api.live.bilibili.com/room/v1/Area/getRoomList',
      { platform: 'web', parent_area_id: 9, area_id: 0, sort_type: 'live_status', page: page },
      { Referer: 'https://live.bilibili.com/', Cookie: cookie }
    );
    return {
      needCookie: false,
      rooms: ensureArray(r.data.data).map(function (x) {
        return {
          platform: 'bilibili', roomId: esc(x.roomid), title: esc(x.title), anchor: esc(x.uname),
          cover: esc(x.user_cover) || esc(x.cover), online: toInt(x.online),
          category: esc(x.area_name), link: 'https://live.bilibili.com/' + esc(x.roomid)
        };
      })
    };
  },

  async search(keyword, page) {
    var out = [];
    var cats = ['2:0', '3:0', '1:0'];
    for (var i = 0; i < cats.length; i++) {
      try { out = out.concat(await this.getRooms(cats[i], page)); } catch (e) {}
    }
    return filterRooms(out, keyword);
  }
};

/* ---------------- 虎牙 ---------------- */
var huya = {
  /** 列表接口必须带 XHR 头，否则返回 HTML 反爬页 */
  listHeaders: function () {
    var h = { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.huya.com/' };
    var c = huyaCookie();
    if (c) h['Cookie'] = c;
    return h;
  },
  /** 播放详情接口：CDN 侧不能带 Referer，但接口本身可以带 Cookie */
  playHeaders: function () {
    var h = { Referer: 'https://www.huya.com/' };
    var c = huyaCookie();
    if (c) h['Cookie'] = c;
    return h;
  },

  async getRooms(category, page) {
    var r = await httpGet(
      'https://www.huya.com/cache.php',
      { m: 'LiveList', do: 'getLiveListByPage', tagAll: 0, gameId: category || '1', page: page },
      this.listHeaders()
    );
    return ensureArray(r.data.data && r.data.data.datas).map(function (x) {
      return {
        platform: 'huya', roomId: esc(x.profileRoom),
        title: esc(x.introduction) || esc(x.roomName), anchor: esc(x.nick),
        cover: esc(x.screenshot), avatar: esc(x.avatar180),
        online: toInt(x.totalCount),
        category: esc(x.gameFullName), link: 'https://www.huya.com/' + esc(x.profileRoom)
      };
    });
  },

  /** 只取 HS 线路（AL/TX 会 302 跳 IPv6，播放几秒即断） */
  async getPlay(roomId) {
    var r = await httpGet(
      'https://mp.huya.com/cache.php',
      { m: 'Live', do: 'profileRoom', roomid: roomId, showSecret: 1, _: Date.now() },
      this.playHeaders()
    );
    var d = r.data;
    var data = d.data || {};
    if (toInt(d.status) !== 200 || !data.stream) {
      return { title: '', anchor: '', videoUrl: '', error: '未在直播或房间不存在' };
    }
    var lines = ensureArray(data.stream.flv && data.stream.flv.multiLine);
    var pick = null;
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].url) continue;
      if (!pick) pick = lines[i];
      if (esc(lines[i].cdnType) === 'HS') { pick = lines[i]; break; }
    }
    if (pick && pick.url) {
      return {
        title: esc(data.liveData && data.liveData.introduction),
        anchor: esc(data.profileInfo && data.profileInfo.nick),
        videoUrl: toHttps(pick.url), quality: '源画质 · ' + esc(pick.cdnType || 'HS')
      };
    }
    var hl = ensureArray(data.stream.hls && data.stream.hls.multiLine);
    var hpick = null;
    for (var j = 0; j < hl.length; j++) {
      if (!hl[j].url) continue;
      if (!hpick) hpick = hl[j];
      if (esc(hl[j].cdnType) === 'HS') { hpick = hl[j]; break; }
    }
    if (hpick && hpick.url) {
      return {
        title: esc(data.liveData && data.liveData.introduction),
        anchor: esc(data.profileInfo && data.profileInfo.nick),
        videoUrl: toHttps(hpick.url), quality: 'HLS 源画质 · ' + esc(hpick.cdnType || 'HS')
      };
    }
    return { title: '', anchor: '', videoUrl: '', error: '无可用线路' };
  },

  async getCategories() {
    var r = await httpGet(
      'https://www.huya.com/cache.php',
      { m: 'Game', do: 'getGameList', bussType: 4, page: 1, pageSize: 400 },
      this.listHeaders()
    );
    return ensureArray(r.data.gameList).map(function (g) {
      return { id: esc(g.gid), name: esc(g.gameFullName) };
    });
  },

  async search(keyword, page) {
    var out = [];
    try {
      var cats = await this.getCategories();
      var kw = keyword.toLowerCase();
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].name.toLowerCase().indexOf(kw) >= 0) {
          out = out.concat(await this.getRooms(cats[i].id, page));
          break;
        }
      }
    } catch (e) {}
    try { out = out.concat(await this.getRooms('1', page)); } catch (e) {}
    return filterRooms(out, keyword);
  }
};

/* ---------------- 斗鱼 ---------------- */

/** 封面：接口的 rs16/rs1 现在直接是完整 URL，旧版是 hash ID，两种都兼容 */
function douyuCover(rs) {
  var s = esc(rs);
  if (!s) return '';
  if (s.indexOf('http') === 0) return s;
  return 'https://apic.douyucdn.cn/upload/' + s + '.jpg';
}
/** 头像：av 是路径，拼 apic 域名 */
function douyuAvatar(av) {
  var s = esc(av);
  if (!s) return '';
  if (s.indexOf('http') === 0) return s;
  return 'https://apic.douyucdn.cn/upload/' + s + '_middle.jpg';
}

var douyu = {
  DID: '10000000000000000000000000001501',

  /** 请求头：带登录 Cookie 可提升画质并降低限流概率 */
  baseHeaders: function () {
    var h = { Referer: 'https://www.douyu.com/' };
    var c = douyuCookie();
    if (c) h['Cookie'] = c;
    return h;
  },

  async getRooms(category, page) {
    var r = await httpGet(
      'https://www.douyu.com/gapi/rkc/directory/mixList/2_' + (category || '1') + '/' + page,
      {},
      this.baseHeaders()
    );
    return ensureArray(r.data.data && r.data.data.rl).map(function (x) {
      return {
        platform: 'douyu', roomId: esc(x.rid),
        title: esc(x.rn) || esc(x.roomName), anchor: esc(x.nn),
        cover: douyuCover(x.rs16) || douyuCover(x.rs1),
        avatar: douyuAvatar(x.av),
        online: toInt(x.ol),
        category: esc(x.c2name) || esc(x.cname), link: 'https://www.douyu.com/' + esc(x.rid)
      };
    });
  },

  async getEncryption() {
    var cached = cacheGet('dy_enc');
    if (cached) return cached;
    var ts = Math.floor(Date.now() / 1000);
    var r = await httpGet(
      'https://www.douyu.com/wgapi/livenc/liveweb/websec/getEncryption',
      { did: this.DID, tt: ts },
      this.baseHeaders()
    );
    var enc = r.data.data;
    if (enc) cacheSet('dy_enc', enc, Math.max(30, toInt(enc.expire_at) - ts - 30));
    return enc;
  },

  /**
   * CDN 线路优先级（实测 2026-10-19，6 个房间）：
   *  hw-h5 → hwa.douyucdn2.cn   ：不 302，直连可达  ✅ 首选
   *  hs-h5 → huosa.douyucdn2.cn ：302 跳 240e_xxx.bytefcdnrd.com（IPv6 专用节点），
   *                               无 IPv6 的盒子/手机连不上 → 播放器报 403，仅兜底
   */
  CDN_SEQ: ['hw-h5', 'hs-h5'],
  /* 清晰度兜底顺序：原画 → 蓝光4M → 超清 → 高清 */
  RATE_SEQ: [0, 4, 3, 2],

  /** 主机名是否为IPv6编码域名（如 240e_908_8106_1_8000_0_b00_12.bytefcdnrd.com） */
  isIPv6Host: function (host) {
    var h = esc(host).toLowerCase();
    return /^(2408|2409|240e|240a|240c|240d|240f|2a0|2a1)/.test(h);
  },

  /**
   * 首选线路：playweb.douyucdn.cn（斗鱼独立 CDN 域名，非主站）
   *  · 鉴权只要 md5(房间号 + 毫秒时间戳)，不需要 enc_data / 跑 JS 签名
   *  · 不经过 www.douyu.com 的 WAF —— 手机网络/部分设备直连主站 getH5PlayV1 会被 403
   *  · 返回 HLS master m3u8，源站 hlshw*.douyucdn2.cn、子流 livehwc4.com 都是 IPv4
   * 实测 7/7 房间可用
   */
  async getPlayHls(rid) {
    var t13 = String(Date.now());
    var d;
    try {
      d = await httpPostForm(
        'https://playweb.douyucdn.cn/lapi/live/hlsH5Preview/' + rid,
        'rid=' + rid + '&did=' + this.DID,
        { rid: rid, time: t13, auth: md5(rid + t13), Referer: 'https://www.douyu.com/' }
      );
    } catch (e) {
      return { title: '', anchor: '', videoUrl: '', error: esc(e && e.message) || '网络错误' };
    }
    var code = toInt(d.error);
    if (code === 102) return { title: '', anchor: '', videoUrl: '', error: '房间不存在' };
    if (code === 104) return { title: '', anchor: '', videoUrl: '', error: '主播未开播' };
    if (code !== 0) return { title: '', anchor: '', videoUrl: '', error: esc(d.msg) || '获取失败' };
    var dd = d.data || {};
    var url = esc(dd.rtmp_url) + '/' + esc(dd.rtmp_live);
    if (!url || url.indexOf('http') !== 0) return { title: '', anchor: '', videoUrl: '', error: '无 HLS 地址' };
    var host = '';
    try { host = new URL(url).hostname; } catch (e) { host = ''; }
    if (host && this.isIPv6Host(host)) return { title: '', anchor: '', videoUrl: '', error: '线路为 IPv6 节点' };
    return {
      title: '', anchor: '', videoUrl: toHttps(url),
      quality: '原画 · HLS' + (esc(dd.rtmp_cdn) ? ' · ' + esc(dd.rtmp_cdn) : '')
    };
  },

  async getPlay(roomId) {
    var rid = esc(roomId);

    // ① 先走 HLS 预览接口（独立域名、鉴权轻，主站 403 时这条路仍能通）
    var hlsErr = '';
    try {
      var h = await this.getPlayHls(rid);
      if (h.videoUrl) return h;
      // 房间不存在 / 未开播：没必要再试主站，直接返回，省一次请求
      if (esc(h.error).indexOf('未开播') >= 0 || esc(h.error).indexOf('不存在') >= 0) return h;
      hlsErr = 'HLS线路:' + esc(h.error);
    } catch (e) {
      hlsErr = 'HLS线路:' + esc(e && e.message);
    }

    // ② 兜底：主站 getH5PlayV1（需 enc_data 签名，固定 hw-h5 线路）
    var enc = await this.getEncryption();
    var ts = Math.floor(Date.now() / 1000);
    var salt = toInt(enc.is_special) === 1 ? '' : rid + ts;
    var secret = enc.rand_str;
    for (var i = 0; i < toInt(enc.enc_time, 1); i++) secret = md5(secret + enc.key);
    var auth = md5(secret + enc.key + salt);
    var base = 'enc_data=' + encodeURIComponent(enc.enc_data) +
      '&tt=' + ts + '&did=' + this.DID + '&auth=' + auth +
      '&hevc=0&fa=0&ive=0&ver=Douyu_new&iar=0';

    var lastErr = '';
    // 先用首选线路的原画；失败再依次降清晰度；全部失败才换兜底线路
    for (var c = 0; c < this.CDN_SEQ.length; c++) {
      var cdn = this.CDN_SEQ[c];
      var rates = c === 0 ? this.RATE_SEQ : [0];
      for (var k = 0; k < rates.length; k++) {
        var form = base + '&cdn=' + encodeURIComponent(cdn) + '&rate=' + rates[k];
        var d;
        try {
          d = await httpPostForm(
            'https://www.douyu.com/lapi/live/getH5PlayV1/' + rid, form, this.baseHeaders()
          );
        } catch (e) {
          lastErr = esc(e && e.message) || '网络错误';
          continue;
        }
        if (toInt(d.error) !== 0) { lastErr = esc(d.msg) || '获取失败'; continue; }
        var dd = d.data || {};
        var url = (dd.rtmp_url || '') + '/' + (dd.rtmp_live || '');
        if (!url) { lastErr = '无播放地址'; continue; }
        // 源站自身就是 IPv6 编码域名的话直接放弃这条线路
        var host = '';
        try { host = new URL(url).hostname; } catch (e) { host = ''; }
        if (host && this.isIPv6Host(host)) { lastErr = '线路为 IPv6 节点，已跳过'; continue; }
        var qName = rates[k] === 0 ? '原画' : rates[k] === 4 ? '蓝光4M' : rates[k] === 3 ? '超清' : '高清';
        return {
          title: '', anchor: '', videoUrl: toHttps(url),
          quality: qName + ' · ' + esc(dd.rtmp_cdn || cdn)
        };
      }
    }
    return {
      title: '', anchor: '', videoUrl: '',
      error: (hlsErr ? hlsErr + '｜' : '') + (lastErr ? '主站FLV:' + lastErr : '') || '获取播放地址失败'
    };
  },

  async search(keyword, page) {
    var r = await httpGet(
      'https://www.douyu.com/japi/search/api/searchShow',
      { kw: keyword, page: page },
      this.baseHeaders()
    );
    return ensureArray(r.data.data && r.data.data.relateShow).map(function (x) {
      var avatar = esc(x.avatar);
      return {
        platform: 'douyu', roomId: esc(x.rid),
        title: esc(x.roomName) || esc(x.nickName) || esc(x.nickname), anchor: esc(x.nickName) || esc(x.nickname),
        cover: douyuCover(x.roomSrc) || douyuCover(x.coverId),
        avatar: avatar.indexOf('http') === 0 ? avatar : '',
        online: toInt(x.hot || x.online || x.popularity), category: esc(x.cateName),
        link: 'https://www.douyu.com/' + esc(x.rid)
      };
    });
  }
};

/* ---------------- 抖音 ---------------- */
var douyin = {
  async ttwid() {
    var c = cacheGet('dy_ttwid');
    if (c) return c;
    var r = await httpText('https://live.douyin.com/?from_nav=1', { Referer: 'https://live.douyin.com/' });
    var cookie = pickCookie(r.headers, 'ttwid') || pickCookie(r.headers, 'UIFID_TEMP');
    if (cookie) cacheSet('dy_ttwid', cookie, 3600);
    return cookie;
  },

  async headers() {
    var cookie = dyCookie();
    if (!cookie) cookie = await this.ttwid();
    return { Referer: 'https://live.douyin.com/', Cookie: cookie };
  },

  /**
   * 跨页已见集合（推荐流无分页参数，每次随机抽样；
   * 不记已见的话第 2 页起会大量重复，宿主按 id 去重后就认为列表到底了）
   */
  loadSeen: function () {
    var o = cacheGet('dy_seen');
    return (o && typeof o === 'object') ? o : {};
  },
  saveSeen: function (seen) {
    cacheSet('dy_seen', seen, 1800);
  },

  async getRooms(page) {
    var q = 'aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN' +
      '&enter_from=link_share&cookie_enabled=true&screen_width=1980&screen_height=1080' +
      '&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=125.0.0.0' +
      '&browser_online=true&count=20&req_from=2';
    var headers = await this.headers();
    var pg = Math.max(1, toInt(page, 1));

    // 第 1 页（含下拉刷新）清空已见，重新开始
    var seen = pg === 1 ? {} : this.loadSeen();
    var rooms = [];
    var attempts = 0;
    var MAX_ATTEMPTS = 8;
    var TARGET = 15;

    while (rooms.length < TARGET && attempts < MAX_ATTEMPTS) {
      attempts++;
      var r;
      try { r = await httpGet('https://live.douyin.com/webcast/feed/?' + q, {}, headers); } catch (e) { break; }
      var list = ensureArray(r.data.data);
      for (var j = 0; j < list.length; j++) {
        var x = list[j].data;
        if (!x) continue;
        var id = esc(x.id_str);
        if (!id || seen[id]) continue;
        seen[id] = 1;
        rooms.push({
          platform: 'douyin', roomId: id, title: esc(x.title),
          anchor: esc((x.owner || {}).nickname),
          cover: esc(((x.cover || {}).url_list || [])[0]),
          online: toInt(x.user_count),
          category: esc(((x.game_data || {}).game_tag_info || {}).game_tag_name) || esc(x.category),
          link: 'https://live.douyin.com/' + id
        });
      }
    }
    this.saveSeen(seen);
    return rooms;
  },

  /** 只取 HLS 原画（FLV 会 302 跳 IPv6，播放几秒即断） */
  async getPlay(roomId) {
    var r = await httpGet(
      'https://webcast.amemv.com/webcast/room/reflow/info/',
      { type_id: 0, live_id: 1, room_id: roomId, sec_user_id: '', version_code: '99.99.99', app_id: 6383 },
      await this.headers()
    );
    var room = (r.data.data && r.data.data.room) || {};
    if (toInt(room.status) !== 2) return { title: '', anchor: '', videoUrl: '', error: '未在直播' };
    var su = room.stream_url || {};
    var hls = su.hls_pull_url_map || {};
    var hlsUrl = hls.FULL_HD1 || hls.HD1 || hls.SD1 || hls.SD2 || '';
    var hlsName = hls.FULL_HD1 ? '原画' : hls.HD1 ? '高清' : hls.SD1 ? '标清' : '流畅';
    if (hlsUrl) {
      return {
        title: esc(room.title), anchor: esc((room.owner || {}).nickname),
        videoUrl: toHttps(hlsUrl), quality: hlsName + ' · HLS'
      };
    }
    var flv = su.flv_pull_url || {};
    var flvUrl = flv.FULL_HD1 || flv.HD1 || flv.SD1 || flv.SD2 || '';
    var flvName = flv.FULL_HD1 ? '原画' : flv.HD1 ? '高清' : flv.SD1 ? '标清' : '流畅';
    return {
      title: esc(room.title), anchor: esc((room.owner || {}).nickname),
      videoUrl: toHttps(flvUrl), quality: flvName + ' · FLV'
    };
  },

  async search(keyword, page) {
    return filterRooms(await this.getRooms(page), keyword);
  }
};

var ADAPTERS = { bilibili: bili, huya: huya, douyu: douyu, douyin: douyin };

/* ============================ 过滤 / 合并 ============================ */

function filterRooms(rooms, keyword) {
  var kw = esc(keyword).toLowerCase().trim();
  if (!kw) return rooms;
  var out = [];
  for (var i = 0; i < rooms.length; i++) {
    var r = rooms[i];
    if (!r) continue;
    var hay = (esc(r.title) + ' ' + esc(r.anchor) + ' ' + esc(r.category)).toLowerCase();
    if (hay.indexOf(kw) >= 0) out.push(r);
  }
  return out;
}

function dedupeById(rooms) {
  var seen = {}, out = [];
  for (var i = 0; i < rooms.length; i++) {
    var r = rooms[i];
    if (!r || !r.roomId) continue;
    var key = r.platform + ':' + r.roomId;
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(r);
  }
  return out;
}

function sortByOnline(rooms) {
  return rooms.slice().sort(function (a, b) { return toInt(b.online) - toInt(a.online); });
}

/* ============================ 条目映射（Streama 字段） ============================ */

function mapRoom(r) {
  if (!r) return null;
  var platform = esc(r.platform);
  var roomId = esc(r.roomId);
  if (!roomId) return null;
  var online = toInt(r.online, 0);
  var onlineText = online >= 10000 ? (online / 10000).toFixed(1) + '万' : String(online);
  var pfName = PLATFORM_NAMES[platform] || platform;
  var anchor = esc(r.anchor);
  var cat = esc(r.category);
  return {
    id: platform + ':' + roomId,
    type: 'url',
    title: esc(r.title) || anchor || '直播间',
    mediaType: 'movie',
    link: 'live://' + platform + '/' + roomId,
    posterPath: esc(r.cover),
    backdropPath: esc(r.cover),
    coverUrl: esc(r.cover),
    // 主播名放副标题位（标题下方）
    subTitle: anchor,
    description: pfName + (cat ? ' · ' + cat : '') + ' · 在线 ' + onlineText,
    genreTitle: pfName + (cat ? ' · ' + cat : ''),
    genreItems: [
      { id: 'pf_' + platform, title: pfName },
      { id: 'cat_' + platform + '_' + (cat || 'hot'), title: cat || '热播' }
    ],
    peoples: anchor ? [{ id: platform + ':' + roomId, title: anchor, avatar: esc(r.avatar) || esc(r.cover), role: '主播' }] : [],
    playerType: 'app'
  };
}

function mapRooms(rooms, tag) {
  var out = [], seen = {};
  for (var i = 0; i < ensureArray(rooms).length; i++) {
    var item = mapRoom(rooms[i]);
    if (!item || seen[item.id]) continue;
    seen[item.id] = 1;
    if (tag) item.description = tag + ' · ' + item.description;
    out.push(item);
  }
  return out;
}

/* ============================ 模块定义 ============================ */

var BASE_MODULES = [
  {
    id: 'follows', title: '⭐ 我的关注', type: 'video', functionName: 'loadFollows',
    description: 'B站关注的主播（需填 Cookie）+ 本组件收藏，跨平台聚合',
    cacheDuration: 60, timeoutSeconds: 40, retryCount: 1,
    params: [
      { name: 'cookieBilibili', title: 'B站 Cookie', type: 'string', value: '',
        description: '填 SESSDATA 可看原画并读取关注主播' },
      { name: 'cookieDouyin', title: '抖音 Cookie', type: 'string', value: '',
        description: '登录抖音直播页后复制完整 Cookie' },
      { name: 'cookieDouyu', title: '斗鱼 Cookie', type: 'string', value: '',
        description: '登录斗鱼后复制完整 Cookie（dy_auth），可提升画质' },
      { name: 'cookieHuya', title: '虎牙 Cookie', type: 'string', value: '',
        description: '登录虎牙后复制完整 Cookie' }
    ]
  },
  {
    id: 'bilibili', title: '📺 B站直播', type: 'video', functionName: 'loadBilibili',
    description: '哔哩哔哩在播直播间',
    cacheDuration: 60, timeoutSeconds: 40, retryCount: 2,
    params: [
      { name: 'category', title: '分区', type: 'string', value: '2:0',
        description: '格式 父分区:子分区，如 2:0 网游、3:0 手游、1:0 娱乐' },
      { name: 'page', title: '页码', type: 'page', value: '1', startPage: 1 },
      { name: 'cookieBilibili', title: 'B站 Cookie', type: 'string', value: '',
        description: '填 SESSDATA 解锁原画' }
    ]
  },
  {
    id: 'douyin', title: '📺 抖音直播', type: 'video', functionName: 'loadDouyin',
    description: '抖音在播直播间（推荐流）',
    cacheDuration: 60, timeoutSeconds: 45, retryCount: 2,
    params: [
      { name: 'page', title: '页码', type: 'page', value: '1', startPage: 1 },
      { name: 'cookieDouyin', title: '抖音 Cookie', type: 'string', value: '',
        description: '可选。登录后复制完整 Cookie' }
    ]
  },
  {
    id: 'douyu', title: '📺 斗鱼直播', type: 'video', functionName: 'loadDouyu',
    description: '斗鱼在播直播间',
    cacheDuration: 60, timeoutSeconds: 40, retryCount: 2,
    params: [
      { name: 'category', title: '分类', type: 'string', value: '1',
        description: '二级分类 ID，如 1 英雄联盟、181 王者荣耀、2 炉石传说' },
      { name: 'page', title: '页码', type: 'page', value: '1', startPage: 1 },
      { name: 'cookieDouyu', title: '斗鱼 Cookie', type: 'string', value: '',
        description: '登录斗鱼后复制完整 Cookie（dy_auth），可提升画质并降低限流' }
    ]
  },
  {
    id: 'huya', title: '📺 虎牙直播', type: 'video', functionName: 'loadHuya',
    description: '虎牙在播直播间',
    cacheDuration: 60, timeoutSeconds: 40, retryCount: 2,
    params: [
      { name: 'category', title: '分类', type: 'string', value: '1',
        description: '游戏分类 ID，如 1 英雄联盟、2336 王者荣耀、393 炉石传说' },
      { name: 'page', title: '页码', type: 'page', value: '1', startPage: 1 },
      { name: 'cookieHuya', title: '虎牙 Cookie', type: 'string', value: '',
        description: '登录虎牙后复制完整 Cookie' }
    ]
  },
  {
    id: 'stream', title: '播放源', type: 'stream', functionName: 'loadStreams',
    description: '直播间播放源解析（资源匹配与兜底用）',
    cacheDuration: 0, timeoutSeconds: 30, retryCount: 1,
    params: []
  }
];

var GAME_MODULES = [];
for (var gi = 0; gi < GAME_LIST.length; gi++) {
  (function (g) {
    GAME_MODULES.push({
      id: 'game_' + g.key,
      title: '🎮 ' + g.name,
      type: 'video',
      functionName: 'loadGame',
      description: g.name + ' · 跨平台分区聚合',
      cacheDuration: 60, timeoutSeconds: 50, retryCount: 2,
      params: [
        { name: 'gameKey', title: '游戏', type: 'constant', value: g.key, description: g.name },
        { name: 'page', title: '页码', type: 'page', value: '1', startPage: 1 }
      ]
    });
  })(GAME_LIST[gi]);
}

var ALL_MODULES = BASE_MODULES.concat(GAME_MODULES);

var WIDGET_VERSION = '1.3.0';

var WidgetMetadata = {
  id: 'streama.live.aggregator',
  // 标题带版本号，方便确认 App 里装的是哪一版
  title: '全平台直播聚合 v' + WIDGET_VERSION,
  description: '聚合 B站/斗鱼/虎牙/抖音：⭐我的关注、📺四平台、🎮34 个游戏分区跨平台聚合。标题下方显示主播名与在线人数，点击即播最高清晰度。无需本地服务。',
  author: 'live-aggregator',
  site: 'https://live.bilibili.com',
  version: WIDGET_VERSION,
  requiredVersion: '1.0.0',
  detailCacheDuration: 60,
  modules: ALL_MODULES,
  search: {
    title: '搜索主播',
    functionName: 'searchCatalog',
    params: [{ name: 'keyword', title: '关键词', type: 'string', value: '' }]
  }
};

/* ============================ 列表模块 ============================ */

async function loadFollows(params) {
  params = params || {};
  saveCookies(params);
  var rooms = [];
  try {
    var f = await bili.getFollows(1);
    rooms = rooms.concat(ensureArray(f.rooms));
  } catch (e) {
    console.warn('loadFollows: B站关注失败 ' + (e && e.message));
  }
  try {
    var fav = Widget.storage.get('live_favorites', '');
    if (fav) rooms = rooms.concat(JSON.parse(fav));
  } catch (e) {}
  return mapRooms(sortByOnline(rooms), '关注');
}

async function loadBilibili(params) {
  params = params || {};
  saveCookies(params);
  var page = Math.max(1, toInt(params.page, 1));
  return mapRooms(await bili.getRooms(params.category, page));
}

async function loadDouyin(params) {
  params = params || {};
  saveCookies(params);
  var page = Math.max(1, toInt(params.page, 1));
  return mapRooms(await douyin.getRooms(page));
}

async function loadDouyu(params) {
  params = params || {};
  saveCookies(params);
  var page = Math.max(1, toInt(params.page, 1));
  return mapRooms(await douyu.getRooms(params.category, page));
}

async function loadHuya(params) {
  params = params || {};
  saveCookies(params);
  var page = Math.max(1, toInt(params.page, 1));
  return mapRooms(await huya.getRooms(params.category, page));
}

function findGame(key) {
  for (var i = 0; i < GAME_LIST.length; i++) if (GAME_LIST[i].key === key) return GAME_LIST[i];
  return null;
}

/* 游戏分区里各平台的展示顺序（用户指定：抖音 → B站 → 虎牙 → 斗鱼） */
var GAME_PLATFORM_SEQ = ['douyin', 'bilibili', 'huya', 'douyu'];
/* 每页每个平台各取多少条：保证一页内就能看到全部平台 */
var GAME_PER_PLATFORM = 15;

async function loadGame(params) {
  params = params || {};
  var g = findGame(esc(params.gameKey));
  if (!g) throw new Error('loadGame: 未知游戏 key ' + esc(params.gameKey));
  var page = Math.max(1, toInt(params.page, 1));

  // 各平台固定分类 ID 拉取（抖音无固定分区，用推荐流按游戏名过滤补充）
  var tasks = [];
  var seq = [];
  if (g.douyu) { tasks.push(douyu.getRooms(g.douyu, 1)); seq.push('douyu'); }
  if (g.huya) { tasks.push(huya.getRooms(g.huya, 1)); seq.push('huya'); }
  if (g.biliArea) { tasks.push(bili.getRooms(g.biliParent + ':' + g.biliArea, 1)); seq.push('bilibili'); }
  tasks.push(
    Promise.resolve(douyin.getRooms(1)).then(function (rs) { return filterRooms(rs, g.name); })
      .catch(function () { return []; })
  );
  seq.push('douyin');

  var results = await Promise.all(tasks.map(function (t) {
    return Promise.resolve(t).catch(function (e) { console.warn('loadGame: 聚合失败 ' + (e && e.message)); return []; });
  }));

  // 按平台分组，组内按在线人数排序
  var byPlatform = {};
  for (var i = 0; i < results.length; i++) {
    var list = dedupeById(results[i]);
    for (var j = 0; j < list.length; j++) {
      var pf = list[j].platform;
      if (!byPlatform[pf]) byPlatform[pf] = [];
      byPlatform[pf].push(list[j]);
    }
  }
  for (var k in byPlatform) byPlatform[k] = sortByOnline(byPlatform[k]);

  // 分页：每页每个平台各取 GAME_PER_PLATFORM 条，按 GAME_PLATFORM_SEQ 顺序拼接
  // → 一页里就能看到全部平台，翻页继续往下取
  var out = [];
  var start = (page - 1) * GAME_PER_PLATFORM;
  var end = start + GAME_PER_PLATFORM;
  for (var s = 0; s < GAME_PLATFORM_SEQ.length; s++) {
    var pfList = byPlatform[GAME_PLATFORM_SEQ[s]] || [];
    out = out.concat(pfList.slice(start, end));
  }
  console.log('loadGame: ' + g.name + ' 第' + page + '页 各平台 ' +
    GAME_PLATFORM_SEQ.map(function (p) { return p + ':' + (byPlatform[p] || []).length; }).join(' '));
  return mapRooms(out);
}

/* ============================ 搜索 ============================ */

async function searchCatalog(params) {
  params = params || {};
  var page = Math.max(1, toInt(params.page, 1));
  var keyword = esc(params.keyword || params.query || params.wd || params.search).trim();
  if (!keyword) return [];
  var results = await Promise.all(
    ['bilibili', 'huya', 'douyu', 'douyin'].map(function (pf) {
      return Promise.resolve(ADAPTERS[pf].search(keyword, page))
        .catch(function (e) { console.warn('searchCatalog: ' + pf + ' 失败 ' + (e && e.message)); return []; });
    })
  );
  var rooms = [];
  for (var i = 0; i < results.length; i++) rooms = rooms.concat(results[i]);
  return mapRooms(sortByOnline(dedupeById(rooms)));
}

/* ============================ 播放地址解析 ============================ */

function parseLiveLink(link) {
  var m = /^live:\/\/([a-z]+)\/(.+)$/.exec(esc(link));
  if (!m) return null;
  return { platform: m[1], roomId: decodeURIComponent(m[2]) };
}

/** 现取播放地址（签名地址有时效，不能缓存） */
async function resolvePlay(platform, roomId) {
  var ad = ADAPTERS[platform];
  if (!ad) throw new Error('loadDetail: 未知平台 ' + esc(platform));
  var d = await ad.getPlay(roomId);
  if (!d.videoUrl) {
    var e = new Error('resolvePlay: ' + (esc(d.error) || '当前未在直播'));
    e.business = true;
    throw e;
  }
  return d;
}

/* ============================ 详情 ============================ */

async function loadDetail(link, extraParams) {
  var parsed = parseLiveLink(link);
  if (!parsed) throw new Error('loadDetail: 无法解析链接 ' + esc(link).slice(0, 60));
  var platform = parsed.platform;
  var roomId = parsed.roomId;
  var headers = playHeaders(platform);
  var pfName = PLATFORM_NAMES[platform] || platform;

  var d = null;
  try {
    d = await resolvePlay(platform, roomId);
  } catch (e) {
    // 取流失败不抛硬错误：返回带提示的详情对象，避免整个详情页加载失败
    console.warn('loadDetail: 取流失败 ' + platform + '/' + roomId + ' ' + (e && e.message));
    return {
      id: platform + ':' + roomId,
      type: 'url',
      title: '直播间 ' + roomId,
      mediaType: 'movie',
      link: link,
      subTitle: '',
      description: pfName + ' · ' + (esc(e && e.message) || '播放地址获取失败'),
      videoUrl: '',
      headers: headers,
      playerType: 'app',
      genreTitle: pfName
    };
  }

  var title = esc(d.title) || ('直播间 ' + roomId);
  if (esc(d.anchor)) title = title + ' · ' + esc(d.anchor);
  var qText = esc(d.quality) ? '清晰度：' + esc(d.quality) : '';

  // 电影详情直接带 videoUrl + headers，跳过播放源解析；
  // 同时给一条 childItems 备用线路（Streama 详情页不识别 playSources）
  return {
    id: platform + ':' + roomId,
    type: 'url',
    title: title,
    mediaType: 'movie',
    link: 'live://' + platform + '/' + roomId,
    subTitle: esc(d.anchor),
    description: qText,
    videoUrl: d.videoUrl,
    headers: headers,
    playerType: 'app',
    genreTitle: pfName,
    childItems: [
      {
        id: platform + ':' + roomId + ':main',
        type: 'url',
        title: esc(d.quality) || '默认线路',
        mediaType: 'movie',
        videoUrl: d.videoUrl,
        headers: headers
      }
    ]
  };
}

/* ============================ 播放源模块 ============================ */
/* 详情页已带 videoUrl 时宿主不会走这里；此模块主要用于资源匹配与兜底 */

function detectPlatform(url) {
  var u = esc(url);
  if (u.indexOf('bilivideo') >= 0 || u.indexOf('bilibili') >= 0) return 'bilibili';
  if (u.indexOf('douyucdn') >= 0 || u.indexOf('douyu') >= 0) return 'douyu';
  if (u.indexOf('huya') >= 0) return 'huya';
  if (u.indexOf('douyincdn') >= 0 || u.indexOf('douyin') >= 0) return 'douyin';
  return '';
}

async function loadStreams(params, context) {
  params = params || {};
  var videoUrl = esc(params.videoUrl);

  // 详情已解析出地址（最常见路径）：直接返回，不再重复请求，详情页秒开
  if (videoUrl) {
    var pf0 = detectPlatform(videoUrl);
    return [{
      name: (PLATFORM_NAMES[pf0] || '直播') + ' 线路',
      description: '详情地址',
      url: videoUrl,
      headers: playHeaders(pf0)
    }];
  }

  var link = esc(params.link);
  var platform = '';
  var roomId = '';
  if (link) {
    var parsed = parseLiveLink(link);
    if (parsed) { platform = parsed.platform; roomId = parsed.roomId; }
  }

  if (!platform || !roomId) {
    // 无法识别为直播间上下文（如组件测试用 tmdbId=550）
    return [];
  }

  var d;
  try {
    d = await resolvePlay(platform, roomId);
  } catch (e) {
    if (e && e.business) return [];
    // 网络类失败也返回空数组，避免拖垮详情页
    console.warn('loadStreams: 取流失败 ' + (e && e.message));
    return [];
  }

  return [{
    name: esc(d.quality) || (PLATFORM_NAMES[platform] + ' 直播'),
    description: PLATFORM_NAMES[platform] || platform,
    url: d.videoUrl,
    headers: playHeaders(platform)
  }];
}
