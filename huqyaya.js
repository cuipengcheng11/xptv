WidgetMetadata = {
  id: "forward.huya-live",
  title: "虎牙直播",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  description: "虎牙直播：热门列表直接用虎牙公开列表接口（不用登录、不用填 ID），点开现解析拉流地址。带直播线路和清晰度选择：默认线路=自动，自动时会按 TX、AL、HS、HS24、HW、AL13、TX15 的顺序逐条试，不只看 m3u8 有没有返回，还会去拿第一个 TS 片段，能下载到才算这条线路可用，拿不到就换下一条；手动选某条线路时也会在该线路不可用时兜底换线路。清晰度用虎牙转码流实现：流畅=_500、超清=_2000、蓝光4M=_4000、蓝光10M=_10000，接在流名后面（实测 660000 间这四档都返回可用 m3u8），转码档拿不到时自动回落原画。默认自动 + 流畅（最不卡）：虎牙 HLS 一次只给约 3 个片段、约 6 秒缓冲，原画 10M 在网络一般时跟不上就会几秒后黑屏转圈。拉流地址带有时效签名，每次点开都会重新解析，不要保存旧地址。",
  author: "Forward",
  site: "https://github.com/InchStudio/ForwardWidgets",
  modules: [
    {
      id: "loadLiveRooms",
      title: "虎牙热门直播",
      functionName: "loadLiveRooms",
      cacheDuration: 60,
      requiresWebView: false,
      params: [
        {
          name: "roomIds",
          title: "指定直播间（可选，留空=热门列表）",
          type: "input",
          placeholders: [{ title: "例如：660000, 11342412（逗号分隔，也可填 huya.com/660000 链接）", value: "" }],
        },
        {
          name: "page",
          title: "页码",
          type: "page",
        },
        {
          name: "line",
          title: "直播线路",
          type: "enumeration",
          value: "auto",
          enumOptions: [
            { title: "自动（按顺序试到能播为止）", value: "auto" },
            { title: "TX（腾讯云）", value: "TX" },
            { title: "AL（阿里云）", value: "AL" },
            { title: "HS（华为云）", value: "HS" },
            { title: "HS24", value: "HS24" },
            { title: "HW", value: "HW" },
            { title: "AL13", value: "AL13" },
            { title: "TX15", value: "TX15" },
          ],
        },
        {
          name: "quality",
          title: "清晰度（卡就选流畅）",
          type: "enumeration",
          value: "流畅",
          enumOptions: [
            { title: "原画（最高码率）", value: "auto" },
            { title: "蓝光10M", value: "蓝光10M" },
            { title: "蓝光4M", value: "蓝光4M" },
            { title: "超清", value: "超清" },
            { title: "流畅", value: "流畅" },
          ],
        },
      ],
    },
  ],
};

var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// 清晰度档位 -> 目标码率（kbps），与虎牙 vMultiStreamInfo 的 sDisplayName 对应
var QUALITY_BITRATE = {
  "蓝光10M": 10000,
  "蓝光4M": 4000,
  "超清": 2000,
  "流畅": 500,
};
// 自动线路的尝试顺序：实测海外网络下 TX 能播、AL 常 403，国内一般 AL/TX 都能播，
// 所以自动模式先试 TX，再依次试其他线路，直到拿到可用的 m3u8。
var LINE_ORDER = ["TX", "AL", "HS", "HS24", "HW", "AL13", "TX15"];

function toHttps(url) {
  return String(url || "").replace(/^http:\/\//, "https://");
}

function parseRoomId(input) {
  var s = String(input || "").trim();
  if (!s) return "";
  var m = s.match(/huya\.com\/(\d+)/);
  if (m) return m[1];
  var digits = s.match(/\d+/);
  return digits ? digits[0] : s;
}

function makeLink(roomId, line, quality) {
  return "huya:" + roomId + ":" + (line || "auto") + ":" + (quality || "auto");
}

function parseLink(link) {
  var parts = String(link || "").split(":");
  // huya:660000:TX:超清
  return {
    roomId: parseRoomId(parts[1] || ""),
    line: parts[2] || "auto",
    quality: parts[3] || "auto",
  };
}

// 从房间页 JSON 里抽出全部线路：每条 = { cdn, streamName, hlsUrl, hlsSuffix, hlsAnti }
function extractLines(html) {
  var text = typeof html === "string" ? html : JSON.stringify(html || "");
  var lines = [];
  var re = /\{"sCdnType":"([^"]+)".*?"sStreamName":"([^"]+)","sFlvUrl":"([^"]+)","sFlvUrlSuffix":"([^"]+)","sFlvAntiCode":"([^"]+)","sHlsUrl":"([^"]+)","sHlsUrlSuffix":"([^"]+)","sHlsAntiCode":"([^"]+)"/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    lines.push({
      cdn: m[1],
      streamName: m[2],
      flvUrl: toHttps(m[3]) + "/" + m[2] + "." + m[4] + "?" + m[5],
      hlsUrl: toHttps(m[6]) + "/" + m[2] + "." + m[7] + "?" + m[8],
    });
  }
  return lines;
}

// 房间提供的清晰度档位：vMultiStreamInfo 里的 sDisplayName + iBitRate
function extractQualities(html) {
  var text = typeof html === "string" ? html : JSON.stringify(html || "");
  var out = [];
  var re = /"sDisplayName":"([^"]+)","iBitRate":(\d+)/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], bitrate: Number(m[2]) || 0 });
  }
  return out;
}

function extractRoomMeta(html) {
  var text = typeof html === "string" ? html : JSON.stringify(html || "");
  var meta = {};
  var nick = text.match(/"nick":"([^"]+)"/);
  var roomName = text.match(/"roomName":"([^"]+)"/);
  var game = text.match(/"gameFullName":"([^"]+)"/);
  var shot = text.match(/"screenshot":"(https?:[^"]+)"/);
  if (nick) meta.nick = nick[1];
  if (roomName) meta.roomName = roomName[1];
  if (game) meta.game = game[1];
  if (shot) meta.posterPath = shot[1].replace(/\\\//g, "/");
  return meta;
}

// 主播放列表里挑分流：返回最接近目标码率（不超过目标，取其中最高；没有不超过的取最低）
function pickVariant(masterText, masterUrl, targetKbps) {
  if (!targetKbps) return "";
  var lines = String(masterText).split("\n");
  var variants = [];
  for (var i = 0; i < lines.length; i++) {
    var bw = lines[i].match(/BANDWIDTH=(\d+)/);
    if (bw && lines[i + 1] && lines[i + 1].trim() && lines[i + 1].indexOf("#") !== 0) {
      variants.push({ bandwidth: Number(bw[1]), url: lines[i + 1].trim() });
    }
  }
  if (!variants.length) return "";
  var target = targetKbps * 1000;
  var below = variants.filter(function (v) { return v.bandwidth <= target; });
  var chosen = below.length
    ? below.sort(function (a, b) { return b.bandwidth - a.bandwidth; })[0]
    : variants.sort(function (a, b) { return a.bandwidth - b.bandwidth; })[0];
  var u = chosen.url;
  if (u.indexOf("http") === 0) return u;
  if (u.indexOf("/") === 0) {
    var origin = masterUrl.match(/^(https?:\/\/[^\/]+)/);
    return (origin ? origin[1] : "") + u;
  }
  var base = masterUrl.split("?")[0];
  return base.slice(0, base.lastIndexOf("/") + 1) + u;
}

async function tryHlsUrl(url) {
  // 只用来判断这个地址能不能播：拿到 #EXTM3U 才算可用，否则换下一条线路/回落原画
  try {
    var res = await Widget.http.get(url, {
      headers: { "User-Agent": UA, Referer: "https://www.huya.com/" },
    });
    var text = typeof res.data === "string" ? res.data : JSON.stringify(res.data || "");
    if (text.indexOf("#EXTM3U") !== -1) {
      return { ok: true, text: text };
    }
    return { ok: false, text: text };
  } catch (e) {
    return { ok: false, text: "" };
  }
}

async function tryLineHls(line) {
  return tryHlsUrl(line.hlsUrl);
}

// 转码流地址：原流名 + _码率，例如 ...-imgplus_2000.m3u8?wsSecret=...
function transcodeUrl(hlsUrl, kbps) {
  if (!kbps) return hlsUrl;
  return String(hlsUrl).replace(/\.m3u8\?/, "_" + kbps + ".m3u8?");
}

// 从 m3u8 里取第一个 TS 片段的完整地址（相对地址按 m3u8 所在目录解析）
function firstTsUrl(m3u8Text, hlsUrl) {
  var lines = String(m3u8Text || "").split("\n");
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t && t.indexOf("#") !== 0 && t.indexOf(".ts") !== -1) {
      if (t.indexOf("http") === 0) return t;
      if (t.indexOf("/") === 0) {
        var origin = String(hlsUrl).match(/^(https?:\/\/[^\/]+)/);
        return (origin ? origin[1] : "") + t;
      }
      var base = String(hlsUrl).split("?")[0];
      return base.slice(0, base.lastIndexOf("/") + 1) + t;
    }
  }
  return "";
}

// TS 片段能不能下载到：只判断长度，TS 是二进制，长度很小或含错误页就是不可用。
// 注意：如果运行环境不支持拉二进制，这个探测会失败，调用方会回落到只看 m3u8 的老逻辑，不会因此报错。
async function tryTsUrl(url) {
  if (!url) return false;
  try {
    var res = await Widget.http.get(url, {
      headers: { "User-Agent": UA, Referer: "https://www.huya.com/" },
    });
    var data = res && res.data;
    if (typeof data === "string") {
      return data.length > 5000 && data.indexOf("403 Forbidden") === -1 && data.indexOf("<html") !== 0;
    }
    return !!data;
  } catch (e) {
    return false;
  }
}

async function resolveStream(roomId, wantLine, wantQuality) {
  var res = await Widget.http.get("https://www.huya.com/" + roomId, {
    headers: { "User-Agent": UA, Referer: "https://www.huya.com/" },
  });
  var html = res && res.data;
  var lines = extractLines(html);
  if (!lines.length) {
    throw new Error("未解析到拉流地址：可能未开播或虎牙改了页面结构");
  }
  var qualities = extractQualities(html);
  var meta = extractRoomMeta(html);
  // 目标码率：先按房间实际档位名匹配，匹配不到用固定档位表
  var targetKbps = 0;
  if (wantQuality && wantQuality !== "auto") {
    var q = qualities.filter(function (x) { return x.name === wantQuality; })[0];
    targetKbps = q && q.bitrate ? q.bitrate : (QUALITY_BITRATE[wantQuality] || 0);
  }

  var ordered = [];
  if (wantLine && wantLine !== "auto") {
    ordered = lines.filter(function (l) { return l.cdn === wantLine; })
      .concat(lines.filter(function (l) { return l.cdn !== wantLine; }));
  } else {
    ordered = LINE_ORDER.map(function (cdn) {
      return lines.filter(function (l) { return l.cdn === cdn; })[0];
    }).filter(Boolean).concat(lines);
    // 去重（按 cdn）
    var seen = {};
    ordered = ordered.filter(function (l) {
      if (seen[l.cdn]) return false;
      seen[l.cdn] = true;
      return true;
    });
  }

  // 自动选线路：先逐条验证到真正能播的线路（m3u8 + 第一个 TS 片段都能拿到），
  // 而不是只看 m3u8 返回了 #EXTM3U 就算可用——之前只看 m3u8 时，自动可能挑到 TS 拿不到的线路，
  // 表现就是播几秒后黑屏转圈。如果所有线路的 TS 探测都不支持/都失败，就回落到老逻辑（只看 m3u8）。
  if (!wantLine || wantLine === "auto") {
    for (var vi = 0; vi < ordered.length; vi++) {
      var candUrl = targetKbps ? transcodeUrl(ordered[vi].hlsUrl, targetKbps) : ordered[vi].hlsUrl;
      var candProbe = await tryHlsUrl(candUrl);
      if (!candProbe.ok) continue;
      var tsUrl = firstTsUrl(candProbe.text, candUrl);
      if (await tryTsUrl(tsUrl)) {
        ordered = [ordered[vi]].concat(ordered.filter(function (l) { return l.cdn !== ordered[vi].cdn; }));
        break;
      }
    }
  }

  var lastErr = "";
  for (var i = 0; i < ordered.length; i++) {
    var line = ordered[i];
    // v1.0.1 清晰度：先试转码流（流名 + _码率），实测 660000 间 _500/_2000/_4000/_10000 都可用；
    // 转码流拿不到再回落原画流，主播放列表分流作为第三层兜底
    var videoUrl = line.hlsUrl;
    var qualityUsed = wantQuality === "auto" ? "原画" : wantQuality;
    var probe = null;
    if (targetKbps) {
      var tcUrl = transcodeUrl(line.hlsUrl, targetKbps);
      var tcProbe = await tryHlsUrl(tcUrl);
      if (tcProbe.ok) {
        videoUrl = tcUrl;
        qualityUsed = wantQuality + "（转码 _" + targetKbps + "）";
        probe = tcProbe;
      }
    }
    if (!probe) {
      probe = await tryLineHls(line);
      if (!probe.ok) {
        lastErr = line.cdn + " 线路不可用";
        // 手动指定线路时也兜底换线路，否则用户在海外/某网络下会直接看不了
        continue;
      }
      var variant = pickVariant(probe.text, line.hlsUrl, targetKbps);
      if (variant) {
        videoUrl = variant;
      } else if (targetKbps) {
        // 转码流和主播放列表分流都没有：返回原流
        qualityUsed = wantQuality + "（该房间无此转码档，已回落原画）";
      }
    }
    return {
      videoUrl: videoUrl,
      lineUsed: line.cdn,
      qualityUsed: qualityUsed,
      meta: meta,
      lineCount: lines.length,
      linesAvailable: lines.map(function (l) { return l.cdn; }).join("、"),
    };
  }
  throw new Error("全部线路都不可用（" + lastErr + "）：可能未开播或网络被虎牙 CDN 拦截");
}

async function loadLiveRooms(params = {}) {
  try {
    var line = params.line || "auto";
    var quality = params.quality || "auto";
    var raw = String(params.roomIds || "").trim();
    if (raw) {
      var ids = raw.split(/[,，\n]+/).map(parseRoomId).filter(Boolean);
      return ids.map(function (roomId) {
        return {
          id: roomId,
          type: "url",
          title: "虎牙直播间 " + roomId,
          description: "点开现解析（线路：" + line + "，清晰度：" + quality + "）",
          link: makeLink(roomId, line, quality),
          playerType: "system",
        };
      });
    }
    // 热门列表：虎牙公开接口，不用登录
    var page = Number(params.page || 1);
    var res = await Widget.http.get("https://www.huya.com/cache.php", {
      headers: { "User-Agent": UA },
      params: { m: "LiveList", do: "getLiveListByPage", tagId: 0, page: page },
    });
    var data = res && res.data;
    // 有的运行环境按 content-type 判断，虎牙这个接口返回的是 text/html，
    // 所以 data 可能是 JSON 字符串而不是对象，这里两种都兼容
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { data = null; }
    }
    var datas = (data && data.data && data.data.datas) || [];
    if (!datas.length) throw new Error("热门列表为空：虎牙接口可能变了");
    return datas.map(function (d) {
      var roomId = String(d.profileRoom || d.uid || "");
      var title = (d.nick || "虎牙主播") + (d.roomName ? " · " + d.roomName : "");
      return {
        id: roomId,
        type: "url",
        title: title,
        posterPath: String(d.screenshot || "").replace(/\\\//g, "/"),
        description: (d.gameFullName ? d.gameFullName + " · " : "") + "线路：" + line + "，清晰度：" + quality,
        link: makeLink(roomId, line, quality),
        playerType: "system",
      };
    });
  } catch (error) {
    console.error("[loadLiveRooms] 失败:", error.message || error);
    throw error;
  }
}

async function loadDetail(link) {
  var parsed = parseLink(link);
  if (!parsed.roomId) return null;
  try {
    var s = await resolveStream(parsed.roomId, parsed.line, parsed.quality);
    var meta = s.meta || {};
    var title = meta.nick ? meta.nick + (meta.roomName ? " · " + meta.roomName : "") : "虎牙直播间 " + parsed.roomId;
    return {
      id: parsed.roomId,
      type: "url",
      title: title,
      posterPath: meta.posterPath || "",
      backdropPaths: meta.posterPath ? [meta.posterPath] : [],
      videoUrl: s.videoUrl,
      description: "正在直播 · 线路 " + s.lineUsed + "（可选：" + s.linesAvailable + "）· 清晰度 " + s.qualityUsed,
      link: link,
      playerType: "system",
    };
  } catch (error) {
    console.error("[loadDetail] 失败:", error.message || error);
    return {
      id: parsed.roomId,
      type: "url",
      title: "虎牙直播间 " + parsed.roomId,
      description: "解析失败：" + (error.message || error),
      link: link,
      playerType: "system",
    };
  }
}
