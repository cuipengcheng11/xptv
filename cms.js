WidgetMetadata = {
  id: "forward.cms.xptv-merged",
  title: "CMS合集（xptv去重）",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "两份 xptv 配置里的苹果CMS源集合去重后共 27 个（第一份 24 个 + 第二份 15 个，去掉 12 个重复；type=3 的蜘蛛源和 type=0 的 XML 源不在 CMS 协议内，已排除）。在模块设置里选源，最新/分类/搜索都走当前选的源；详情链接里自带源序号，换源后旧详情仍能打开。2026-10-30 实测 25 个可用，2 个暂不可用（无尽资源断连、非凡 ffzy.tv 403，排在最后）。源站域名经常变，某个源失效就换下一个。",
  author: "Forward",
  site: "https://github.com/InchStudio/ForwardWidgets",
  detailCacheDuration: 60,
  globalParams: [
    {
      name: "source",
      title: "源站（27个，选一个）",
      type: "enumeration",
      value: "https://360zy.com/api.php/provide/vod",
      enumOptions: [
        { title: "360资源", value: "https://360zy.com/api.php/provide/vod" },
        { title: "量子资源", value: "http://cj.lziapi.com/api.php/provide/vod" },
        { title: "非凡资源", value: "http://cj.ffzyapi.com/api.php/provide/vod" },
        { title: "暴风资源", value: "https://bfzyapi.com/api.php/provide/vod" },
        { title: "光速资源", value: "https://api.guangsuapi.com/api.php/provide/vod" },
        { title: "红牛资源", value: "https://www.hongniuzy2.com/api.php/provide/vod" },
        { title: "极速资源", value: "https://jszyapi.com/api.php/provide/vod" },
        { title: "豪华资源", value: "https://hhzyapi.com/api.php/provide/vod" },
        { title: "索尼资源", value: "https://suoniapi.com/api.php/provide/vod" },
        { title: "魔都资源", value: "https://caiji.moduapi.cc/api.php/provide/vod" },
        { title: "百度资源", value: "https://api.apibdzy.com/api.php/provide/vod" },
        { title: "电影天堂资源", value: "http://caiji.dyttzyapi.com/api.php/provide/vod" },
        { title: "墨斗", value: "https://www.mdzyapi.com/api.php/provide/vod" },
        { title: "金鹰", value: "https://jinyingzy.com/api.php/provide/vod" },
        { title: "牛牛", value: "https://api.niuniuzy.me/api.php/provide/vod" },
        { title: "丫丫", value: "https://cj.yayazy.net/api.php/provide/vod" },
        { title: "闪电", value: "http://sdzyapi.com/api.php/provide/vod" },
        { title: "樱花", value: "https://m3u8.apiyhzy.com/api.php/provide/vod" },
        { title: "虎牙", value: "https://www.huyaapi.com/api.php/provide/vod" },
        { title: "飘零", value: "https://p2100.net/api.php/provide/vod" },
        { title: "速博", value: "https://subocaiji.com/api.php/provide/vod" },
        { title: "最大", value: "http://zuidazy.me/api.php/provide/vod" },
        { title: "新浪", value: "https://api.xinlangapi.com/xinlangapi.php/provide/vod" },
        { title: "天涯", value: "http://tyyszy.com/api.php/provide/vod" },
        { title: "建安", value: "http://154.219.117.232:9981/jacloudapi.php/provide/vod" },
        { title: "无尽资源(暂不可用)", value: "https://api.wujinapi.com/api.php/provide/vod" },
        { title: "非凡·ffzy.tv(暂不可用)", value: "http://ffzy.tv/api.php/provide/vod" },
      ],
    },
  ],
  modules: [
    {
      id: "loadLatest",
      title: "最新",
      functionName: "loadLatest",
      cacheDuration: 300,
      requiresWebView: false,
      params: [
        { name: "page", title: "页码", type: "page" },
      ],
    },
    {
      id: "loadCategory",
      title: "分类",
      functionName: "loadCategory",
      cacheDuration: 300,
      requiresWebView: false,
      params: [
        {
          name: "type_id",
          title: "分类ID（留空=全部；各站ID不同，点详情页分类可自动带入）",
          type: "input",
          placeholders: [{ title: "例如：6", value: "" }],
        },
        { name: "page", title: "页码", type: "page" },
      ],
    },
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      requiresWebView: false,
      params: [],
    },
  ],
  search: {
    title: "搜索",
    functionName: "searchCms",
    params: [
      { name: "keyword", title: "关键词", type: "input" },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

// 源序号 -> API 地址（与上面 enumOptions 顺序一致；详情链接用序号，不用整条 URL，避免 :// 破坏链接解析）
var CMS_SOURCES = ["https://360zy.com/api.php/provide/vod", "http://cj.lziapi.com/api.php/provide/vod", "http://cj.ffzyapi.com/api.php/provide/vod", "https://bfzyapi.com/api.php/provide/vod", "https://api.guangsuapi.com/api.php/provide/vod", "https://www.hongniuzy2.com/api.php/provide/vod", "https://jszyapi.com/api.php/provide/vod", "https://hhzyapi.com/api.php/provide/vod", "https://suoniapi.com/api.php/provide/vod", "https://caiji.moduapi.cc/api.php/provide/vod", "https://api.apibdzy.com/api.php/provide/vod", "http://caiji.dyttzyapi.com/api.php/provide/vod", "https://www.mdzyapi.com/api.php/provide/vod", "https://jinyingzy.com/api.php/provide/vod", "https://api.niuniuzy.me/api.php/provide/vod", "https://cj.yayazy.net/api.php/provide/vod", "http://sdzyapi.com/api.php/provide/vod", "https://m3u8.apiyhzy.com/api.php/provide/vod", "https://www.huyaapi.com/api.php/provide/vod", "https://p2100.net/api.php/provide/vod", "https://subocaiji.com/api.php/provide/vod", "http://zuidazy.me/api.php/provide/vod", "https://api.xinlangapi.com/xinlangapi.php/provide/vod", "http://tyyszy.com/api.php/provide/vod", "http://154.219.117.232:9981/jacloudapi.php/provide/vod", "https://api.wujinapi.com/api.php/provide/vod", "http://ffzy.tv/api.php/provide/vod"];
var CMS_DEFAULT = "https://360zy.com/api.php/provide/vod";

function cmsBase(params) {
  var s = (params && params.source) || CMS_DEFAULT;
  return String(s).replace(/\/+$/, "");
}

function cmsApiUrl(base, query) {
  var parts = [];
  for (var k in query) {
    if (query[k] !== undefined && query[k] !== null && query[k] !== "") {
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(query[k])));
    }
  }
  return base + "?" + parts.join("&");
}

async function cmsGet(base, query) {
  var res = await Widget.http.get(cmsApiUrl(base, query));
  var data = res && res.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { throw new Error("CMS 返回不是 JSON"); }
  }
  if (!data || !Array.isArray(data.list)) throw new Error("CMS 空响应");
  return data;
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

function mediaTypeOf(v) {
  var t = String(v.type_name || "");
  if (/剧|动漫|综艺/.test(t)) return "tv";
  return "movie";
}

function sourceIndexOf(base) {
  for (var i = 0; i < CMS_SOURCES.length; i++) {
    if (CMS_SOURCES[i].replace(/\/+$/, "") === String(base).replace(/\/+$/, "")) return i;
  }
  return 0;
}

function toItem(v, base) {
  var idx = sourceIndexOf(base);
  var remarks = v.vod_remarks ? "（" + v.vod_remarks + "）" : "";
  return {
    id: "cmsx:" + idx + ":" + v.vod_id,
    type: "url",
    mediaType: mediaTypeOf(v),
    title: v.vod_name,
    posterPath: v.vod_pic || "",
    backdropPath: v.vod_pic || "",
    description: (v.type_name || "") + remarks,
    link: "cmsx:" + idx + ":" + v.vod_id,
  };
}

async function loadLatest(params) {
  params = params || {};
  var base = cmsBase(params);
  var page = Number(params.page || 1);
  var t = params.genreId || "";
  var data = await cmsGet(base, { ac: "videolist", t: t, pg: page });
  return data.list.map(function (v) { return toItem(v, base); });
}

async function loadCategory(params) {
  params = params || {};
  var base = cmsBase(params);
  var page = Number(params.page || 1);
  var t = params.genreId || params.type_id || "";
  var data = await cmsGet(base, { ac: "videolist", t: t, pg: page });
  return data.list.map(function (v) { return toItem(v, base); });
}

async function searchCms(params) {
  params = params || {};
  var kw = String(params.keyword || "").trim();
  if (!kw) return [];
  var base = cmsBase(params);
  var page = Number(params.page || 1);
  var data = await cmsGet(base, { ac: "videolist", wd: kw, pg: page });
  return data.list.map(function (v) { return toItem(v, base); });
}

function parsePlayGroups(v) {
  var froms = String(v.vod_play_from || "").split("$$$");
  var urlGroups = String(v.vod_play_url || "").split("$$$");
  var groups = [];
  for (var i = 0; i < urlGroups.length; i++) {
    var eps = [];
    var parts = urlGroups[i].split("#");
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j];
      if (!p) continue;
      var idx = p.indexOf("$");
      if (idx < 0) continue;
      var name = p.slice(0, idx).trim() || ("第" + (j + 1) + "集");
      var url = p.slice(idx + 1).trim();
      if (url) eps.push({ name: name, url: url });
    }
    if (eps.length) groups.push({ from: froms[i] || ("线路" + (i + 1)), episodes: eps });
  }
  return groups;
}

function pickGroup(groups) {
  if (!groups.length) return null;
  var best = groups[0];
  var bestScore = 0;
  for (var i = 0; i < groups.length; i++) {
    var score = 0;
    for (var j = 0; j < groups[i].episodes.length; j++) {
      if (groups[i].episodes[j].url.indexOf(".m3u8") >= 0) score++;
    }
    if (score > bestScore) { bestScore = score; best = groups[i]; }
  }
  return best;
}

async function fetchDetailVod(base, vodId) {
  var data = await cmsGet(base, { ac: "detail", ids: vodId });
  return data.list[0] || null;
}

function parseCmsxLink(link) {
  var m = String(link || "").match(/^cmsx:(\d+):(\d+)(?::(\d+))?/);
  if (!m) return null;
  var idx = Number(m[1]);
  return { base: (CMS_SOURCES[idx] || CMS_DEFAULT).replace(/\/+$/, ""), idx: idx, vodId: m[2], epIdx: m[3] !== undefined ? Number(m[3]) : 0 };
}

async function loadDetail(link) {
  var p = parseCmsxLink(link);
  if (!p) return null;
  var v = await fetchDetailVod(p.base, p.vodId);
  if (!v) return null;
  var groups = parsePlayGroups(v);
  var group = pickGroup(groups);
  var episodeItems = [];
  if (group) {
    for (var i = 0; i < group.episodes.length; i++) {
      var ep = group.episodes[i];
      episodeItems.push({
        id: "cmsx:" + p.idx + ":" + p.vodId + ":" + i,
        type: "url",
        title: ep.name,
        videoUrl: ep.url,
        link: "cmsx:" + p.idx + ":" + p.vodId + ":" + i,
      });
    }
  }
  var descParts = [];
  if (v.vod_year) descParts.push(v.vod_year + "年");
  if (v.vod_area) descParts.push(v.vod_area);
  if (v.vod_director) descParts.push("导演：" + v.vod_director);
  if (v.vod_actor) descParts.push("主演：" + v.vod_actor);
  var content = stripHtml(v.vod_content);
  if (content) descParts.push(content);
  return {
    id: "cmsx:" + p.idx + ":" + p.vodId,
    type: "url",
    mediaType: mediaTypeOf(v),
    title: v.vod_name,
    posterPath: v.vod_pic || "",
    backdropPath: v.vod_pic || "",
    description: descParts.join("\n"),
    releaseDate: v.vod_year ? String(v.vod_year) : "",
    genreItems: v.type_id ? [{ id: String(v.type_id), title: v.type_name || "" }] : [],
    videoUrl: episodeItems.length ? episodeItems[0].videoUrl : "",
    episodeItems: episodeItems,
    link: "cmsx:" + p.idx + ":" + p.vodId,
  };
}

async function loadResource(params) {
  params = params || {};
  var p = parseCmsxLink(params.link || params.id || "");
  if (!p) return [];
  var v = await fetchDetailVod(p.base, p.vodId);
  if (!v) return [];
  var group = pickGroup(parsePlayGroups(v));
  if (!group || !group.episodes[p.epIdx]) return [];
  var ep = group.episodes[p.epIdx];
  return [{
    name: group.from + " · " + ep.name,
    description: v.vod_name + " " + ep.name,
    url: ep.url,
    playerType: "system",
  }];
}
