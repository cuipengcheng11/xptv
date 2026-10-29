WidgetMetadata = {
  id: "forward.douyin-live",
  title: "抖音直播",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "按直播间 ID 列出抖音直播间，点开解析 FLV/HLS 拉流地址。注意：抖音没有公开的直播列表接口，这个模块不是推荐列表，必须你自己填直播间 ID；抖音反爬/签名变化时解析可能失效，需要登录 Cookie 才能看需登录的房间。",
  author: "Forward",
  site: "https://github.com/InchStudio/ForwardWidgets",
  globalParams: [
    { name: "cookie", title: "Cookie（可选，live.douyin.com 登录后）", type: "input" },
  ],
  modules: [
    {
      id: "loadLiveRooms",
      title: "我的直播间",
      functionName: "loadLiveRooms",
      cacheDuration: 60,
      requiresWebView: false,
      params: [
        {
          name: "roomIds",
          title: "直播间 ID（逗号分隔）",
          type: "input",
          placeholders: [{ title: "例如：1234567890123456789, 987654321", value: "" }],
        },
      ],
    },
  ],
};

function parseRoomId(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  // 接受完整链接 https://live.douyin.com/123... 或纯数字 ID
  const m = s.match(/live\.douyin\.com\/(\d+)/);
  if (m) return m[1];
  const digits = s.match(/\d{10,}/);
  return digits ? digits[0] : s;
}

function extractStream(html) {
  const text = typeof html === "string" ? html : JSON.stringify(html || "");
  const out = {};
  // 抖音直播页里常见的拉流字段，优先 HLS（系统播放器兼容最好），其次 FLV
  const hls = text.match(/"hls_pull_url"\s*:\s*"([^"]+)"/);
  const flv = text.match(/"flv_pull_url"\s*:\s*"([^"]+)"/);
  const title = text.match(/"title"\s*:\s*"([^"]+)"/);
  const cover = text.match(/"cover"\s*:\s*{\s*"url_list"\s*:\s*\[\s*"([^"]+)"/) || text.match(/"avatar_thumb"[^}]*"url_list"\s*:\s*\[\s*"([^"]+)"/);
  if (hls) out.videoUrl = hls[1].replace(/\\u002F/g, "/");
  else if (flv) out.videoUrl = flv[1].replace(/\\u002F/g, "/");
  if (title) out.title = title[1];
  if (cover) out.posterPath = cover[1].replace(/\\u002F/g, "/");
  return out;
}

async function fetchRoomPage(roomId, params) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Referer: "https://live.douyin.com/",
  };
  if (params && params.cookie) headers.Cookie = params.cookie;
  const res = await Widget.http.get(`https://live.douyin.com/${roomId}`, { headers });
  return res && res.data;
}

async function loadLiveRooms(params = {}) {
  try {
    const raw = String(params.roomIds || "").trim();
    if (!raw) {
      throw new Error("请先在参数里填直播间 ID，多个用逗号分隔");
    }
    const ids = raw.split(/[,，\n]+/).map(parseRoomId).filter(Boolean);
    const items = [];
    for (const roomId of ids) {
      try {
        const page = await fetchRoomPage(roomId, params);
        const info = extractStream(page);
        items.push({
          id: roomId,
          type: "url",
          title: info.title || `抖音直播间 ${roomId}`,
          posterPath: info.posterPath || "",
          videoUrl: info.videoUrl || "",
          description: info.videoUrl ? "正在直播（已解析到拉流地址）" : "未解析到拉流地址：可能未开播、需登录或抖音改了页面结构",
          link: `douyin:${roomId}`,
          playerType: "system",
        });
      } catch (e) {
        items.push({
          id: roomId,
          type: "url",
          title: `抖音直播间 ${roomId}`,
          description: `加载失败：${e.message || e}`,
          link: `douyin:${roomId}`,
          playerType: "system",
        });
      }
    }
    return items;
  } catch (error) {
    console.error("[loadLiveRooms] 失败:", error.message || error);
    throw error;
  }
}

async function loadDetail(link) {
  const roomId = parseRoomId(String(link || "").split(":")[1] || link);
  if (!roomId) return null;
  try {
    // loadDetail 没有 params 对象，Cookie 无法从这里传入；需登录的房间请在列表页先解析
    const page = await fetchRoomPage(roomId, {});
    const info = extractStream(page);
    return {
      id: roomId,
      type: "url",
      title: info.title || `抖音直播间 ${roomId}`,
      posterPath: info.posterPath || "",
      backdropPaths: info.posterPath ? [info.posterPath] : [],
      videoUrl: info.videoUrl || "",
      description: info.videoUrl ? "正在直播" : "未解析到拉流地址",
      link: `douyin:${roomId}`,
      playerType: "system",
    };
  } catch (error) {
    console.error("[loadDetail] 失败:", error.message || error);
    return null;
  }
}
