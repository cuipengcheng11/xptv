// Streama：在组件详情 → 组件配置填写 cookie；空值时兼容原来的模块存储。
const cookie = "";

// 哔哩哔哩直播 ForwardWidget v1.5.1 — Streama 独立 Cookie 配置
// 热门 / 分区 / 房间号直达 / 多画质 HLS·FLV / Cookie 高画质
var WidgetMetadata={
 id:'forward.live.bilibili.v15',
 title:'B站直播·高画质',
 description:'热门直播 / 游戏分类 / 主播搜索 / 频道直达 / Cookie解锁原画4K / 稳定播放(Exo+MPV)',
 author:'ForwardWidget adaptation',
 site:'https://live.bilibili.com',
 version:'1.5.1',
 requiredVersion:'0.0.1',
 detailCacheDuration:5,
 modules:[
  {id:'diagnostics',title:'接口诊断',description:'查看连接状态',functionName:'loadDiagnostics',cacheDuration:0,params:[]},
  {id:'hot',title:'热门直播',functionName:'loadHotList',cacheDuration:30,params:[
   {name:'page',title:'页码',type:'page',value:'1'},
   {name:'peopleId',title:'主播过滤',type:'constant',value:''},
   {name:'genreId',title:'分类过滤',type:'constant',value:''}
  ]},
  {id:'categories',title:'分类直播',functionName:'loadCategoryList',cacheDuration:30,params:[
   {name:'category',title:'分区',type:'enumeration',value:'1',enumOptions:[
    {title:'娱乐',value:'1'},
    {title:'网游',value:'2'},
    {title:'手游',value:'3'},
    {title:'绘画',value:'4'},
    {title:'电台',value:'5'},
    {title:'虚拟主播',value:'9'},
    {title:'生活',value:'10'},
    {title:'学习',value:'11'},
    {title:'赛事',value:'13'}
   ]},
   {name:'page',title:'页码',type:'page',value:'1'}
  ]},
  {id:'channel',title:'频道直达',functionName:'loadChannel',cacheDuration:0,params:[
   {name:'channel',title:'房间号或链接',type:'input'}
  ]},
  {id:'settings',title:'Cookie高画质',functionName:'loadSettings',cacheDuration:0,params:[
   {name:'cookie',title:'粘贴Cookie后点确认/回车保存',type:'input'}
  ]},
  {id:'stream',title:'加载资源',functionName:'loadResource',type:'stream',cacheDuration:0,params:[]}
 ],
 search:{title:'搜索主播',functionName:'search',params:[{name:'keyword',title:'关键词',type:'input'}]}
};

var BI_UA='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
var BI_REFERER='https://live.bilibili.com/';

function str(x){return x==null?'':String(x)}
function json(x){if(x&&typeof x==='object')return x;try{return JSON.parse(str(x))}catch(e){return null}}

function roomIdOf(x){
 x=str(x).trim();
 var m=x.match(/live\.bilibili\.com\/(\d+)/i);
 if(m)return m[1];
 if(/^\d{1,12}$/.test(x))return x;
 return '';
}

async function biGet(url){
 if(!Widget.http||typeof Widget.http.get!=='function')throw Error('宿主不支持 Widget.http.get');
 var headers={'User-Agent':BI_UA,'Referer':BI_REFERER,'Origin':'https://live.bilibili.com'};
 var ck=cookieOf();if(ck)headers['Cookie']=ck;
 var r;
 try{r=await Widget.http.get(url,{timeout:10000,headers:headers})}
 catch(e){throw Error('请求失败: '+String(e&&e.message||e).slice(0,120))}
 var j=json(r&&r.data);
 if(!j)throw Error('非 JSON 响应');
 if(j.code!==0&&j.code!=='0')throw Error(str(j.message||j.msg||('code '+j.code)).slice(0,120));
 return j.data;
}

function cookieOf(){
 if(cookie && cookie.trim())return cookie.trim();
 var c='';
 try{c=Widget.storage.get('bili_cookie')||''}catch(e){}
 if(c)return str(c).trim();
 // 分片读取（单键写不进去时的兜底）
 var parts=[];
 for(var i=0;i<60;i++){
  var v='';
  try{v=Widget.storage.get('bili_cookie_p'+i)||''}catch(e){}
  if(!v)break;
  parts.push(v);
 }
 return parts.join('');
}

function saveCookie(c){
 // 先清理旧键
 try{Widget.storage.set('bili_cookie','')}catch(e){}
 for(var i=0;i<60;i++){
  try{Widget.storage.set('bili_cookie_p'+i,'')}catch(e){}
 }
 // 单键优先（小 Cookie 一次写入）；超长则分片
 var single=true;
 try{Widget.storage.set('bili_cookie',c);var back='';try{back=Widget.storage.get('bili_cookie')||''}catch(e){};if(back===c)return 0}catch(e){single=false}
 if(single)return 0;
 var step=100;
 var idx=0;
 for(var pos=0;pos<c.length;pos+=step){
  try{Widget.storage.set('bili_cookie_p'+idx,c.slice(pos,pos+step))}catch(e){throw Error('分片写入失败')}
  idx++;
 }
 return idx;
}

// 固定探测几个高画质房间，确认 Cookie 是否真正解锁 1080P+
async function probeHighQuality(){
 var targets=[13242941,7734200,545068];
 var lastErr='';
 for(var i=0;i<targets.length;i++){
  try{
   var rid=targets[i];
   var d=await biGet('https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id='+encodeURIComponent(rid)+'&protocol=0,1&format=0,1,2&codec=0,1&qn=10000&platform=web&ptype=8');
   if(!d||d.live_status!==1)continue;
   var pl=d.playurl_info&&d.playurl_info.playurl;
   if(!pl)continue;
   var topQn=0, base='';
   (pl.stream||[]).forEach(function(st){
    (st.format||[]).forEach(function(fmt){
     (fmt.codec||[]).forEach(function(c){
      (c.accept_qn||[]).forEach(function(qn){if(qn>topQn)topQn=qn});
      if(!base&&c.base_url)base=String(c.base_url);
     });
    });
   });
   var desc='';
   (pl.g_qn_desc||[]).forEach(function(q){if(q.qn===topQn)desc=q.desc||''});
   var tag=desc||('qn'+topQn);
   return {ok:topQn>=400,rid:rid,topQn:topQn,tag:tag,base:base};
  }catch(e){lastErr=String(e&&e.message||e).slice(0,80)}
 }
 if(lastErr)throw Error(lastErr);
 throw Error('探测房间均未开播');
}

async function loadSettings(p){
 if(cookie && cookie.trim()){
  return [diagItem('Cookie由组件配置管理','当前运行已读取组件配置中的 Cookie。请在组件详情 → 组件配置修改或清空 cookie，保存后重新打开直播间。')];
 }
 var c=p&&p.cookie?str(p.cookie).trim():'';
 if(c==='clear'||c==='清除'){
  try{Widget.storage.set('bili_cookie','')}catch(e){}
  return [diagItem('Cookie已清除','恢复匿名请求，画质将回到默认限制')];
 }
 if(c){
  // 存储探针：先确认宿主 storage 到底能不能写
  try{Widget.storage.set('bili_probe','ok')}catch(e){}
  var probe='';
  try{probe=Widget.storage.get('bili_probe')||''}catch(e){}
  if(probe!=='ok'){
   return [diagItem('存储不可用','宿主存储读写失败，Cookie 无法持久化。请重启App后重试；若仍失败，请换支持存储的播放器/组件。')];
  }
  var parts=0;
  try{parts=saveCookie(c)}catch(e){return [diagItem('保存失败','写入异常: '+String(e&&e.message||e).slice(0,80))]}
  var saved='';
  try{saved=cookieOf()}catch(e){}
  if(!saved)return [diagItem('保存未生效','已尝试写入但仍读不回，宿主存储对Cookie内容有限制。请重试一次；仍失败请反馈。')];
  var pr=null;
  try{pr=await probeHighQuality()}catch(e){}
  if(pr&&pr.ok)return [diagItem('Cookie已保存 · 实测已解锁','已保存 '+saved.length+' 字符'+(parts?('（分片'+parts+'段）'):'')+'+实测房间 '+pr.rid+' 已能取到高画质线路（'+pr.tag+'），重新打开直播间即可。')];
  return [diagItem('Cookie已保存 · 本次未检出高画质','已保存 '+saved.length+' 字符'+(parts?('（分片'+parts+'段）'):'')+'，探测房间本次未返回高画质；这不等同于 Cookie 无效。请重新打开目标直播间检查可用线路。')];
 }
 var old=cookieOf();
 if(old)return [diagItem('Cookie已设置','当前已保存 '+old.length+' 字符。想更新就输入新Cookie后点确认；输入 clear 清除。')];
 return [diagItem('未设置Cookie','请在上方输入框粘贴B站完整Cookie，然后点确认（或键盘回车）完成保存。保存成功会显示「Cookie已保存」。若输入后没点确认，等于没保存。')];
}

function diagItem(title,desc){
 return {id:'bili_diag',link:'bili_diag',type:'url',mediaType:'movie',title:title,description:desc,coverUrl:'https://i0.hdslb.com/bfs/live/bilibili.png'};
}

async function loadDiagnostics(){
 var reports=[];
 try{await biGet('https://api.live.bilibili.com/room/v1/Room/get_info?room_id=3');reports.push('房间信息 OK')}catch(e){reports.push('房间信息失败')}
 try{var d=await biGet('https://api.live.bilibili.com/room/v3/Area/getRoomList?parent_area_id=1&cate_id=0&area_id=0&sort_type=online&page=1&page_size=5');var n=(d&&d.list||[]).length;reports.push('列表 '+n+' 条')}catch(e){reports.push('列表失败')}
 try{await biGet('https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=3&protocol=0,1&format=0,1,2&codec=0,1&qn=10000');reports.push('播放地址 OK')}catch(e){reports.push('播放地址失败')}
 try{var pr=await probeHighQuality();reports.push(pr.ok?('高画质 已解锁('+pr.tag+')'):'高画质 未解锁')}catch(e){reports.push('高画质 检测失败')}
 var ck=cookieOf();
 if(ck)reports.push('Cookie '+ck.length+' 字符');
 else reports.push('Cookie 未设置');
 var message=reports.join(' · ');
 try{Widget.storage.set('bili_diag_report',message)}catch(e){}
 return [diagItem('诊断结果',message)];
}

function makeItem(r){
 if(!r)return null;
 var rid=str(r.roomid||r.room_id||'');
 if(!rid)return null;
 var title=r.title||r.uname||('房间 '+rid);
 var cover=r.user_cover||r.cover||r.system_cover||r.keyframe||'';
 var uname=r.uname||'';
 var online=r.online||r.watched_show&&r.watched_show.num||0;
 var area=r.area_name||r.area_v2_name||'';
 var desc=(uname?uname+' · ':'')+(area?area+' · ':'')+(online?online+' 人':'');
 var uid=str(r.uid||'');
 var x={
  id:rid,link:rid,type:'url',mediaType:'tv',
  title:title,coverUrl:cover,backdropPath:cover,backdropPaths:cover?[cover]:[],
  description:desc||title,
  // 演员表用 uid，点击进入个人主页
  peoples:uname?[{id:'bili_'+(uid||rid),name:uname,title:uname,avatar:r.face||cover,role:'UP主',link:'user_'+(uid||rid)}]:[]
 };
 if(area){x.genreTitle=area;x.genreItems=[{id:area,title:area}]}
 return x;
}

async function loadHotList(p){
 p=p||{};
 if(p.peopleId)return filterPerson(p.peopleId,p.page);
 if(p.genreId)return loadCategoryList({category:p.genreId,page:p.page});
 var page=Math.max(1,Math.min(20,parseInt(p.page,10)||1));
 // 娱乐分区热门当默认热门
 var d=await biGet('https://api.live.bilibili.com/room/v3/Area/getRoomList?parent_area_id=1&cate_id=0&area_id=0&sort_type=online&page='+page+'&page_size=30');
 var list=d&&d.list||[];
 var items=list.map(makeItem).filter(Boolean);
 if(!items.length){
  if(page>1)return [];
  return [diagItem('无数据','请先跑诊断')];
 }
 return items;
}

async function loadCategoryList(p){
 p=p||{};
 var parent=str(p.category||'1').trim()||'1';
 var page=Math.max(1,Math.min(20,parseInt(p.page,10)||1));
 var d=await biGet('https://api.live.bilibili.com/room/v3/Area/getRoomList?parent_area_id='+encodeURIComponent(parent)+'&cate_id=0&area_id=0&sort_type=online&page='+page+'&page_size=30');
 var list=d&&d.list||[];
 var items=list.map(makeItem).filter(Boolean);
 if(!items.length){
  if(page>1)return [];
  throw Error('该分区暂无直播');
 }
 return items;
}

// 演员表点击 → 同时返回「个人主页」和「直播间」，可任选
async function filterPerson(id,page){
 if((parseInt(page,10)||1)>1)return [];
 var raw=str(id).replace(/^bili_/,'').replace(/^user_/,'').trim();
 if(!raw||!/^\d+$/.test(raw))return [];
 var out=[], uid='', roomId='', master=null;
 try{
  master=await biGet('https://api.live.bilibili.com/live_user/v1/Master/info?uid='+encodeURIComponent(raw));
  if(master&&(master.info||master.room_id)){
   uid=raw;
   roomId=str(master.room_id||'');
  }
 }catch(e){}
 if(!uid){
  try{
   var rid=await resolveRoomId(raw);
   var info=await biGet('https://api.live.bilibili.com/room/v1/Room/get_info?room_id='+encodeURIComponent(rid));
   if(info&&info.uid){
    uid=str(info.uid);
    roomId=rid;
    master=await biGet('https://api.live.bilibili.com/live_user/v1/Master/info?uid='+encodeURIComponent(uid));
   }
  }catch(e){}
 }
 if(uid){try{out.push(await biliUserPage(uid, master))}catch(e){}}
 if(roomId){try{out.push(await biliDetail(roomId))}catch(e){}}
 return out;
}

async function biliUserPage(uid, master){
 master=master||{};
 var mi=master.info||{};
 var uname=mi.uname||('UID '+uid);
 var face=mi.face||'';
 var roomId=str(master.room_id||'');
 var followers=master.follower_num||0;
 var news=(master.room_news&&master.room_news.content)||'';
 var spaceUrl='https://space.bilibili.com/'+uid;
 var desc='B站个人空间 · 粉丝 '+followers;
 if(news)desc+=' · '+str(news).slice(0,40);
 desc+='\n'+spaceUrl;
 var x={
  id:'user_'+uid,
  link:'user_'+uid,
  type:'url',
  mediaType:'movie',
  title:uname+' 的个人主页',
  coverUrl:face,
  backdropPath:face,
  backdropPaths:face?[face]:[],
  posterPath:face,
  detailPoster:face,
  description:desc,
  peoples:[{id:'bili_'+uid,title:uname,avatar:face,role:'UP主',link:'user_'+uid}]
 };
 if(roomId){
  try{
   var info=await biGet('https://api.live.bilibili.com/room/v1/Room/get_info?room_id='+encodeURIComponent(roomId));
   if(info&&info.live_status===1){
    x.description+=' · 直播中 房间 '+roomId;
    try{
     var resources=await qualityResources(roomId);
     if(resources.length){
      x.videoUrl=resources[0].url;
      x.customHeaders=resources[0].customHeaders;
      x.playerType='app';
      x.description+=' · 取流:'+(resources[0].lineType||'已取流');
     }
    }catch(e){}
   }
  }catch(e){}
 }
 return x;
}

async function resolveRoomId(id){
 var rid=roomIdOf(id);
 if(!rid)throw Error('无效房间号');
 // 短号转真实房间号
 try{
  var d=await biGet('https://api.live.bilibili.com/room/v1/Room/room_init?id='+encodeURIComponent(rid));
  if(d&&d.room_id)return str(d.room_id);
 }catch(e){}
 return rid;
}

async function biliDetail(id){
 var rid=await resolveRoomId(id);
 var info=await biGet('https://api.live.bilibili.com/room/v1/Room/get_info?room_id='+encodeURIComponent(rid));
 var title=info.title||('房间 '+rid);
 var cover=info.user_cover||info.keyframe||info.cover||'';
 var online=info.online||0;
 var area=info.area_name||info.parent_area_name||'';
 var live=info.live_status===1;
 // get_info 不含昵称/头像，单独拉主播资料填演员表
 var uname='', face='';
 if(info.uid){
  try{
   var master=await biGet('https://api.live.bilibili.com/live_user/v1/Master/info?uid='+encodeURIComponent(info.uid));
   var mi=(master&&master.info)||master||{};
   uname=mi.uname||'';
   face=mi.face||'';
  }catch(e){}
 }
 var desc=(uname?uname+' · ':'')+(area?area+' · ':'')+(live?online+' 人':'未开播');
 if(info.description)desc+=' · '+str(info.description).replace(/<[^>]+>/g,'').slice(0,60);
 var x={
  id:rid,link:rid,type:'url',mediaType:'tv',
  title:title,coverUrl:cover,backdropPath:cover,backdropPaths:cover?[cover]:[],
  posterPath:cover,detailPoster:cover,playerType:'app',
  description:desc,
  peoples:[{id:'bili_'+(info.uid||rid),name:uname||('主播 '+rid),title:uname||('主播 '+rid),avatar:face||cover,role:'UP主',link:'user_'+(info.uid||rid)}]
 };
 if(area){x.genreTitle=area;x.genreItems=[{id:area,title:area}]}
 if(live){
  try{
   var resources=await qualityResources(rid);
   if(resources.length){
    x.videoUrl=resources[0].url;
    x.customHeaders=resources[0].customHeaders;
    x.description+=' · 取流:'+(resources[0].lineType||'已取流');
   }
  }catch(e){
   x.description+=' · 取流失败';
   console.error(e);
  }
 }else{
  x.description+=' · 未开播';
 }
 return x;
}

async function loadChannel(p){return [await biliDetail(p&&p.channel)]}

async function search(p){
 var q=str(p&&p.keyword).trim();
 if(!q)throw Error('请输入关键词');
 // 简单用房间号直达；关键词搜索接口常需签名，先支持房间号/链接
 var rid=roomIdOf(q);
 if(rid)return [await biliDetail(rid)];
 // 尝试直播搜索（可能受限）
 try{
  var d=await biGet('https://api.bilibili.com/x/web-interface/search/type?search_type=live_room&keyword='+encodeURIComponent(q)+'&page=1');
  var result=d&&d.result||[];
  var out=[];
  result.forEach(function(r){
   var item=makeItem({
    roomid:r.roomid||r.room_id,
    title:r.title&&String(r.title).replace(/<[^>]+>/g,''),
    uname:r.uname,
    online:r.online,
    user_cover:r.cover||r.user_cover,
    area_name:r.cate_name||r.area_name
   });
   if(item)out.push(item);
  });
  if(out.length)return out;
 }catch(e){}
 throw Error('无结果，可尝试房间号');
}

async function loadDetail(link){
 if(link==='bili_diag'){
  var report='请先运行诊断';
  try{report=Widget.storage.get('bili_diag_report')||report}catch(e){}
  return diagItem('诊断结果',report);
 }
 // 个人主页
 if(str(link).indexOf('user_')===0){
  var uid=str(link).replace(/^user_/,'').trim();
  var master=await biGet('https://api.live.bilibili.com/live_user/v1/Master/info?uid='+encodeURIComponent(uid));
  return biliUserPage(uid, master);
 }
 return biliDetail(link);
}

// 解析多画质（优先 HLS，其次 FLV）
async function qualityResources(roomId){
 roomId=await resolveRoomId(roomId);
 var d=await biGet('https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id='+encodeURIComponent(roomId)+'&protocol=0,1&format=0,1,2&codec=0,1&qn=10000&platform=web&ptype=8');
 if(!d||d.live_status!==1)throw Error('未开播或无法取流');
 var playurl=d.playurl_info&&d.playurl_info.playurl;
 if(!playurl)throw Error('无播放信息');
 var qnMap={};
 (playurl.g_qn_desc||[]).forEach(function(q){qnMap[q.qn]=q.desc||String(q.qn)});
 var headers={'User-Agent':BI_UA,'Referer':BI_REFERER,'Origin':'https://live.bilibili.com'};
 var ck=cookieOf();if(ck)headers['Cookie']=ck;
 var lines=[], seen={};

 function lineTypeOf(u){
  var b=str(u||'');
  if(b.indexOf('bluray')>=0)return '原画/高码率';
  if(b.indexOf('_2500')>=0||b.indexOf('_2000')>=0)return '超清720P';
  if(b.indexOf('_hevc')>=0||b.indexOf('_21633')>=0)return '高码率HEVC';
  if(b.indexOf('_1500')>=0||b.indexOf('_1000')>=0)return '高清';
  return '常规线路';
 }
 function add(name,url,proto){
  if(!url||seen[url])return;
  seen[url]=1;
  lines.push({name:name,url:url,description:proto||'B站直播',lineType:lineTypeOf(url),playerType:'app',customHeaders:headers});
 }

 var streams=playurl.stream||[];
 // 先 HLS (http_hls)，再 FLV (http_stream)
 var order=['http_hls','http_stream'];
 order.forEach(function(protoName){
  streams.forEach(function(st){
   if(st.protocol_name!==protoName)return;
   (st.format||[]).forEach(function(fmt){
    (fmt.codec||[]).forEach(function(codec){
     var accept=codec.accept_qn||[];
     var base=codec.base_url||'';
     var infos=codec.url_info||[];
     // 按画质从高到低
     var qns=accept.slice().sort(function(a,b){return b-a});
     if(!qns.length&&codec.current_qn)qns=[codec.current_qn];
     qns.forEach(function(qn){
      var label=(qnMap[qn]||('qn'+qn))+(fmt.format_name?(' · '+fmt.format_name):'');
      if(protoName==='http_hls')label+=' (HLS)';
      else label+=' (FLV)';
      infos.forEach(function(info,idx){
       var host=info.host||'';
       var extra=info.extra||'';
       // 部分线路 extra 里已有 qn，仍拼 base
       var url=host+base+extra;
       // 若需要按 qn 区分，可在 extra 替换；多数情况同一 base 不同 qn 需重新请求，这里先用当前返回的最高
       var name=label+(infos.length>1?(' 线路'+(idx+1)):'');
       add(name,url,protoName);
      });
     });
    });
   });
  });
 });

 // 若上面解析为空，回退旧 playUrl
 if(!lines.length){
  try{
   var old=await biGet('https://api.live.bilibili.com/room/v1/Room/playUrl?cid='+encodeURIComponent(roomId)+'&qn=10000&platform=h5');
   (old.durl||[]).forEach(function(u,i){
    add((old.quality_description&&old.quality_description[0]&&old.quality_description[0].desc)||'原画'+(i?' 线路'+(i+1):''),u.url,'hls');
   });
  }catch(e){}
 }

 if(!lines.length)throw Error('未解析到播放地址');
 // 默认把第一路作为自动
 return lines;
}

async function loadResource(p){
 var id=p&&(p.link||p.id||p.channel||'');
 if(!id&&p&&p.videoUrl){
  var m=String(p.videoUrl).match(/live\.bilibili\.com\/(\d+)/);
  if(m)id=m[1];
 }
 return qualityResources(id);
}
