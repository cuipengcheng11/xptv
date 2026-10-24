// v2.37.2：根治「播一会 403」。v2.37.1 修复裸拉流 403 后，详情页 videoUrl 仍会
//   落到 mp 直签 HS m3u8（tars_mp/fm、tars_mobile 均一次性防重放：实测同 URL
//   第 2 次请求即 403 空 body），ExoPlayer 周期性刷新 playlist 必二次请求同一
//   URL → 起播几秒后报 ERROR_CODE_IO_BAD_HTTP_STATUS(2004) 403（客户端把 403
//   翻译成「请重新登录」是误导文案，虎牙公开接口免登录、无需 cookie）。
//   修复：pickStreamUrl 只把「可重放」代理直链（tars_wap）写入详情页 videoUrl；
//   代理失效时返回 null、videoUrl 留空，播放器改走 loadResource 动态取流——
//   每次刷新重新请求 mp 接口拿全新签名（实测每秒调用签名均不同），新 URL
//   首次请求 200，可持续播放。
// v2.37.1：参照 bilibili 组件修复「详情页起播 403」。bilibili 详情项同时带
//   videoUrl + customHeaders（UA/Referer/Origin），虎牙此前详情页只写裸 videoUrl，
//   播放器直接拉流不带虎牙要求的 UA/Referer/Skip-Probe → hs.hls.huya.com 403(2004)。
//   修复：pickStreamUrl 改为返回 {url, customHeaders}，loadDetail 把对应请求头
//   挂到 item 上（代理直链=网页头、mp 直签=小程序头，统一加 Skip-Probe 防探测消耗签名）。
// v2.37.0：参照 bilibili 组件修复「房间号直达 + 搜索」：
// ① 新增 huyaRoomIdOf 从「房间号 / 虎牙链接」精确解析房间号
//   （www/m/y.huya.com/{rid}），不再用 replace([^0-9]) 把链接里其它数字
//   一起抠成错误房间号；
// ② 搜索关键词若是房间号或直播间链接，先走房间号直达（对齐 bilibili search），
//   不再空跑搜索接口；搜索无结果时提示可尝试输入房间号直达。
// v2.36.1 本地优化版：合并小程序请求；30 秒详情缓存；命中直链缓存不再预取；
// 复用分类推荐，推荐 HTTP 超时 1.2 秒；标题优先使用同源 introduction；
// 保留代理优先和 6 秒取流等待，仅缓存 tars_wap 可复用代理直链。
// QuickJS 会等待本次所有宿主异步任务，因此不使用未等待的“后台预取”。
// ============================================================
// 虎牙直播 ForwardWidget 组件
// 功能：热门直播 / 分类直播 / 搜索主播 / 房间号直达 / 主播个人主页（直播+回放+视频）
// v2.35.0：修复 v2.34.0 引入的"详情页没有播放资源"——v2.34.0 为秒开
//       不再等待取流，首次进详情页缓存未命中时 videoUrl 留空，客户端详情页
//       不渲染播放资源行、播放按钮置灰（用户实测 v2.34.0 无资源、v2.33.0 有）。
//       恢复"缓存命中秒开，未命中则等待 streamP（代理 6s / mp 兜底）"，
//       保证详情页 videoUrl 一定有可重放直链。
// v2.34.0：详情页提速（只解决"点进去获取直播间慢但能获取到"）。
//       根因：v60/v61 详情页 await 取流（代理海外节点手机网络常需 4-6 秒），
//       详情页被拖到 6 秒才出内容。修复：① 取流改为后台预取，详情页只等
//       毫秒级 mp 房间信息即秒开；② 预取的代理直链写 60 秒缓存，点播放时
//       loadResource 读缓存直接起播，不再实时等代理；③ 相似推荐超时 5s→1.2s，
//       拿不到直接跳过，不再拖详情页。其余逻辑（含 v2.33.0 代理优先修 403）不动。
// v2.33.0：修复"v59/v60 观看报错（al4 403）复现"。根因：v59/v60 的
//        pickStreamUrl 用 3 秒代理竞速超时，手机网络下海外代理常超 3 秒被跳过，
//        videoUrl 频繁落到 mp 直签 HS m3u8（tars_mp+fm 一次性防重放：实测同 URL
//        第 1 次 200、第 2 次即 403），ExoPlayer 直播周期性刷新 playlist 必二次
//        请求 → 起播几秒即报 403。v56 串行耐心等代理直链（tars_wap 可重放，实测
//        同 URL 连打 4 次全 200）故不报错。修复：videoUrl 只首选代理直链，代理
//        超时放宽 3s→6s；mp 直签仅作代理彻底失败的最后兜底。另修复「房间号直达/
//        搜索」点演员进主播主页后下滑翻页仍刷新回第一个（回调页码写死第 1 页）。
// v2.29.0：取流并行加速详情加载。
// v2.28.0：根治"一播出画面就报 403"（ERROR_CODE_IO_BAD_HTTP_STATUS 2004，cause=al4）。
//       根因闭环（实测）：小程序接口直签 m3u8 为 tars_mp+fm 一次性签名——同 URL
//       第 1 次请求 200，第 2 次起即 403（连续实测 4 房间/8 次均复现）。v2.26.0
//       将 videoUrl 改用该 mp 直签 HS m3u8 并误判"playlist 可重复请求"，实际
//       ExoPlayer 对直播流周期性刷新 playlist 时二次请求同一 URL 立即 403——
//       出画面（首次 200）后约 4 秒刷新即弹错，这就是"直播缓存清了仍报 al4"的根因。
//       修复：videoUrl 首选公共代理 302 升 https 的 HS m3u8（实测代理签发
//       tars_wap 签名、无 fm，同 URL 连打 8 次全 200 可重放，刷新不 403）；
//       mp 直签 HS m3u8 仅作兜底。loadResource 线路排序同步把代理直链提到 HS 之前。
// v2.25.0：根治"播一会"报 403（ERROR_CODE_IO_BAD_HTTP_STATUS 2004，cause=al4）。
//       根因闭环：v51 虽在 loadResource 路径修好 FLV 长连接，但 loadDetail 的
//       videoUrl 仍是代理 302 的签名 m3u8（HS 直签，一次性防重放）。播放器
//       从详情页直接按 videoUrl 拉流，周期性刷新 playlist 二次请求同一 URL 即 403，
//       FLV 修复被 videoUrl 路径完全绕过——这就是"直播、缓存清了仍报 al4"的原因。
//       修复：loadDetail 的 videoUrl 改用小程序接口签名 FLV 长连接（起播一次性
//       建连、不刷新 URL、不二次 403）；取不到 FLV 时不设 videoUrl，交由
//       loadResource 兜底（内部同样 FLV 优先）。彻底废弃 m3u8 直签/代理直链
//       作为 videoUrl 的用法。
// v2.24.8：修复"播一会"报 403（ERROR_CODE_IO_BAD_HTTP_STATUS 2004，streamUrl 为
//       tx.hls.huwa.com 签名 m3u8）。根因：v2.8 起改用小程序接口直签 m3u8 作为
//       播放源，虎牙签名 m3u8 是一次性防重放，ExoPlayer 对直播流周期性刷新
//       playlist 时用同一 URL 二次请求即 403；v50 只留 HS 直签，代理直链仍
//       指向全线 403 的 TX，故刷新后无可用线路直接弹窗。
//       修复：① 新增 FLV 长连接线路（HS/TX 实测 200 + video/x-flv），FLV 只需
//       起播时一次性建连拉流、无需周期性刷新 URL，彻底规避签名二次 403；
//       ② 代理直链强制 ?line=hs 并只接受 hs.hls.huya.com 的 m3u8；
//       ③ HS HLS 仅作兜底排在 FLV 之后。AL 全线剔除。
// v2.24.6：列表标题位改用房间号显示。列表项下方已自带主播名，
//       标题位不再占用显示主播名；改为优先 roomName 实时标题，
//       缺失时直接用房间号（roomid），不再用主播名/简介兜底。
//       详情页仍实时抓房间页标题，点进详情看到的永远是最新标题。
// v2.24.5：列表页标题改用主播名显示。虎牙列表/搜索接口实时标题字段恒空、
//       只有简介，列表显示简介会被误认成旧标题；改为优先 roomName，
//       缺失时直接用主播名（nick），不再用简介兜底。详情页仍实时抓
//       房间页标题，点进详情看到的永远是最新标题。
// v2.24.3：修复播放器全局搜索不返回结果。v2.24.1 在 search 模块误加了
//       peopleId/genreId 过滤参数声明，客户端全局搜索时按过滤回调处理
//       导致校验不通过不展示结果；本版移除 search 模块中这两项声明，
//       仅保留 keyword，恢复全局搜索可用。其余逻辑与 v2.24.2 一致。
// v2.24.2：修复主播作品滚动后重复首批内容。回放和视频均传递 pageIndex，
//       直播条目仅在第一页展示；后续页无作品时返回空列表，通知客户端停止加载。
// v2.24.1：修复 Streama 点击主播或分类时因列表过滤入口重复而提示不支持过滤。
//       peopleId / genreId 仅在 hotList 列表模块声明；分类与房间号模块保留原有参数。
//       当前 Streama 在执行列表函数前要求过滤入口唯一；下文 v2.19 的 peoples
//       校验说明属于历史推断，不适用于此次入口冲突。
// v2.24：修复播放 3003（解析容器失败）。实测 mp 接口 AL 线路 m3u8 返回 403 HTML，
//       ExoPlayer 切到该线路拿不到流容器即报 ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED(3003)，
//       故剔除 AL 线路；HS 线路实测 m3u8+分片均 200，提到代理直链之前（EU 代理在
//       国内手机网络不可靠）；代理直链仅接受 .m3u8 直链（代理对失效房间 302 到
//       404.mp4 占位，非 m3u8 一律剔除），拿不到则跳过整条代理线路。
// v2.19：恢复详情页演员表（Emby 风格 peoples 主播行，点击进主播个人主页三块：
//       正在直播/回放/视频）。弹窗根因已定位——客户端点演员后回调列表模块并校验
//       返回列表里是否存在带该 peopleId 的条目（官方 demo 的 hasPeople 语义），
//       v2.17 返回的主播主页条目未带 peoples 故校验失败弹窗；
//       v2.19 起主播主页每条作品都补齐匹配 peoples，校验通过不再弹窗。
// v2.18：曾误判"渲染详情页演员行即弹窗"故移除演员行，现确认根因为回调校验失败，
//       该结论作废（保留说明供追溯）。
// v2.16：详情页不再输出 peoples（当时推断客户端渲染演员行即弹窗，已证伪/过度修正）；
//       搜索重写：www.huya.com/search 已改版为动态壳（SSR 无主播结果），改用虎牙搜索
//       数据接口 search.cdn.huya.com（m=Search&do=getSearchContent，typ=-5），
//       直接返回直播房间 JSON，搜主播名/房间号均精确命中。
// v2.15：修复新版 SSR 数字型 lUid 提取失败——extractRoomUid 兼容 "lUid":294636272
//       （数字型）与 "lUid":"294636272"（字符串型），主播主页（正在直播 + 回放 + 视频）
//       三块内容恢复显示，详情页「相关推荐」不再空白。
// v2.14：详情页直接内嵌主播三块内容（正在直播 + 回放 + 视频）到 relatedItems「相关推荐」，
//       无需点击演员行即可进入，从根上绕开客户端"组件不支持演员过滤"回调弹窗；
//       同时保留 v2.13 的 peopleId/genreId 声明（客户端支持时点演员仍可进完整主页）。
// v2.13：元数据显式声明 peopleId/genreId 过滤参数（constant 空值，客户端回调时注入），
//       并更换组件 ID（huya33）绕开客户端按 id 强缓存，双保险规避"组件不支持演员过滤"。
// v2.12：主播个人主页补全「直播回放」。点主播行进主页后按虎牙主播主页布局展示三块：
//       正在直播（userInfo.isLiving/roomId）、直播回放（www.huya.com/video/u/{uid}?tabName=live
//       的 userPageLiveRecordVideoRsp，回放条目 vid 同样走 getMomentContent 取流，实测 m3u8
//       可重复请求 200 稳定）、主播视频（userPageVideoLisRsp）。列表项标题加「直播」「回放」
//       「视频」前缀分区。
// v2.11：修复播放 1002（ERROR_CODE_BEHIND_LIVE_WINDOW）。根因：所有签名 m3u8 直链均为一次性防重放，
//       ExoPlayer 加载前会先探测（probe）URL，探测请求消耗掉唯一有效签名，正式请求即 403/跳窗，
//       播放器误判源不可用而切源/超时（1002 或 2004）。修复：恢复 v15 时代的 Skip-Probe 头
//       （X-Forward-Skip-Redirect-Probe: 1）跳过播放器探测，确保正式请求拿到 200 的 m3u8；
//       另将小程序接口 HS 线路排到 AL/TX 之前（AL/TX 常被 403）。
// v2.10：修复 v2.9 播放 3003（容器解析失败）。根因：代理 URL 302 到 http 明文 m3u8 被
//       安卓 ExoPlayer 拦截（ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED）。
//       修复：播放源恢复 v2.6 验证链路——代理 302 Location 强制升 https 直链（https 实测
//       可重复请求 200，ts 分片 200 稳定），mp/SSR 一次性签名直链仅作备选。
// v2.9：曾尝试代理 URL 整体作为播放源，302 到明文流被 Exo 拦截 3003，已废弃。
// v2.8：取流曾改用微信小程序接口（mp.huya.com/cache.php?m=Live&do=profileRoom&showSecret=1），
//       官方页面 SSR（HNF_GLOBAL_INIT / hyPlayerConfig）已空壳；
//       画质说明：虎牙官方有 OD原画/BD蓝光/UHD超清/HD高清/SD标清/LD流畅 6 档，
//       但当前公开接口仅返回单档最高画质直链（无 exsphd 多档数据），故暂无可切换画质。
// v2.12：主播主页三块（直播/回放/视频）；回放取 userPageLiveRecordVideoRsp。
// v2.7：详情页点击主播行/分类标签的过滤回调统一分发到全部列表模块
//       （loadHotList/loadCategoryList/loadRoomById/search 都先走 handleFilterCall），
//       修复从热门/搜索/房间号直达进入详情后点演员报"组件不支持演员过滤"；
//       主播行进个人主页：正在直播（userInfo.isLiving/roomId）+ 视频列表（userPageVideoLisRsp）。
// 取流：抓 m.huya.com 房间页解析 HNF_GLOBAL_INIT，用 vStreamInfo
//       (HS 优先) 构造签名 m3u8 直链；备用 liveLineUrl 解码；
//       最后回退公共代理。v1.6 修复详情页无可播放地址：
//       loadDetail 补齐 videoUrl 兜底。注：v1.6 曾移除 Skip-Probe 头（误判 m3u8 为稳定直链），
//       v2.11 恢复该头——实测官方/小程序签名直链均为一次性防重放，探测必 403。
//       v1.7 代理直链自动升 https（手机播放器常拦明文流）。
//       v1.8 更换全新组件 ID（forward.live.huya9），绕开客户端按 id 强缓存。
//       v1.9 详情页补真实标题/封面/分类/简介；线路排序 https 优先。
//       v2.0 修复 ExoPlayer 3003：HS/AL/TX 签名 m3u8 基址强制升 https，
//             ts 分片全链路 https（实测 m3u8 200 + TS 分片 video/MP2T）；
//             详情页补 Emby 风格字段（genreItems 分类标签 + peoples 主播行）。
// ============================================================

var WidgetMetadata = {
    id: "forward.live.huya64",
    title: "虎牙直播 v2.37.1",
    description: "虎牙直播：热门/分类/搜索（支持房间号直达）/主播主页（直播+回放+视频）/相似直播间推荐。",
    author: "Marvis",
    site: "https://www.huya.com",
    version: "2.37.2",
    requiredVersion: "0.0.1",
    detailCacheDuration: 120,
    modules: [
        {
            id: "hotList",
            title: "热门直播",
            description: "虎牙全站当前热门直播间",
            functionName: "loadHotList",
            cacheDuration: 60,
            params: [
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                    value: "1"
                },
                {
                    name: "peopleId",
                    title: "演员过滤",
                    type: "constant",
                    value: ""
                },
                {
                    name: "genreId",
                    title: "分类过滤",
                    type: "constant",
                    value: ""
                }
            ]
        },
        {
            id: "categoryList",
            title: "分类直播",
            description: "按游戏分类浏览直播间（右上角菜单切换 45 个分类）",
            functionName: "loadCategoryList",
            cacheDuration: 60,
            params: [
                {
                    name: "gameId",
                    title: "游戏分类",
                    type: "enumeration",
                    enumOptions: [
                        { title: "全部热门", value: "0" },
                        { title: "娱乐", value: "100022" },
                        { title: "手游休闲", value: "100004" },
                        { title: "网游竞技", value: "100023" },
                        { title: "星秀", value: "1663" },
                        { title: "一起看", value: "2135" },
                        { title: "主机游戏", value: "100032" },
                        { title: "王者荣耀", value: "2336" },
                        { title: "英雄联盟", value: "1" },
                        { title: "摸了个鱼", value: "9283" },
                        { title: "一起玩", value: "6613" },
                        { title: "交友", value: "4079" },
                        { title: "吃喝玩乐", value: "100044" },
                        { title: "互动点播", value: "5907" },
                        { title: "lol云顶之弈", value: "5485" },
                        { title: "单机热游", value: "100002" },
                        { title: "互动组队", value: "5367" },
                        { title: "和平精英", value: "3203" },
                        { title: "户外", value: "2165" },
                        { title: "原创", value: "6861" },
                        { title: "新游广场", value: "100052" },
                        { title: "虎牙文化", value: "4089" },
                        { title: "三角洲行动", value: "9449" },
                        { title: "我的世界", value: "1732" },
                        { title: "体育", value: "2356" },
                        { title: "暴雪专区", value: "100043" },
                        { title: "MMORPG", value: "100273" },
                        { title: "二次元", value: "2633" },
                        { title: "英雄联盟手游", value: "6203" },
                        { title: "综合手游", value: "100029" },
                        { title: "穿越火线", value: "4" },
                        { title: "天天吃鸡", value: "2793" },
                        { title: "冒险岛", value: "2243" },
                        { title: "英雄联盟电竞经理", value: "7177" },
                        { title: "棋牌休闲", value: "100301" },
                        { title: "炉石传说", value: "393" },
                        { title: "金铲铲之战", value: "7185" },
                        { title: "射击综合游戏", value: "100141" },
                        { title: "第五人格", value: "3115" },
                        { title: "动作游戏", value: "100197" },
                        { title: "永劫无间", value: "6219" },
                        { title: "魔兽世界", value: "8" },
                        { title: "原神", value: "5489" },
                        { title: "军事游戏", value: "100133" },
                        { title: "王者万象棋", value: "8127" },
                        { title: "桌游", value: "100305" },
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                    value: "1"
                }
            ]
        },
        {
            id: "roomById",
            title: "房间号直达",
            description: "输入虎牙房间号直接观看（如 666888）",
            functionName: "loadRoomById",
            cacheDuration: 0,
            params: [
                {
                    name: "roomid",
                    title: "房间号",
                    type: "input",
                    description: "主播直播间数字房间号"
                }
            ]
        },
        {
            id: "loadResource",
            title: "加载资源",
            functionName: "loadResource",
            type: "stream",
            cacheDuration: 0,
            params: []
        }
    ],
    search: {
        title: "搜索主播",
        functionName: "search",
        params: [
            {
                name: "keyword",
                title: "关键词",
                type: "input",
                description: "主播名或房间标题关键词"
            }
        ]
    }
};

// ---------------- 常量 ----------------
var HUYA_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HUYA_REFERER = "https://www.huya.com/";
// 移动端房间页 UA/Referer（解析 HNF_GLOBAL_INIT 取流用）
var HUYA_M_UA = "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
var HUYA_M_REFERER = "https://m.huya.com/";
// 公共取流代理：请求该地址会 302 到虎牙真实 m3u8 直链（兜底线路，可能失效）
var HUYA_PROXY = "https://cdn.ttvb.eu.org/huya";
// 微信小程序接口 UA/Referer（v2.8 取流主通道，官方页面 SSR 已空壳）
var HUYA_MP_UA = "ios/7.830 (ios 17.0; ; iPhone 15 (A2846/A3089/A3090/A3092))";
var HUYA_MP_REFERER = "https://servicewechat.com/wx74767bf0b684f7d3/301/page-frame.html";
// 主播视频：视频条目 id 前缀 huya_video_<vid>
var HUYA_VIDEO_PREFIX = "huya_video_";
var HUYA_MP_PENDING = Object.create(null);

// 只合并正在进行的同房间请求；完成后释放，避免跨调用复用过期直播状态/签名。
function fetchMpProfile(rid) {
    if (HUYA_MP_PENDING[rid]) return HUYA_MP_PENDING[rid];
    var request = (async function () {
        try {
            var resp = await Widget.http.get("https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid=" + rid + "&showSecret=1", {
                timeout: 6000,
                headers: {
                    "User-Agent": HUYA_MP_UA,
                    "Referer": HUYA_MP_REFERER,
                    "accept-language": "zh-CN,zh;q=0.9"
                }
            });
            var parsed = parseJsonLike(resp.data);
            return parsed && parsed.data ? parsed.data : null;
        } catch (e) {
            console.error("huya profile request failed:", e);
            return null;
        }
    })();
    var shared = request.then(function (data) {
        delete HUYA_MP_PENDING[rid];
        return data;
    }, function () {
        delete HUYA_MP_PENDING[rid];
        return null;
    });
    HUYA_MP_PENDING[rid] = shared;
    return shared;
}

function readTimedCache(key, maxAgeMs) {
    try {
        var raw = Widget.storage.get(key);
        if (!raw) return null;
        var entry = typeof raw === "string" ? JSON.parse(raw) : raw;
        var age = Date.now() - Number(entry.t);
        return isFinite(age) && age >= 0 && age < maxAgeMs ? entry.value : null;
    } catch (e) {
        return null;
    }
}

function writeTimedCache(key, value) {
    try {
        Widget.storage.set(key, JSON.stringify({ t: Date.now(), value: value }));
    } catch (e) {}
}

// 不把小程序的一次性签名或旧版本误写的 mp 兜底当作可复用代理缓存。
function isReusableProxyUrl(url) {
    return typeof url === "string" &&
        /^https:\/\/hs\.hls\.huya\.com\/[^?#]*\.m3u8\?/i.test(url) &&
        /[?&]ctype=tars_wap(?:&|$)/i.test(url) &&
        !/[?&](?:ctype=tars_mp|fm=)/i.test(url);
}

// v2.3：解析公共代理 302，返回升 https 后的虎牙 CDN 直链（m3u8 或 mp4）。
// 虎牙官方页面已不再注入 HNF_GLOBAL_INIT，官方直链解析全部失效，
// 详情页 videoUrl 兜底必须是 https 直链，否则播放器跟随 302 到 http 明文流
// 会被安卓 ExoPlayer 拦截，报 ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED(3003)。
async function resolveProxyHls(rid) {
    try {
        // v2.24.8：强制 line=hs，避免代理默认 302 到全线 403 的 TX 线路。
        var respP = await Widget.http.get(HUYA_PROXY + "/" + rid + "?line=hs", { timeout: 6000, allow_redirects: false, headers: {
            "User-Agent": HUYA_UA,
            "Referer": HUYA_REFERER
        } });
        var loc = "";
        if (respP && respP.headers) {
            loc = respP.headers.location || respP.headers.Location || respP.headers["location"] || "";
        }
        if (!loc) return "";
        if (loc.indexOf("//") === 0) loc = "https:" + loc;
        if (loc.indexOf("http://") === 0) loc = "https://" + loc.slice(7);
        // v2.24：代理对不在播/失效房间会 302 到 404.mp4/limit.mp4 占位视频，
        //        非 m3u8 直链一律剔除，避免播放器拉占位视频或报 3003。
        // v2.24.8：只接受 HS 域名直链（hs.hls.huya.com），TX 已被实测全线 403。
        var pathPart = loc.split("?")[0];
        if (pathPart.indexOf(".m3u8") < 0) return "";
        if (pathPart.indexOf("hs.hls.huya.com") < 0) return "";
        cacheProxyUrl(rid, loc);
        return loc;
    } catch (e) {
        console.error("huya resolveProxyHls failed:", e);
        return "";
    }
}


// v2.8：微信小程序接口取流。虎牙官方页面 SSR（HNF_GLOBAL_INIT/hyPlayerConfig）已全部
// 空壳、公共代理 cdn.ttvb.eu.org 已失效，此接口为当前唯一可用取流通道。
// 返回 baseSteamInfoList（AL/TX/HS 线路），antiCode 服务器直签；
// TX/HW 线路替换 ctype/fs 兼容 webh5；统一升 https（安卓 Exo 拦明文 http）。
// v2.24.7：实测 AL/TX 线路 m3u8 全部返回 403（AL 为 403 HTML 错误页、TX 为空 body），
//          仅 HS 线路稳定 200，故 AL/TX 一律剔除，只保留 HS 单线路。
async function fetchMpStreams(rid) {
    var out = [];
    try {
        var data = await fetchMpProfile(rid);
        if (!data || data.realLiveStatus !== "ON") return out;
        var bsl = data.stream && data.stream.baseSteamInfoList ? data.stream.baseSteamInfoList : [];
        for (var i = 0; i < bsl.length; i++) {
            var it = bsl[i];
            var cdn = it.sCdnType || "";
            var name = it.sStreamName || "";
            if (!name) continue;
            // v2.26.0：剔除 FLV 线路产出。v2.24.8 曾引入 FLV 长连接（HS/TX 实测
            //       200 + video/x-flv 头），但 v2.26.0 实测该签名 FLV 被 CDN 限流：
            //       只下发约 1.2MB（≈5-6 秒）后 EOF 断连，播放器播完缓冲即定格。
            //       留着会让 loadResource 兜底首选 FLV 而卡住，故不再产出。
            // v2.24.7：HLS 仅保留 HS 线路。实测 AL m3u8 返回 403 HTML 错误页、
            //        TX m3u8 空 body 全线 403；仅 HS 线路稳定 200，作 HLS 兜底。
            if (cdn === "AL" || cdn === "TX") continue;
            var hlsUrl = it.sHlsUrl || "";
            var suffix = it.sHlsUrlSuffix || "m3u8";
            var hlsAnti = it.sHlsAntiCode || "";
            if (!hlsUrl || !hlsAnti) continue;
            var m3u8 = hlsUrl + "/" + name + "." + suffix + "?" + hlsAnti;
            if (m3u8.indexOf("http://") === 0) m3u8 = "https://" + m3u8.slice(7);
            if (m3u8.indexOf("//") === 0) m3u8 = "https:" + m3u8;
            out.push({
                name: cdn + "线路",
                description: "小程序接口签名 m3u8 (https)",
                url: m3u8,
                customHeaders: {
                    "User-Agent": HUYA_MP_UA,
                    "Referer": HUYA_MP_REFERER
                },
                playerType: "app"
            });
        }
    } catch (e) {
        console.error("huya mp api failed:", e);
    }
    return out;
}

// v2.32.0：详情页房间信息从 mp 接口一次拿全（标题/封面/主播/分类/gid/简介），
// 替代串行抓取移动房间页 HTML（页面体积大、移动网络下慢，是详情页加载慢的主因）。
// 返回 null 表示拿不到（未开播/接口异常），调用方回退抓 m 页兜底。
function fetchMpRoomInfo(rid) {
    return fetchMpProfile(rid).then(function (data) {
        var info = null;
        try {
            if (data) {
                var ld = data.liveData || null;
                var pi = data.profileInfo || null;
                var title = (ld && ld.roomName) ? String(ld.roomName).trim() : "";
                var cover = (ld && ld.screenshot) ? String(ld.screenshot).trim() : "";
                var nick = ((ld && ld.nick) ? String(ld.nick).trim() : "") || ((pi && pi.nick) ? String(pi.nick).trim() : "");
                var game = (ld && ld.gameFullName) ? String(ld.gameFullName).trim() : "";
                if (!game && ld && ld.gameHostName) game = String(ld.gameHostName).trim();
                var gid = (ld && ld.gid) ? String(ld.gid).trim() : "";
                var intro = (ld && ld.introduction) ? String(ld.introduction).trim() : "";
                var avatar = ((pi && pi.avatar180) ? String(pi.avatar180).trim() : "") || ((ld && ld.avatar180) ? String(ld.avatar180).trim() : "");
                if (title || nick || cover) {
                    info = { title: title, cover: cover, nick: nick, game: game, gid: gid, intro: intro, avatar: avatar };
                }
            }
        } catch (e) { info = null; }
        return info;
    }, function () { return null; });
}

// v2.29.0：详情页取流并行化 + 超时兜底。
// 之前 loadDetail 串行等待：房间页 → 代理 302 → 小程序接口兜底，代理在海外
// 国内网络慢时会拖住详情页好几秒。此函数并行发起代理直链与 mp 接口，
// 代理 3 秒拿不到就放弃（海外节点慢/超时快速跳过），谁先出可用 m3u8 用谁。
function withTimeout(promise, ms) {
    // 部分播放器沙箱环境未暴露全局 setTimeout/clearTimeout，此时无法做
    // 超时兜底；直接透传原 Promise 结果，避免 ReferenceError 崩掉详情页。
    if (typeof setTimeout !== "function" || typeof clearTimeout !== "function") {
        return new Promise(function (resolve, reject) {
            promise.then(resolve, reject);
        });
    }
    return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () {
            if (!done) { done = true; resolve(""); }
        }, ms);
        promise.then(function (v) {
            if (!done) { done = true; clearTimeout(timer); resolve(v); }
        }, function () {
            if (!done) { done = true; clearTimeout(timer); resolve(""); }
        });
    });
}

async function pickStreamUrl(rid) {
    // v2.33.0：videoUrl 只首选代理直链（tars_wap 可重放签名）。实测
    // mp 直签 HS m3u8（tars_mp+fm）同 URL 第 2 次请求即 403（一次性防重放），
    // ExoPlayer 直播周期性刷新 playlist 必二次请求同一 URL → 起播 4 秒即报
    // 403（al4）；代理直链（cdn.ttvb.eu.org?line=hs 的 tars_wap）同 URL 连打
    // 4 次全 200 可重放。v59/v60 的 3 秒代理竞速超时在手机网络下频繁跳过代理，
    // 让一次性 mp 直签上位，这就是"v56 没事、v59/v60 复现"的根因。
    // 新策略：代理超时放宽到 6 秒并优先采用；mp 直签仅作代理彻底失败的最后
    // 兜底（能出画面但可能二次 403），避免代理失效时完全黑屏。
    // v2.37.1：返回 {url, customHeaders}——对齐 bilibili 组件把播放请求头挂到
    // 详情项上，播放器直接用 videoUrl 拉流时带上正确 UA/Referer/Skip-Probe，
    // 不再裸请求导致 hs.hls.huya.com 403（2004）。
    var webHdrs = {
        "User-Agent": HUYA_UA,
        "Referer": HUYA_REFERER,
        "X-Forward-Skip-Redirect-Probe": "1"
    };
    var cached = readProxyCache(rid);
    if (cached) return { url: cached, customHeaders: webHdrs };
    var proxy = await resolveProxyHls(rid);
    if (proxy) return { url: proxy, customHeaders: webHdrs };
    // v2.37.2：不再用 mp 直签 HS m3u8 兜底详情页 videoUrl（一次性防重放，播一会 403）。
    // 代理失效时返回 null，videoUrl 留空，播放器走 loadResource 动态取流。
    return null;
}

// 缓存 60 秒；只有验证过格式的 tars_wap 直链可以跨调用复用。
function cacheProxyUrl(rid, url) {
    try {
        if (!rid || !isReusableProxyUrl(url)) return;
        Widget.storage.set("huya_proxy_" + rid, JSON.stringify({ url: url, t: Date.now() }));
    } catch (e) {
        // storage 不可用时忽略，loadResource 走实时取流兜底
    }
}

function readProxyCache(rid) {
    try {
        if (!rid) return "";
        var raw = Widget.storage.get("huya_proxy_" + rid);
        if (!raw) return "";
        var obj = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!obj || !isReusableProxyUrl(obj.url)) return "";
        var age = Date.now() - Number(obj.t || 0);
        if (!isFinite(age) || age < 0 || age >= 60000) return "";
        return obj.url;
    } catch (e) {
        return "";
    }
}

// ---------------- 工具函数 ----------------

// 兼容解析虎牙列表接口返回：新版 m=LiveRoom 返回 { vRyVv: [...] }，旧版 m=LiveList 返回 { data: { datas: [...] } }
function extractRoomList(data) {
    if (!data) return [];
    var list = null;
    if (Array.isArray(data)) {
        list = data;
    } else if (Array.isArray(data.vRyVv)) {
        list = data.vRyVv;
    } else if (Array.isArray(data.vList)) {
        list = data.vList;
    } else if (Array.isArray(data.roomList)) {
        list = data.roomList;
    } else if (data.data && Array.isArray(data.data.datas)) {
        list = data.data.datas;
    } else if (data.data && Array.isArray(data.data.list)) {
        list = data.data.list;
    } else if (data.data && Array.isArray(data.data)) {
        list = data.data;
    } else if (data.result && Array.isArray(data.result.rooms)) {
        list = data.result.rooms;
    }
    return list || [];
}

// 字段兼容取值
function pick(obj, keys, fallback) {
    if (!obj) return fallback;
    for (var i = 0; i < keys.length; i++) {
        if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== "") {
            return obj[keys[i]];
        }
    }
    return fallback;
}

// 将虎牙房间对象规范化为 ForwardWidget VideoItem
function normalizeRoom(room) {
    // 旧版 LiveList 接口房间号在 profileRoom，新版在 roomid/roomId；uid 是主播号不能直接当房间号
    var roomid = String(pick(room, ["profileRoom", "roomid", "roomId", "lRoomId", "roomID"], "")).trim();
    // Emby 语义：列表标题优先直播间标题（roomName / sRoomName / sTitle）；列表接口这些字段常为空，
    // 则回落房间号（roomid）显示；列表项下方已自带主播名，标题位不再占用显示主播名；简介不参与标题兜底
    var title = pick(room, ["roomName", "roomname", "sRoomName", "sTitle"], "");
    var nick = pick(room, ["nick", "nickname", "sNick"], "");
    var game = pick(room, ["gameFullName", "gameName", "sGameName", "game"], "");
    var cover = pick(room, ["screenshot", "screenshotUrl", "sScreenshot", "coverUrl", "imgUrl"], "");
    var avatar = pick(room, ["avatar180", "avatar", "sAvatar180", "sAvatar"], "");
    var online = pick(room, ["aliveNum", "online", "iOnline", "heat"], 0);

    // 兼容新版接口：roomid 缺失时用 uid 兜底（新版 vRyVv 无 profileRoom 时）
    if (!roomid) {
        roomid = String(pick(room, ["uid", "profileRoom"], "")).trim();
    }

    if (!roomid) return null;

    // 标题兜底：优先直播间标题；列表接口标题字段常为空，回落房间号（roomid）；都缺再用分类拼接
    if (!title) title = roomid ? ("房间 " + roomid) : (game ? (game + " 直播") : "虎牙直播间");
    if (cover && cover.indexOf("http") !== 0) {
        cover = "https:" + cover;
    }
    if (avatar && avatar.indexOf("http") !== 0) {
        avatar = "https:" + avatar;
    }

    var item = {
        id: roomid,
        type: "url",
        title: title,
        coverUrl: cover,
        backdropPath: cover,
        backdropPaths: cover ? [cover] : [],
        link: roomid,
        mediaType: "tv"
    };
    if (nick) item.description = nick;
    if (game) item.genreTitle = game;
    if (online) item.rating = String(online);

    // Emby 风格：分类标签 + 主播人物行
    if (game) {
        item.genreItems = [{ id: String(game), title: String(game) }];
    }
    if (nick) {
        item.peoples = [{
            id: "huya_" + roomid,
            title: String(nick),
            avatar: avatar || "",
            role: "主播"
        }];
    }

    var desc = [];
    if (nick) desc.push("主播：" + nick);
    if (game) desc.push("分类：" + game);
    if (online) desc.push("人气：" + online);
    if (desc.length) item.description = desc.join("  ");

    // 缓存房间详情，供详情页 loadDetail 使用
    cacheRoomDetail(roomid, title, cover, nick, game, online, avatar, String(pick(room, ["gid", "gameId", "iGid"], "")).trim());

    return item;
}

// 缓存单个房间详情到 Widget.storage（同一组件内跨模块共享）
// v2.22：detail 增加 gid（房间精确游戏分类ID），供详情页相似直播间推荐使用
function cacheRoomDetail(rid, title, cover, nick, game, online, avatar, gid) {
    try {
        if (!rid) return;
        var detail = { title: title || "", cover: cover || "", nick: nick || "", game: game || "", online: online || 0, avatar: avatar || "", gid: gid || "" };
        Widget.storage.set("huya_room_" + rid, JSON.stringify(detail));
    } catch (e) {
        // storage 不可用时忽略，详情页走兜底标题
    }
}

// 读取缓存的房间详情
function readRoomDetail(rid) {
    try {
        var cached = Widget.storage.get("huya_room_" + rid);
        if (!cached) return null;
        if (typeof cached === "string") {
            return JSON.parse(cached);
        }
        return cached;
    } catch (e) {
        return null;
    }
}

// 推荐只缓存首批的必要字段，避免把整个分类响应写进 storage。
function cacheSimilarRooms(gid, rooms) {
    var compact = [];
    for (var i = 0; i < rooms.length && compact.length < 30; i++) {
        var room = rooms[i];
        var rid = pick(room, ["profileRoom", "roomid", "roomId", "lRoomId", "roomID", "uid"], "");
        if (!rid) continue;
        compact.push({
            profileRoom: rid,
            roomName: pick(room, ["roomName", "roomname", "sRoomName", "sTitle"], ""),
            nick: pick(room, ["nick", "nickname", "sNick"], ""),
            gameFullName: pick(room, ["gameFullName", "gameName", "sGameName", "game"], ""),
            screenshot: pick(room, ["screenshot", "screenshotUrl", "sScreenshot", "coverUrl", "imgUrl"], ""),
            avatar180: pick(room, ["avatar180", "avatar", "sAvatar180", "sAvatar"], ""),
            aliveNum: pick(room, ["aliveNum", "online", "iOnline", "heat"], 0),
            gid: pick(room, ["gid", "gameId", "iGid"], "")
        });
    }
    if (compact.length) writeTimedCache("huya_sim_opt_" + gid, compact);
}

// 普通列表仍有旧/新两路兜底；详情推荐使用缓存或单次 1.2 秒 HTTP 请求。
async function fetchLiveRooms(gameId, page, detailOnly) {
    var p = parseInt(page, 10) || 1;
    if (p < 1) p = 1;
    var gid = (gameId === undefined || gameId === null || gameId === "") ? "0" : String(gameId);
    if (detailOnly) {
        var cached = readTimedCache("huya_sim_opt_" + gid, 60000);
        if (Array.isArray(cached) && cached.length) return cached;
    }
    var requestTimeout = detailOnly ? 1200 : 6000;
    var headers = {
        "User-Agent": HUYA_UA,
        "Referer": HUYA_REFERER,
        "Accept": "application/json, text/plain, */*"
    };

    // 旧版接口：m=LiveList&do=getLiveListByPage（分类加 gameId，热门不传 gameId）
    var oldUrl = gid === "0"
        ? "https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&tag_all=1&page=" + p
        : "https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&tag_all=1&gameId=" + gid + "&page=" + p;
    try {
        var resp = await Widget.http.get(oldUrl, { timeout: requestTimeout, headers: headers });
        var parsed = parseJsonLike(resp.data);
        var rooms = extractRoomList(parsed);
        if (rooms && rooms.length > 0) {
            if (p === 1) cacheSimilarRooms(gid, rooms);
            return rooms;
        }
    } catch (e) {
        console.error("huya old api failed:", e);
    }
    if (detailOnly) return [];

    // 新版接口：m=LiveRoom&do=getLiveListByPage（数据中心/部分环境会被反爬返回 HTML）
    var newUrl = "https://www.huya.com/cache.php?m=LiveRoom&do=getLiveListByPage&gameId=" + gid +
        "&iPage=" + p + "&iPageSize=30&isAll=0";
    try {
        var resp2 = await Widget.http.get(newUrl, { timeout: 6000, headers: headers });
        var parsed2 = parseJsonLike(resp2.data);
        var rooms2 = extractRoomList(parsed2);
        if (rooms2 && rooms2.length > 0) {
            if (p === 1) cacheSimilarRooms(gid, rooms2);
            return rooms2;
        }
    } catch (e) {
        console.error("huya new api failed:", e);
    }

    return [];
}

// 兼容解析 JSON / JSONP 字符串
function parseJsonLike(text) {
    if (typeof text === "object" && text !== null) return text;
    var str = String(text || "").trim();
    if (!str) return null;
    try {
        return JSON.parse(str);
    } catch (e) {
        // JSONP 形式：xxx({...}) 或 xxx = {...};
        var m = str.match(/\{[\s\S]*\}/);
        if (m) {
            try {
                return JSON.parse(m[0]);
            } catch (e2) {
                return null;
            }
        }
        return null;
    }
}

// ---------------- 取流解析工具 ----------------

// 标准 Base64 解码（兼容 URL-safe 变体，用于 liveLineUrl）
var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Decode(str) {
    str = String(str || "").replace(/[\r\n]/g, "");
    if (str.indexOf("-") > -1 || str.indexOf("_") > -1) {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
    }
    while (str.length % 4 !== 0) str += "=";
    var out = "", buffer = 0, bits = 0;
    for (var i = 0; i < str.length; i++) {
        var c = B64_CHARS.indexOf(str.charAt(i));
        if (c < 0) continue;
        buffer = (buffer << 6) | c;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((buffer >> bits) & 0xFF);
        }
    }
    return out;
}

// 在文本中提取 "key": "value" 字符串值
function extractStr(txt, key) {
    var re = new RegExp('"' + key + '"\\s*:\\s*"([^"]*)"');
    var m = re.exec(txt);
    return m ? m[1] : "";
}

// 还原 JSON 转义（页面字段常用 \u002F 表示 / 等）
function unescapeJson(str) {
    return String(str || "").replace(/\\u([0-9a-fA-F]{4})/g, function (m, hex) {
        return String.fromCharCode(parseInt(hex, 16));
    });
}

// 在 HNF_GLOBAL_INIT 文本中按 CDN 类型构造 HLS 直链
// 页面字段顺序：sCdnType -> sHlsUrl -> sStreamName -> sHlsUrlSuffix -> sHlsAntiCode
// v2.0：基址强制升 https（hs.hls.huya.com https 实测 200 + ts 分片 video/MP2T），
//       避免安卓 ExoPlayer 明文 http 拦截导致 3003 容器解析失败。
function buildStreamUrl(init, cdnType) {
    var key = '"sCdnType":"' + cdnType + '"';
    var idx = init.indexOf(key);
    if (idx < 0) {
        key = '"sCdnType": "' + cdnType + '"';
        idx = init.indexOf(key);
    }
    if (idx < 0) return "";
    var seg = init.slice(idx, idx + 2000);
    var hls = unescapeJson(extractStr(seg, "sHlsUrl"));
    var name = unescapeJson(extractStr(seg, "sStreamName"));
    var suffix = extractStr(seg, "sHlsUrlSuffix") || "m3u8";
    var anti = unescapeJson(extractStr(seg, "sHlsAntiCode"));
    if (!hls || !name || !anti) return "";
    if (hls.indexOf("http") !== 0) hls = "https:" + hls;
    // v2.0 核心修复：http 明文基址强制升 https，m3u8 内相对路径 ts 分片随之全链路 https
    if (hls.indexOf("http://") === 0) {
        hls = "https://" + hls.slice(7);
    }
    return hls + "/" + name + "." + suffix + "?" + anti;
}


// ---------------- 主播视频 ----------------

// 从房间页 HNF_GLOBAL_INIT 文本中提取主播 uid（lUid）
// v2.15：新版 SSR 的 lUid 为数字型（"lUid":294636272），旧版为字符串型（"lUid":"294636272"），
//        两种都兼容；roomProfile 段优先，找不到再回退全 init 段。
function extractRoomUid(html) {
    if (!html) return "";
    var m = html.match(/window\.HNF_GLOBAL_INIT\s*=\s*([\s\S]*?)<\/script>/);
    if (!m || !m[1]) return "";
    var init = m[1];
    var seg = init.indexOf("roomProfile") >= 0 ? init.substring(init.indexOf("roomProfile")) : init;
    var uid = extractStr(seg, "lUid");
    if (!uid) uid = extractStr(init, "lUid");
    if (!uid) uid = extractNum(seg, "lUid");
    if (!uid) uid = extractNum(init, "lUid");
    return uid;
}

// 提取数字型 JSON 字段："key": 123456
function extractNum(txt, key) {
    if (!txt) return "";
    var re = new RegExp('"' + key + '"\\s*:\\s*(\\d+)');
    var m = re.exec(txt);
    return m ? m[1] : "";
}

// 从视频主页 SSR 文本（userPageVideoLisRsp 段）解析视频条目，规避嵌套对象导致的正则越界
function parseVideoList(init) {
    var out = [];
    if (!init) return out;
    var pos = init.indexOf("userPageVideoLisRsp");
    if (pos < 0) return out;
    var seg = init.substring(pos);
    var re = /"vid":(\d+),/g;
    var mm;
    var seen = {};
    while ((mm = re.exec(seg)) !== null) {
        var vid = mm[1];
        if (vid === "0" || seen[vid]) continue;
        seen[vid] = 1;
        var endIdx = seg.indexOf('"_classname":"HUYAVIDEO.VideoData"}', mm.index);
        var raw = endIdx > 0 ? seg.substring(mm.index, endIdx + 40) : seg.substring(mm.index, mm.index + 3000);
        var title = unescapeJson(extractStr(raw, "videoTitle")) || "";
        var ch = extractStr(raw, "channelId") || "";
        var coverM = raw.match(/"cover":"([^"]+)"/);
        var cover = coverM ? unescapeJson(coverM[1]) : "";
        if (cover && cover.indexOf("http") !== 0) cover = "https:" + cover;
        var desc = [];
        if (ch) desc.push("分类 " + ch);
        desc.push("视频 " + vid);
        out.push({
            id: HUYA_VIDEO_PREFIX + vid,
            type: "url",
            title: (title || "虎牙视频 " + vid).slice(0, 80),
            coverUrl: cover || "",
            link: HUYA_VIDEO_PREFIX + vid,
            mediaType: "movie",
            description: desc.join("  ")
        });
        try { Widget.storage.set("huya_video_" + vid, JSON.stringify({ title: (title || "虎牙视频 " + vid).slice(0, 80), cover: cover || "" })); } catch (e) {}
    }
    return out;
}

// 从视频主页 SSR 文本（userPageLiveRecordVideoRsp 段）解析直播回放条目
// v2.12：虎牙主播主页「直播录像」tab 走整页 SSR 刷新（?tabName=live&pageIndex={n}），
//        回放条目在 videoDataList.value[] 中，每项外层 LiveRecordVideoData 包 videoData
//        （含 vid/videoTitle/covers/duration），vid 同样走 getMomentContent 取流。
function parseLiveRecordList(init) {
    var out = [];
    if (!init) return out;
    var pos = init.indexOf("userPageLiveRecordVideoRsp");
    if (pos < 0) return out;
    var seg = init.substring(pos);
    var re = /"vid":(\d+),/g;
    var mm;
    var seen = {};
    while ((mm = re.exec(seg)) !== null) {
        var vid = mm[1];
        if (vid === "0" || seen[vid]) continue;
        seen[vid] = 1;
        var endIdx = seg.indexOf('"_classname":"HUYAVIDEO.VideoData"}', mm.index);
        var raw = endIdx > 0 ? seg.substring(mm.index, endIdx + 40) : seg.substring(mm.index, mm.index + 3000);
        var title = unescapeJson(extractStr(raw, "videoTitle")) || "";
        var dur = extractStr(raw, "duration") || "";
        var coverM = raw.match(/"cover":"([^"]+)"/);
        var cover = coverM ? unescapeJson(coverM[1]) : "";
        if (cover && cover.indexOf("http") !== 0) cover = "https:" + cover;
        var desc = [];
        if (dur) desc.push("时长 " + dur);
        desc.push("回放 " + vid);
        out.push({
            id: HUYA_VIDEO_PREFIX + vid,
            type: "url",
            title: (title || "虎牙回放 " + vid).slice(0, 80),
            coverUrl: cover || "",
            link: HUYA_VIDEO_PREFIX + vid,
            mediaType: "movie",
            description: desc.join("  ")
        });
        try { Widget.storage.set("huya_video_" + vid, JSON.stringify({ title: (title || "虎牙回放 " + vid).slice(0, 80), cover: cover || "" })); } catch (e) {}
    }
    return out;
}

// 解析主播主页 userInfo 段（GetUserPageBaseInfoRsp.userInfo）：nick/avatar/roomId/isLiving/intro
function parseUserPageBase(init) {
    var base = { nick: "", avatar: "", roomId: "", isLiving: "0", intro: "" };
    if (!init) return base;
    var i = init.indexOf('"userInfo":{');
    if (i < 0) return base;
    var end = init.indexOf('"_classname":"HUYAVIDEO.UserPageBaseInfo"', i);
    var seg = end > 0 ? init.substring(i, end) : init.substring(i, i + 2000);
    base.nick = unescapeJson(extractStr(seg, "nick")) || "";
    var av = unescapeJson(extractStr(seg, "avatar")) || "";
    if (av && av.indexOf("http") !== 0) av = "https:" + av;
    base.avatar = av;
    var rm = seg.match(/"roomId":(\d+)/);
    base.roomId = rm ? rm[1] : "";
    var lm = seg.match(/"isLiving":(\d+)/);
    base.isLiving = lm ? lm[1] : "0";
    base.intro = unescapeJson(extractStr(seg, "intro")) || "";
    return base;
}

// 抓取主播个人主页：先取 uid（房间页 HNF lUid），再抓视频主页 SSR
// 返回 { base: userInfo(正在直播信息), records: 直播回放列表, videos: 视频列表 }
// v2.12：同时请求「视频」tab（默认）与「直播录像」tab，
//        回放条目走 userPageLiveRecordVideoRsp；带时间戳绕过缓存（数据中心 IP 偶发空壳）。
// v2.21：m.huya.com 提取 lUid 失败（客户端环境被反爬/空壳）时，自动切 www.huya.com
//        备用通道再提取一次，主播主页不再空白。
// v2.24.2：两个 tab 均使用 pageIndex 翻页；page 参数会被虎牙忽略并重复返回第一页。
async function fetchAnchorProfile(rid, page) {
    var pageIndex = page || 1;
    var uid = "";
    try {
        // v2.29.0：房间页抓取同样加 4 秒超时兜底，避免移动网络下页面慢拖住详情
        var resp = await withTimeout(Widget.http.get("https://m.huya.com/" + rid, { timeout: 6000, headers: {
            "User-Agent": HUYA_M_UA,
            "Referer": HUYA_M_REFERER + rid
        } }), 4000);
        uid = extractRoomUid(String(resp.data || ""));
    } catch (e) {
        console.error("huya anchor uid failed:", e);
    }
    if (!uid) {
        try {
            var respPc = await Widget.http.get("https://www.huya.com/" + rid, { timeout: 6000, headers: {
                "User-Agent": HUYA_UA,
                "Referer": "https://www.huya.com/"
            } });
            uid = extractRoomUid(String(respPc.data || ""));
        } catch (e2) {
            console.error("huya anchor uid pc fallback failed:", e2);
        }
    }
    if (!uid) return { base: null, records: [], videos: [] };

    var ts = Date.now();
    var ts2 = ts + 1;
    // 视频 tab：按 pageIndex 请求对应页的 userPageVideoLisRsp
    var videoReq = Widget.http.get("https://www.huya.com/video/u/" + uid + "?pageIndex=" + pageIndex + "&_=" + ts, { timeout: 6000, headers: {
        "User-Agent": HUYA_UA,
        "Referer": "https://www.huya.com/video/u/" + uid
    } }).then(function (r) {
        var html = String(r.data || "");
        var m = html.match(/window\.HNF_GLOBAL_INIT\s*=\s*([\s\S]*?)<\/script>/);
        if (!m || !m[1]) return { base: null, records: [], videos: [] };
        var init = m[1];
        return { base: parseUserPageBase(init), records: [], videos: parseVideoList(init) };
    }).catch(function (e) {
        console.error("huya anchor profile video failed:", e);
        return { base: null, records: [], videos: [] };
    });
    // 回放 tab：按 pageIndex 请求对应页的 userPageLiveRecordVideoRsp
    var recordReq = Widget.http.get("https://www.huya.com/video/u/" + uid + "?tabName=live&pageIndex=" + pageIndex + "&_=" + ts2, { timeout: 6000, headers: {
        "User-Agent": HUYA_UA,
        "Referer": "https://www.huya.com/video/u/" + uid
    } }).then(function (r2) {
        var html2 = String(r2.data || "");
        var m2 = html2.match(/window\.HNF_GLOBAL_INIT\s*=\s*([\s\S]*?)<\/script>/);
        if (!m2 || !m2[1]) return [];
        return parseLiveRecordList(m2[1]);
    }).catch(function (e) {
        console.error("huya anchor profile record failed:", e);
        return [];
    });

    var vRes = await videoReq;
    var recs = await recordReq;
    return { base: vRes.base, records: recs, videos: vRes.videos };
}

// 视频取流：getMomentContent 返回多清晰度 mp4 直链，选最高清并强制 https
async function resolveVideoMp4(vid) {
    var url = "https://liveapi.huya.com/moment/getMomentContent?videoId=" + vid + "&uid=&_=" + Date.now();
    var resp = await Widget.http.get(url, { timeout: 6000, headers: {
        "User-Agent": HUYA_UA,
        "Referer": "https://v.huya.com/"
    } });
    var data = parseJsonLike(resp.data);
    var defs = data && data.data && data.data.moment && data.data.moment.videoInfo ? data.data.moment.videoInfo.definitions : null;
    if (!defs || !defs.length) return "";
    var u = defs[0].url || "";
    if (u.indexOf("http://") === 0) u = "https://" + u.slice(7);
    if (u.indexOf("//") === 0) u = "https:" + u;
    return u;
}

// ---------------- 模块实现 ----------------

// 热门直播
async function loadHotList(params) {
    var page = (params && params.page) ? params.page : 1;
    // 详情页分类/演员回调：统一处理，避免报"组件不支持演员过滤"
    var filtered = await handleFilterCall(params, page);
    if (filtered) return filtered;
    var rooms = await fetchLiveRooms("0", page);
    var items = [];
    for (var i = 0; i < rooms.length; i++) {
        var it = normalizeRoom(rooms[i]);
        if (it) items.push(it);
    }
    if (items.length === 0) {
        throw new Error("热门列表加载失败：可能被虎牙反爬拦截，请稍后重试或使用「房间号直达」");
    }
    return items;
}

// 分类直播（独立函数写死游戏分类ID，避免客户端枚举参数不支持）
async function loadCategoryRooms(gid, page) {
    var rooms = await fetchLiveRooms(gid, page);
    var items = [];
    for (var i = 0; i < rooms.length; i++) {
        var it = normalizeRoom(rooms[i]);
        if (it) items.push(it);
    }
    if (items.length === 0) {
        throw new Error("该分类暂无直播或分类编号已调整，请换其他分类试试");
    }
    return items;
}

// 分类直播（枚举参数版）：客户端会把 enumeration 参数渲染成模块内右上角
// 分类切换菜单；函数按 params.gameId 请求对应游戏分类，缺省为全部热门
    // 45+1 分类映射（title -> 虎牙 gid），供详情页分类标签(genreId)过滤回查
    var CAT_LIST = [["全部热门","0"], ["娱乐","100022"], ["手游休闲","100004"], ["网游竞技","100023"], ["星秀","1663"], ["一起看","2135"], ["主机游戏","100032"], ["王者荣耀","2336"], ["英雄联盟","1"], ["摸了个鱼","9283"], ["一起玩","6613"], ["交友","4079"], ["吃喝玩乐","100044"], ["互动点播","5907"], ["lol云顶之弈","5485"], ["单机热游","100002"], ["互动组队","5367"], ["和平精英","3203"], ["户外","2165"], ["原创","6861"], ["新游广场","100052"], ["虎牙文化","4089"], ["三角洲行动","9449"], ["我的世界","1732"], ["体育","2356"], ["暴雪专区","100043"], ["MMORPG","100273"], ["二次元","2633"], ["英雄联盟手游","6203"], ["综合手游","100029"], ["穿越火线","4"], ["天天吃鸡","2793"], ["冒险岛","2243"], ["英雄联盟电竞经理","7177"], ["棋牌休闲","100301"], ["炉石传说","393"], ["金铲铲之战","7185"], ["射击综合游戏","100141"], ["第五人格","3115"], ["动作游戏","100197"], ["永劫无间","6219"], ["魔兽世界","8"], ["原神","5489"], ["军事游戏","100133"], ["王者万象棋","8127"], ["桌游","100305"]];


// 统一处理详情页分类/演员过滤回调（README 协议：客户端回到当前条目所属的列表模块，
// 把 genreId/peopleId 传回 params）。所有列表模块开头先调用它，防止报"组件不支持演员过滤"。
// - peopleId 形如 huya_<rid> → 主播个人主页（正在直播 + 直播回放 + 主播视频，标题前缀分区）
// - genreId 为分类名 → 打开对应分类列表
// - 无回调返回 null，调用方继续原逻辑
async function handleFilterCall(params, page) {
    var pid = (params && params.peopleId !== undefined && params.peopleId !== null) ? String(params.peopleId) : "";
    if (pid && pid.indexOf("huya_") === 0) {
        var rid = pid.slice(5).replace(/[^0-9]/g, "").trim();
        if (rid) {
            var profilePage = Math.max(1, parseInt(page, 10) || 1);
            var profile = await fetchAnchorProfile(rid, profilePage);
            // v2.19：Emby 语义——主播主页返回的每条作品都必须带匹配的 peoples（id 与点击的
            // 演员行一致），否则客户端校验"返回列表里是否存在带该 peopleId 的条目"失败，
            // 会弹"组件不支持演员过滤"（v2.17 即因返回条目未带 peoples 而弹窗）。
            var anchorPeoples = [];
            if (profile && profile.base && profile.base.nick) {
                anchorPeoples = [{
                    id: pid,
                    title: String(profile.base.nick),
                    avatar: profile.base.avatar || "",
                    role: "主播"
                }];
            }
            var items = [];
            // 第一块：正在直播只在第一页展示，避免每次翻页都重复追加直播间
            if (profilePage === 1 && profile && profile.base && Number(profile.base.isLiving) === 1) {
                var liveRoomId = profile.base.roomId || rid;
                var liveTitle = "正在直播：" + (profile.base.nick || ("直播间 " + liveRoomId));
                var liveItem = {
                    id: String(liveRoomId),
                    type: "url",
                    title: "【直播】" + liveTitle,
                    coverUrl: profile.base.avatar || "",
                    link: String(liveRoomId),
                    mediaType: "tv",
                    description: "主播正在直播，点击进入直播间"
                };
                if (anchorPeoples.length) liveItem.peoples = anchorPeoples;
                items.push(liveItem);
                cacheRoomDetail(String(liveRoomId), liveTitle, profile.base.avatar || "", profile.base.nick || "", "", 0, profile.base.avatar || "");
            }
            // 第二块：直播回放（v2.12 新增）
            var rlist = (profile && profile.records) ? profile.records : [];
            for (var ri = 0; ri < rlist.length; ri++) {
                var rIt = rlist[ri];
                rIt.title = "【回放】" + rIt.title;
                if (anchorPeoples.length) rIt.peoples = anchorPeoples;
                items.push(rIt);
            }
            // 第三块：主播视频
            var vlist = (profile && profile.videos) ? profile.videos : [];
            for (var vi = 0; vi < vlist.length; vi++) {
                var vIt = vlist[vi];
                vIt.title = "【视频】" + vIt.title;
                if (anchorPeoples.length) vIt.peoples = anchorPeoples;
                items.push(vIt);
            }
            if (items.length === 0) {
                // 后续页无作品是正常结束，返回空列表让客户端的 hasMore 变为 false
                if (profilePage > 1) return [];
                // v2.21：区分「主页拉取失败」（base 与回放/视频全空）与「确实无内容」
                var profEmpty = !profile || (!profile.base && (!profile.records || profile.records.length === 0) && (!profile.videos || profile.videos.length === 0));
                if (profEmpty) {
                    throw new Error("主播主页拉取失败（可能被虎牙拦截），请稍后重试或切换网络再试");
                }
                throw new Error("该主播暂未开播且暂无回放/视频，请稍后再看");
            }
            return items;
        }
    }
    var gidText = (params && params.genreId !== undefined && params.genreId !== null) ? String(params.genreId) : "";
    if (gidText) {
        for (var i = 0; i < CAT_LIST.length; i++) {
            if (CAT_LIST[i][0] === gidText) return loadCategoryRooms(CAT_LIST[i][1], page);
        }
        return loadCategoryRooms("0", page);
    }
    return null;
}

async function loadCategoryList(params) {
    var page = (params && params.page) ? params.page : 1;

    // 详情页分类/演员回调：统一处理，避免报"组件不支持演员过滤"
    var filtered = await handleFilterCall(params, page);
    if (filtered) return filtered;

    var gid = (params && params.gameId !== undefined && params.gameId !== null && params.gameId !== "") ? String(params.gameId) : "0";
    return loadCategoryRooms(gid, page);
}

// v2.37.0：参照 bilibili 组件的 roomIdOf——从「房间号 / 虎牙直播间链接」
// 精确解析房间号。支持 www.huya.com / m.huya.com / y.huya.com / huya.com
// 的直播间链接与纯数字；链接带其它数字参数也不会污染房间号。
function huyaRoomIdOf(x) {
    x = String(x || "").trim();
    if (!x) return "";
    var m = x.match(/(?:https?:\/\/)?(?:www\.|m\.|y\.)?huya\.com\/(\d+)/i);
    if (m) return m[1];
    if (/^\d{1,12}$/.test(x)) return x;
    return "";
}

async function loadRoomById(params) {
    // 详情页演员回调（房间详情点主播行时客户端也会回到本模块）。
    // v2.33.0：页码改读 params.page，避免从「房间号直达」进主播主页后
    // 下滑翻页回调仍写死第 1 页 → 永远刷新回第一个（历史红线）。
    var filtered = await handleFilterCall(params, (params && params.page) ? params.page : 1);
    if (filtered) return filtered;
    var ridRaw = (params && params.roomid) || (params && params.peopleId ? String(params.peopleId).replace(/^huya_/, "") : "");
    // v2.37.0：用 huyaRoomIdOf 精确解析，支持直接粘贴虎牙直播间链接
    var rid = huyaRoomIdOf(ridRaw);
    if (!rid) {
        throw new Error("请输入有效的虎牙房间号（纯数字或 huya.com 直播间链接，如 666888）");
    }
    var item = {
        id: rid,
        type: "url",
        title: "虎牙房间 " + rid,
        coverUrl: "",
        link: rid,
        mediaType: "tv",
        description: "房间号 " + rid + "，点击播放（开播才可看）"
    };
    cacheRoomDetail(rid, "虎牙房间 " + rid, "", "", "", 0);
    return [item];
}

// 搜索主播：解析虎牙搜索页
async function search(params) {
    // 详情页演员回调（搜索结果详情点主播行时客户端也会回到本模块）
    var filtered = await handleFilterCall(params, 1);
    if (filtered) return filtered;
    var kw = String((params && params.keyword) || "").trim();
    if (!kw) {
        throw new Error("请输入搜索关键词");
    }
    // v2.37.0：参照 bilibili 组件 search 的房间号直达——关键词若是房间号
    // 或虎牙直播间链接，直接进房间，不再空跑搜索接口（接口对纯数字常无结果）。
    var ridDirect = huyaRoomIdOf(kw);
    if (ridDirect) {
        return loadRoomById({ roomid: ridDirect });
    }
    var url = "https://search.cdn.huya.com/?m=Search&do=getSearchContent&q=" + encodeURIComponent(kw) + "&uid=0&v=4&rows=50&typ=-5&livestate=0";
    var headers = {
        "User-Agent": HUYA_UA,
        "Referer": HUYA_REFERER
    };
    var resp = await Widget.http.get(url, { timeout: 6000, headers: headers });
    var raw = String(resp.data || "");
    var json = null;
    var jm = raw.match(/\{[\s\S]*\}/);
    if (jm) {
        try { json = JSON.parse(jm[0]); } catch (e) { json = null; }
    }
    if (!json || !json.response) {
        throw new Error("搜索接口无响应，请稍后重试");
    }

    var items = [];
    var seen = {};
    // v2.16：虎牙搜索数据接口返回分组结果，group "1"=直播房间（字段最全），group "3"=补充房间
    var groups = ["1", "3"];
    for (var gi = 0; gi < groups.length; gi++) {
        var gResp = json.response[groups[gi]];
        var docs = (gResp && gResp.docs) || [];
        for (var di = 0; di < docs.length && items.length < 50; di++) {
            var d = docs[di] || {};
            var rid = String(d.room_id || "").trim();
            if (!rid || seen[rid]) continue;
            seen[rid] = 1;
            var nick = String(d.game_nick || "").trim();
            var live = d.gameLiveOn === true || d.gameLiveOn === 1;
            var game = String(d.game_name || "").trim();
            var intro = String(d.live_intro || "").trim();
            var cover = String(d.game_avatarUrl180 || "");
            if (cover && cover.indexOf("http") !== 0) cover = "https:" + cover;
            // v2.24.6：搜索列表标题位同样改用房间号，主播名放入描述行
            var title = "房间 " + rid;
            if (live) title = "【直播中】" + title;
            title = title.slice(0, 60);
            var desc = "";
            if (nick) desc += "主播：" + nick;
            if (game) desc += (desc ? " | " : "") + "分类：" + game;
            desc += live ? " | 直播中" : " | 未开播";
            if (intro) desc += " | " + intro.slice(0, 40);
            if (!desc) desc = "房间号：" + rid;
            items.push({
                id: rid,
                type: "url",
                title: title,
                coverUrl: cover,
                link: rid,
                mediaType: "tv",
                description: desc
            });
            cacheRoomDetail(rid, title, cover, nick || "", "", 0);
        }
    }

    if (items.length === 0) {
        throw new Error("没有找到相关主播，可尝试直接输入房间号直达（如 666888）");
    }
    return items;
}

// 详情加载：客户端点击直播间后调用，优先用缓存补全房间信息
// v1.6：详情项必须带可播放地址，否则客户端详情页提示"没有能播放的地址/播放源"。
// 这里用公共代理 302 URL 作为静态兜底地址（不过期），真正起播时客户端会调用
// loadResource 拿到签名直链（更稳、可多线路切换）。
// v2.0：缓存信息不全时抓移动房间页解析真实标题（sNick）、封面（sScreenshot）、
// 分类（sGameFullName）、简介（sIntroduction）、主播头像（sAvatar180）；
// 标题不再显示"虎牙房间 xxx"，房间号移入简介；背景图与封面一致；
// 详情页补 Emby 风格字段：genreItems（分类标签）、peoples（主播行）、posterPath（海报位）。
// v2.19：peoples 演员行已恢复——弹窗根因是客户端回调校验"返回列表是否带匹配 peopleId 的
// 条目"失败（详见 handleFilterCall），渲染演员行本身不会弹窗。
async function loadDetail(link) {
    // 主播视频条目详情：link 形如 huya_video_<vid>，经 getMomentContent 取 mp4 直链
    var linkStr = String(link || "");
    if (linkStr.indexOf(HUYA_VIDEO_PREFIX) === 0) {
        var vidV = linkStr.slice(HUYA_VIDEO_PREFIX.length).replace(/[^0-9]/g, "").trim();
        if (vidV) {
            var vCache = null;
            try {
                var vc = Widget.storage.get("huya_video_" + vidV);
                if (vc) vCache = (typeof vc === "string") ? JSON.parse(vc) : vc;
            } catch (e) {}
            var vTitle = (vCache && vCache.title) ? vCache.title : ("虎牙视频 " + vidV);
            var vCover = (vCache && vCache.cover) ? vCache.cover : "";
            var vItem = {
                id: linkStr,
                type: "url",
                title: vTitle,
                link: linkStr,
                mediaType: "movie",
                playerType: "app",
                description: "主播视频，点击播放"
            };
            if (vCover) {
                vItem.coverUrl = vCover;
                vItem.posterPath = vCover;
                vItem.detailPoster = vCover;
                vItem.backdropPath = vCover;
                vItem.backdropPaths = [vCover];
            }
            try {
                var vMp4 = await resolveVideoMp4(vidV);
                if (vMp4) {
                    vItem.videoUrl = vMp4;
                    vItem.description = "主播视频直链已就绪，点击播放";
                } else {
                    vItem.description = "视频直链暂不可用，请稍后重试";
                }
            } catch (e) {
                vItem.description = "视频直链暂不可用，请稍后重试";
            }
            return vItem;
        }
    }
    var rid = String(link || "").replace(/[^0-9]/g, "").trim();
    if (!rid) {
        return null;
    }

    // 必须在启动任何异步请求前检查缓存，QuickJS 不会让未等待的宿主请求后台运行。
    var cachedProxy = readProxyCache(rid);
    var cachedDetail = readTimedCache("huya_detail_opt_" + rid, 30000);
    if (cachedProxy && cachedDetail && cachedDetail.id === rid) {
        cachedDetail.videoUrl = cachedProxy;
        // v2.37.1：代理直链必须带网页请求头 + Skip-Probe，否则裸拉流 403
        cachedDetail.customHeaders = {
            "User-Agent": HUYA_UA,
            "Referer": HUYA_REFERER,
            "X-Forward-Skip-Redirect-Probe": "1"
        };
        return cachedDetail;
    }
    // 仍保证首次进入拿到 videoUrl；取流与元数据共享同一个小程序请求。
    var streamP = pickStreamUrl(rid).catch(function () { return null; });
    var mpInfoP = fetchMpRoomInfo(rid);

    var info = readRoomDetail(rid);
    var title = (info && info.title) ? info.title : "";
    var cover = (info && info.cover) ? info.cover : "";
    var nick = (info && info.nick) ? info.nick : "";
    var game = (info && info.game) ? info.game : "";
    var avatar = (info && info.avatar) ? info.avatar : "";
    // v2.22：房间精确游戏分类ID（iGid），相似直播间推荐优先用它拉同分类
    var gid = (info && info.gid) ? String(info.gid).replace(/[^0-9]/g, "").trim() : "";
    var intro = "";

    // v2.32.0：mp 接口房间信息（毫秒级）优先覆盖缓存；接口失败才走下方 m 页兜底
    var mpInfo = null;
    try { mpInfo = await mpInfoP; } catch (e) { mpInfo = null; }
    if (mpInfo) {
        if (mpInfo.title) title = mpInfo.title;
        if (mpInfo.cover) cover = mpInfo.cover;
        if (mpInfo.nick) nick = mpInfo.nick;
        if (mpInfo.game) game = mpInfo.game;
        if (mpInfo.gid) gid = String(mpInfo.gid).replace(/[^0-9]/g, "").trim();
        if (mpInfo.intro) intro = mpInfo.intro;
        if (mpInfo.avatar) avatar = mpInfo.avatar;
        if (cover && cover.indexOf("http") !== 0) cover = "https:" + cover;
        if (avatar && avatar.indexOf("http") !== 0) avatar = "https:" + avatar;
    }

    // 缓存信息不全，或标题疑似主播名/房间号/拼接兜底时，抓移动房间页解析真实直播间标题
    // v2.36.0：标题缺失/兜底时无条件抓 m 页覆盖真实标题（mp 接口 roomName 字段恒空，
    //       若沿用"mpInfo 非空即跳过"会永远显示房间号兜底标题）；
    //       其余字段缺失时仍仅在 mp 接口失败时才兜底（避免重复抓取）。
    // v2.36.0：兜底判定同时覆盖"虎牙房间 xxx"（详情页自身兜底写法），
    //       否则标题停在房间号永远不会触发重抓。
    var titleIsFallback = (title && (title === nick || / 直播$/.test(title) || /^房间 /.test(title) || /^虎牙房间 /.test(title))) ? true : false;
    // roomName 为空时，原 HTML 路径最终也使用 sIntroduction；直接使用同源字段。
    if ((!title || titleIsFallback) && intro) {
        title = intro;
        titleIsFallback = false;
    }
    if (!title || titleIsFallback || ((!cover || !nick || !game || !gid) && !mpInfo)) {
        try {
            // 实际 HTTP 超时，不依赖宿主未提供的 setTimeout/clearTimeout。
            var resp = await Widget.http.get("https://m.huya.com/" + rid, { timeout: 2000, headers: {
                "User-Agent": HUYA_M_UA,
                "Referer": HUYA_M_REFERER + rid
            } });
            var html = String(resp.data || "");
            var initM = html.match(/window\.HNF_GLOBAL_INIT\s*=\s*([\s\S]*?)<\/script>/);
            if (initM && initM[1]) {
                var init = initM[1];
                // v2.36.0：优先 JSON 解析 HNF_GLOBAL_INIT 取 roomInfo.tLiveInfo——
                //       正则 extractStr 的 sTitle 会命中主播动态（momentInfoList）标题，
                //       且"房间号兜底"匹配不全；JSON 主路径取字段最干净。
                var initObj = null;
                try { initObj = JSON.parse(init); } catch (e) { initObj = null; }
                var tLive = (initObj && initObj.roomInfo && initObj.roomInfo.tLiveInfo) || null;
                if (tLive) {
                    // Emby 语义：标题取直播间标题（sRoomName / sTitle），主播名（sNick）只进 peoples
                    var roomTitle = tLive.sRoomName || tLive.sTitle || "";
                    if (roomTitle) title = roomTitle;
                    // 直播间确实无标题（sRoomName/sTitle 均空）时，标题位回落简介而非房间号兜底
                    if (!roomTitle && (!title || titleIsFallback)) title = tLive.sIntroduction || "";
                    if (!title) title = tLive.sIntroduction || "";
                    if (!cover) cover = tLive.sScreenshot || "";
                    if (!game) game = tLive.sGameFullName || "";
                    if (!intro) intro = tLive.sIntroduction || "";
                    if (!avatar) avatar = (initObj.roomInfo.tProfileInfo && initObj.roomInfo.tProfileInfo.sAvatar180) || tLive.sAvatar180 || "";
                    // v2.22：房间页 roomInfo 段 iGid 为房间精确分类ID（如主机游戏=1964），
                    // 比 CAT_LIST 名称映射更可靠，相似直播间推荐优先用它
                    if (!gid && tLive.iGid) gid = String(tLive.iGid).replace(/[^0-9]/g, "").trim();
                    // 主播名只进 peoples：抓取到 sNick 且标题曾被主播名/搜索标题污染时，用真实主播名覆盖 nick
                    var realNick = (initObj.roomInfo.tProfileInfo && initObj.roomInfo.tProfileInfo.sNick) || tLive.sNick || "";
                    if (realNick && (!nick || titleIsFallback)) nick = realNick;
                    if (cover && cover.indexOf("http") !== 0) cover = "https:" + cover;
                    if (avatar && avatar.indexOf("http") !== 0) avatar = "https:" + avatar;
                } else {
                    // 旧正则兜底：JSON 解析失败时再按 key 提取（仅 roomInfo 段，避免动态区污染）
                    var roomSeg = init.indexOf("roomInfo") >= 0 ? init.substring(init.indexOf("roomInfo")) : init;
                    var roomTitle2 = unescapeJson(extractStr(roomSeg, "sRoomName"));
                    if (roomTitle2) title = roomTitle2;
                    if (!cover) cover = unescapeJson(extractStr(init, "sScreenshot"));
                    if (!game) game = unescapeJson(extractStr(init, "sGameFullName"));
                    if (!intro) intro = unescapeJson(extractStr(init, "sIntroduction"));
                    if (!avatar) avatar = unescapeJson(extractStr(init, "sAvatar180"));
                    if (!gid) gid = extractNum(roomSeg, "iGid");
                    if (!gid) gid = extractNum(init, "iGid");
                    var realNick2 = unescapeJson(extractStr(roomSeg, "sNick"));
                    if (!realNick2) realNick2 = unescapeJson(extractStr(init, "sNick"));
                    if (realNick2 && (!nick || titleIsFallback)) nick = realNick2;
                    if (cover && cover.indexOf("http") !== 0) cover = "https:" + cover;
                    if (avatar && avatar.indexOf("http") !== 0) avatar = "https:" + avatar;
                }
            }
        } catch (e) {
            console.error("huya detail page fetch failed:", e);
        }
    }

    // v2.32.0：相似推荐与取流/房间信息并行发起，不再等详情组装完才请求列表接口
    var simGid = gid;
    if (!simGid && game) {
        for (var sciSim = 0; sciSim < CAT_LIST.length; sciSim++) {
            if (CAT_LIST[sciSim][0] === game) { simGid = CAT_LIST[sciSim][1]; break; }
        }
    }
    var simP = fetchLiveRooms(simGid || "0", 1, true);

    if (!title) title = "虎牙房间 " + rid;

    var desc = ["房间号：" + rid];
    if (nick) desc.push("主播：" + nick);
    if (game) desc.push("分类：" + game);
    if (intro) desc.push(intro);
    if (desc.length === 1) desc.push("虎牙直播间，点击播放（开播才可看）");

    var item = {
        id: rid,
        type: "url",
        title: title,
        link: rid,
        mediaType: "tv",
        playerType: "app",
        description: desc.join("  ")
    };
    // 保留代理优先和 mp 兜底；未命中缓存时等取流完成，保证客户端能显示播放资源。
    // v2.37.1：对齐 bilibili 组件——videoUrl 与 customHeaders 一起挂到详情项，
    // 播放器直接拉流时带上正确 UA/Referer/Skip-Probe，避免裸请求 403。
    try {
        var picked = await streamP;
        if (picked && picked.url) {
            item.videoUrl = picked.url;
            if (picked.customHeaders) item.customHeaders = picked.customHeaders;
        }
    } catch (e) {
        console.error("huya detail stream failed:", e);
    }
    if (cover) {
        item.coverUrl = cover;
        item.posterPath = cover;
        item.detailPoster = cover;
        item.backdropPath = cover;
        item.backdropPaths = [cover];
    }
    if (game) {
        item.genreTitle = game;
        // Emby 风格：详情页分类标签
        item.genreItems = [{ id: String(game), title: String(game) }];
    }
    if (nick) {
        // v2.19：恢复详情页演员行（Emby 风格 peoples 主播表）。
        // 弹窗根因已定位：客户端点演员后回调列表模块校验返回列表里是否存在带该 peopleId 的
        // 条目（官方 demo 的 hasPeople 语义）；v2.17 返回的主播主页条目未带 peoples 导致
        // 校验失败弹窗。v2.19 起主播主页每条作品都补齐匹配 peoples，校验通过不再弹窗。
        item.peoples = [{
            id: "huya_" + rid,
            title: String(nick),
            avatar: avatar || "",
            role: "主播"
        }];
    }
    if (info && info.online) item.rating = String(info.online);

    // v2.22：相关推荐区「相似直播间」——优先用房间精确 iGid 拉同分类直播（排除当前房间
    // 取前 8 条）；iGid 缺失时回退 CAT_LIST 名称匹配，再退热门兜底。
    // 不再内嵌主播个人三块（三块只走详情页演员行进入）。
    try {
        // v2.32.0：simP 已在详情组装前并行发起，此处直接取结果
        var simRooms = await simP;
        var simItems = [];
        for (var si = 0; si < simRooms.length && simItems.length < 8; si++) {
            var sim = normalizeRoom(simRooms[si]);
            if (!sim) continue;
            if (String(sim.id) === String(rid)) continue;
            simItems.push(sim);
        }
        if (simItems.length) {
            item.relatedItems = simItems;
        }
    } catch (e) {
        console.error("huya similar rooms failed:", e);
    }
    // 只有可复用代理直链才缓存完整详情；mp 兜底签名每次重新请求。
    if (isReusableProxyUrl(item.videoUrl)) {
        writeTimedCache("huya_detail_opt_" + rid, item);
    }
    return item;
}

// 解析房间页 HTML 中的 HNF_GLOBAL_INIT，产出签名 m3u8 线路
// v2.0：收集全部 CDN（HS/AL/TX）不再只取第一条，HS https 已实测可用；
//       liveLineUrl 解码地址同样强制升 https；播放器按 https 优先排序尝试。
// v2.24.7：仅收集 HS 线路（AL/TX 实测全线 403，避免播放器尝试后报错）。
function parseRoomStreams(html, ref) {
    var out = [];
    if (!html) return out;
    var initM = html.match(/window\.HNF_GLOBAL_INIT\s*=\s*([\s\S]*?)<\/script>/);
    if (!initM || !initM[1]) return out;
    var init = initM[1];

    // vStreamInfo 构造直链：仅 HS（AL/TX 已被 CDN 全线 403）
    var cdnTypes = ["HS"];
    for (var k = 0; k < cdnTypes.length; k++) {
        var streamUrl = buildStreamUrl(init, cdnTypes[k]);
        if (streamUrl) {
            out.push({
                name: cdnTypes[k] + "线路",
                description: "官方页面解析签名 m3u8 (https)",
                url: streamUrl,
                customHeaders: {
                    "User-Agent": HUYA_M_UA,
                    "Referer": ref
                },
                playerType: "app"
            });
        }
    }

    // liveLineUrl（base64 已签名直链）
    var ll = extractStr(init, "liveLineUrl");
    if (ll) {
        var decoded = unescapeJson(base64Decode(ll));
        if (decoded) {
            if (decoded.indexOf("//") === 0) decoded = "https:" + decoded;
            if (decoded.indexOf("http://") === 0) decoded = "https://" + decoded.slice(7);
            out.push({
                name: "官方直链",
                description: "liveLineUrl 解码 m3u8 (https)",
                url: decoded,
                customHeaders: {
                    "User-Agent": HUYA_M_UA,
                    "Referer": ref
                },
                playerType: "app"
            });
        }
    }
    return out;
}

// 动态取流：抓移动房间页解析 HNF_GLOBAL_INIT 构造签名 m3u8 直链
// 线路优先级：vStreamInfo(HS/AL/TX) -> liveLineUrl(base64) -> 桌面页重试 -> 公共代理兜底
// v1.6：m3u8 属 HLS 稳定直链，不加 X-Forward-Skip-Redirect-Probe（官方规范仅用于 FLV/一次性签名）
async function loadResource(params) {
    var linkStr = String(params.link || params.id || params.videoUrl || "");
    // 主播视频：link 形如 huya_video_<vid>，取 mp4 直链
    if (linkStr.indexOf(HUYA_VIDEO_PREFIX) === 0) {
        var vidV = linkStr.slice(HUYA_VIDEO_PREFIX.length).replace(/[^0-9]/g, "").trim();
        if (vidV) {
            var mp4V = await resolveVideoMp4(vidV);
            if (!mp4V) throw new Error("视频直链获取失败，请稍后重试");
            return [{
                name: "虎牙视频",
                description: "mp4 直链 (https)",
                url: mp4V,
                customHeaders: { "User-Agent": HUYA_UA, "Referer": "https://v.huya.com/" },
                playerType: "app"
            }];
        }
    }
    var rid = String(params.link || params.id || params.videoUrl || "").replace(/[^0-9]/g, "").trim();
    if (!rid) {
        throw new Error("缺少房间号");
    }

    var cachedProxy = readProxyCache(rid);
    if (cachedProxy) {
        return [{
            name: "代理直链",
            description: "公共代理 HLS m3u8 (https 可复用)",
            url: cachedProxy,
            customHeaders: {
                "User-Agent": HUYA_UA,
                "Referer": HUYA_REFERER,
                "X-Forward-Skip-Redirect-Probe": "1"
            },
            playerType: "app"
        }];
    }

    var resources = [];
    var ref = HUYA_M_REFERER + rid;
    var pageHeaders = {
        "User-Agent": HUYA_M_UA,
        "Referer": ref
    };

    // 1) v2.8 优先：微信小程序接口（官方页面 SSR 已空壳、公共代理已失效）
    try {
        // v2.31.0：mp 接口加 6 秒超时，避免起播时请求挂起拖住播放器
        resources = await withTimeout(fetchMpStreams(rid), 6000);
    } catch (e) {
        console.error("huya mp api failed:", e);
    }

    // 1.5) 旧链路兜底：m 页未取到流时，抓 m.huya.com 房间页（部分环境仍可用）
    if (resources.length === 0) {
        try {
            var resp = await Widget.http.get("https://m.huya.com/" + rid, { timeout: 6000, headers: pageHeaders });
            var html = String(resp.data || "");
            resources = parseRoomStreams(html, ref);
        } catch (e) {
            console.error("huya m-page parse failed:", e);
        }
    }

    // 1.6) 仍未取到流时，重试桌面页（部分环境移动页被反爬）
    if (resources.length === 0) {
        try {
            var respD = await Widget.http.get("https://www.huya.com/" + rid, { timeout: 6000, headers: {
                "User-Agent": HUYA_UA,
                "Referer": HUYA_REFERER + rid
            } });
            var htmlD = String(respD.data || "");
            resources = parseRoomStreams(htmlD, HUYA_REFERER + rid);
        } catch (e) {
            console.error("huya www-page parse failed:", e);
        }
    }

    // v2.10：首选 = 代理 302 升 https 直链（v2.6 验证链路，https 可重复请求）；
    //       解析失败才回退代理 URL 整体。mp/SSR 一次性签名直链仍在后面作为备选。
    // v2.34.0：先读详情页后台预取的代理直链缓存（60s 内新鲜），命中直接采用、
    //       不再实时等代理（手机网络下代理常需 4-6 秒）；未命中才实时解析。
    var proxyUrl = HUYA_PROXY + "/" + rid;
    var directHttps = readProxyCache(rid);
    if (!directHttps) {
        // v2.37.2：公共代理已失效，加 4 秒超时避免起播/刷新被代理解析挂住
        try { directHttps = await withTimeout(resolveProxyHls(rid), 4000); } catch (e) {}
    }
    // v2.24：代理直链仅在拿到有效 https m3u8 时加入。
    //        拿不到（代理失效/返回 404.mp4 占位/非 m3u8）直接跳过，
    //        避免播放器跟随 proxyUrl 302 到 http 明文流被 Exo 拦 3003。
    if (directHttps) {
        resources.unshift({
            name: "代理直链",
            description: "公共代理 HLS m3u8 (https 可复用, v2.10)",
            url: directHttps,
            customHeaders: {
                "User-Agent": HUYA_UA,
                "Referer": HUYA_REFERER
            },
            playerType: "app"
        });
    }
    // 2) 兜底：公共代理 302 -> 虎牙 CDN（v2.34.0：已有代理直链时跳过探测，
    //        不再白等代理 URL 返回，起播更快；资源选择结果与 v2.33.0 完全一致）
    if (!directHttps) {
        try {
            var respP = await Widget.http.get(proxyUrl, { timeout: 6000, allow_redirects: false, headers: {
                "User-Agent": HUYA_UA,
                "Referer": HUYA_REFERER
            } });
            var loc = "";
            if (respP && respP.headers) {
                loc = respP.headers.location || respP.headers.Location || respP.headers["location"] || "";
            }
            if (loc && resources.length === 0) {
                // v1.7：优先推送 https 版本（手机播放器常拦截明文 http 流），保留 http 备选
                var httpsLoc = loc;
                if (httpsLoc.indexOf("http://") === 0) {
                    httpsLoc = "https://" + httpsLoc.slice(7);
                }
                resources.push({
                    name: "代理直链",
                    description: "HLS m3u8 (https)",
                    url: httpsLoc,
                    customHeaders: {
                        "User-Agent": HUYA_UA,
                        "Referer": HUYA_REFERER
                    },
                    playerType: "app"
                });
                if (httpsLoc !== loc) {
                    resources.push({
                        name: "代理直链",
                        description: "HLS m3u8 (http)",
                        url: loc,
                        customHeaders: {
                            "User-Agent": HUYA_UA,
                            "Referer": HUYA_REFERER
                        },
                        playerType: "app"
                    });
                }
            }
        } catch (e) {
            console.error("huya proxy direct failed:", e);
        }
    }

    // 3) 最终兜底：代理地址本身（播放器跟随 302）
    if (resources.length === 0) {
        resources.push({
            name: "代理线路",
            description: "公共代理 302 → 虎牙 CDN",
            url: proxyUrl,
            customHeaders: {
                "User-Agent": HUYA_UA,
                "Referer": HUYA_REFERER
            },
            playerType: "app"
        });
    }

    // v2.11：统一给所有签名直链加 Skip-Probe 头，跳过 ExoPlayer 探测。
    // 虎牙签名 m3u8 一次性防重放：探测请求会消耗唯一有效签名，导致正式请求 403 / 播放器跳窗(1002)。
    for (var _i = 0; _i < resources.length; _i++) {
        var _r = resources[_i];
        if (!_r.customHeaders) _r.customHeaders = {};
        _r.customHeaders["X-Forward-Skip-Redirect-Probe"] = "1";
    }

    // v2.27.0：代理直链（tars_wap 可重放签名）提到 HS 之前——HS/mp 直签为一次性
    //       签名，播放器刷新 playlist 必 403，代理直链是当前唯一可稳定刷新的 HLS。
    // v2.26.0：FLV 不再优先（实测 CDN 限流 ~1.2MB 后 EOF 断流，播 6 秒即卡），
    //       HLS m3u8 恢复优先：playlist/分片均可重放，刷新 playlist 不会 403。
    // v1.9：https 线路优先（安卓 ExoPlayer 默认拦截明文 http 流，MPV 不受影响）
    // v2.11：小程序接口 HS 线路排到 AL/TX 之前（AL/TX 常被 403，HS 实测可用）
    // v2.24：HS 提到代理直链之前（EU 代理在国内手机网络不可靠；HS 实测 m3u8+分片均 200）
    resources.sort(function (a, b) {
        var aProxy = String(a.name || "").indexOf("代理直链") === 0 ? 1 : 0;
        var bProxy = String(b.name || "").indexOf("代理直链") === 0 ? 1 : 0;
        var ah = String(a.url || "").indexOf("https:") === 0 ? 1 : 0;
        var bh = String(b.url || "").indexOf("https:") === 0 ? 1 : 0;
        var aHs = String(a.name || "").indexOf("HS") === 0 ? 1 : 0;
        var bHs = String(b.name || "").indexOf("HS") === 0 ? 1 : 0;
        return (bProxy - aProxy) || (bh - ah) || (bHs - aHs);
    });

    return resources;
}

