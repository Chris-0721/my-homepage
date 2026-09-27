/**
 * Cloudflare Pages Function —— 匿名留言箱 + 课堂弹幕大屏
 *
 *   GET  /ask                      留言页（学生扫码进入）
 *   POST /ask/submit[?public=1]    提交留言（text/plain 请求体；?public=1 表示同意上大屏）
 *   GET  /ask/feed[?since=<id>]    公开留言流（大屏轮询用；不带 since 时只回放最近若干条）
 *   GET  /ask/wall                 弹幕大屏页（投影用，静态页面，无需构建）
 *   GET  /ask/admin?token=xxx      后台查看；追加 &format=csv 导出 CSV
 *          &del=<id> | &del=all     删除单条 / 清空（留言彻底消失）
 *          &unpub=<id>              取消公开（从大屏撤下，留言仍保留给老师）
 *          任意接口追加 &json=1     以 JSON 返回，便于大屏页调用
 *
 * 复用主页已有的 Pages 项目与 D1 绑定（env.DB → likes-db）。
 * 表 messages 在首次请求时自动创建并自动迁移，不需要手动执行 SQL。
 *
 * ⚠️ 与同项目 functions/api/likes.js 的关键差别：
 *    likes.js 用 CF-Connecting-IP 的哈希做「一人一赞」去重；
 *    本文件刻意不读取、不存储任何 IP / User-Agent / Cookie ——
 *    匿名承诺先在表结构上成立：messages 只有 id / body / created_at / is_public 四列，
 *    其中 is_public 仅是「是否同意公开上屏」的开关，不携带任何身份信息。
 *    ★ 不要给这张表加 ip_hash 之类的列，否则匿名承诺当场失效。
 */

let _tableReady = false;

async function ensureTable(env) {
  if (_tableReady) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS messages (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "body TEXT NOT NULL, " +
      "created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')))"
  ).run();
  // 迁移：加 is_public 列（0 = 只给老师看，1 = 同意在教室大屏上弹幕显示）。
  // 幂等：老库补齐该列，历史留言全部保持 0，不会突然出现在大屏上。
  const info = await env.DB.prepare("PRAGMA table_info(messages)").all();
  const hasPublic = (info.results || []).some((c) => c.name === "is_public");
  if (!hasPublic) {
    await env.DB.prepare(
      "ALTER TABLE messages ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0"
    ).run();
  }
  _tableReady = true;
}

const html = (body) =>
  new Response(body, {
    headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store" },
  });

const json = (o, status) =>
  new Response(JSON.stringify(o), {
    status: status || 200,
    headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" },
  });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>想说的话</title>
<style>
  :root{--bg:#0b0d10;--panel:#14171b;--text:#e6e8ea;--muted:#9aa3ab;--line:#242a31;--accent:#5ecfc4}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);
       font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 18px}
  main{width:100%;max-width:560px}
  h1{font-size:22px;font-weight:600;margin:0 0 8px;letter-spacing:.02em}
  .sub{color:var(--muted);font-size:14px;line-height:1.7;margin:0 0 20px}
  textarea{width:100%;min-height:180px;padding:16px;border-radius:10px;border:1px solid var(--line);
           background:var(--panel);color:var(--text);font-size:16px;line-height:1.7;resize:vertical;
           font-family:inherit;outline:none}
  textarea:focus{border-color:var(--accent)}
  .pub{display:flex;align-items:flex-start;gap:11px;margin-top:14px;padding:13px 15px;
       border:1px solid var(--line);border-radius:10px;background:var(--panel);
       cursor:pointer;font-size:14px;line-height:1.6;color:var(--muted);transition:border-color .18s,color .18s}
  .pub input{width:17px;height:17px;margin:3px 0 0;flex:0 0 auto;accent-color:var(--accent);cursor:pointer}
  .pub.on{color:var(--text);border-color:#2f6b64}
  .row{display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:12px}
  #n{color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
  button{background:var(--accent);color:#08201d;border:0;border-radius:8px;padding:12px 26px;
         font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
  button:disabled{opacity:.5;cursor:default}
  .ok{display:none;margin-top:18px;color:var(--accent);font-size:14px;line-height:1.7}
  footer{margin-top:30px;color:#5a636b;font-size:12px;line-height:1.75;border-top:1px solid var(--line);padding-top:14px}
</style>
</head>
<body>
<main>
  <h1>想说的话</h1>
  <p class="sub">不用署名，也不会记录你是谁。想到什么就写什么——对课程、对班级、对老师，或者只是今天的心情。</p>
  <textarea id="t" maxlength="2000" placeholder="例如：这学期我最担心的是……"></textarea>
  <label class="pub" id="pl" for="p">
    <input type="checkbox" id="p">
    <span>可以公开上屏 —— 这条会以弹幕形式显示在教室大屏上</span>
  </label>
  <div class="row"><span id="n">0 / 2000</span><button id="s">发送</button></div>
  <p class="ok" id="ok">收到了，谢谢你。</p>
  <footer>默认只有老师能看到你写的内容。本页面不记录 IP、不写 Cookie、不做统计，也不留任何能对应到你本人的信息。只有你自己勾选「可以公开上屏」时，这条才会出现在教室大屏上；不勾选就永远不会公开。</footer>
</main>
<script>
var t=document.getElementById('t'),n=document.getElementById('n'),s=document.getElementById('s'),
    ok=document.getElementById('ok'),p=document.getElementById('p'),pl=document.getElementById('pl');
t.addEventListener('input',function(){n.textContent=t.value.length+' / 2000';});
p.addEventListener('change',function(){pl.className=p.checked?'pub on':'pub';});
s.addEventListener('click',function(){
  var v=t.value.trim();
  if(!v){t.focus();return;}
  var isPub=p.checked;
  s.disabled=true;s.textContent='发送中…';
  fetch('/ask/submit'+(isPub?'?public=1':''),{method:'POST',headers:{'content-type':'text/plain;charset=utf-8'},body:v})
    .then(function(r){if(!r.ok)throw new Error();return r.json();})
    .then(function(){
      t.value='';n.textContent='0 / 2000';p.checked=false;pl.className='pub';
      ok.textContent=isPub?'收到了——这条会出现在教室大屏上。':'收到了，谢谢你。';
      ok.style.color='#5ecfc4';ok.style.display='block';
      s.textContent='再写一条';s.disabled=false;
    })
    .catch(function(){
      ok.textContent='没发出去，检查一下网络再试一次。';ok.style.color='#e0795f';ok.style.display='block';
      s.textContent='重试';s.disabled=false;
    });
});
</script>
</body>
</html>`;

const WALL = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>想说的话 · 大屏</title>
<style>
  :root{--bg:#0b0d10;--text:#e6e8ea;--muted:#6d7681;--line:#242a31;--accent:#5ecfc4;--warn:#e0795f}
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{background:var(--bg);color:var(--text);overflow:hidden;
       font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
  /* 顶部留出状态灯/退出键的位置，底部留出二维码带子，弹幕只在中间跑 */
  #stage{position:absolute;left:0;right:0;top:56px;bottom:clamp(136px,15vh,200px);
         line-height:1.5;font-weight:500;font-size:38px}
  #stage .c{display:inline-flex;align-items:center;gap:10px;white-space:nowrap;
            color:#eef1f3;padding:0 20px;letter-spacing:.02em;
            text-shadow:0 2px 7px rgba(0,0,0,.9),0 0 24px rgba(0,0,0,.65)}
  #stage .c.x-hidden{visibility:hidden}
  /* 「撤下」按钮：只在撤下模式下存在，且鼠标一动才浮现（投影时学生看不到） */
  #stage .c button{display:none;pointer-events:auto;font-family:inherit;font-size:.4em;line-height:1;
            background:rgba(224,121,95,.16);color:var(--warn);border:1px solid rgba(224,121,95,.5);
            border-radius:999px;padding:.5em .9em;cursor:pointer}
  body.admin #stage .c button{display:inline-block;visibility:hidden}
  body.admin.awake #stage .c button{visibility:visible}
  #hud{position:absolute;inset:0;pointer-events:none}
  .tl{position:absolute;left:30px;top:26px;display:flex;align-items:center;gap:10px;
      font-size:13px;color:var(--muted);letter-spacing:.08em}
  .dot{width:8px;height:8px;border-radius:50%;background:#4ad07a}
  .dot.off{background:var(--warn)}
  .br{position:absolute;right:30px;bottom:26px;display:flex;align-items:center;gap:14px;text-align:right}
  .br img{width:104px;height:104px;border-radius:10px;background:#fff;padding:7px;display:block}
  .br p{margin:0;font-size:13px;color:var(--muted);line-height:1.7}
  .br p b{display:block;color:var(--text);font-size:16px;font-weight:600;letter-spacing:.06em}
  .adm{position:absolute;right:30px;top:24px;display:none;align-items:center;gap:8px;
       font-family:inherit;font-size:12.5px;color:var(--warn);pointer-events:auto;cursor:pointer;
       background:rgba(224,121,95,.12);border:1px solid rgba(224,121,95,.45);border-radius:999px;
       padding:7px 14px}
  body.admin .adm{display:flex}
  .hint{position:absolute;left:30px;bottom:28px;font-size:12.5px;color:#343a41}
  .idle{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);
        font-size:17px;color:#49515a;letter-spacing:.14em;transition:opacity .6s}
  body.has-comment .idle{opacity:0}
  #toast{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);
         background:rgba(20,23,27,.95);border:1px solid var(--line);border-radius:8px;
         padding:10px 18px;font-size:13.5px;opacity:0;transition:opacity .25s}
  #toast.on{opacity:1}
</style>
</head>
<body>
<div id="stage"></div>
<div id="hud">
  <div class="tl"><span class="dot" id="dot"></span><span id="stat">已连接</span></div>
  <button class="adm" id="adm">撤下模式 · 退出</button>
  <div class="br">
    <p><b>扫码发言</b>想说的话 · 可匿名</p>
    <img src="/qr-ask.png" alt="扫码发言">
  </div>
  <div class="hint">双击画面进入全屏，Esc 退出</div>
  <div class="idle" id="idle">扫码留言，内容会从这里飘过</div>
  <div id="toast"></div>
</div>
<script src="/danmaku.min.js"></script>
<script>
(function(){
  var q = new URLSearchParams(location.search);
  var speed = parseInt(q.get('speed')||'', 10); if(!(speed > 0)) speed = 130;
  var pollMs = parseInt(q.get('poll')||'', 10); if(!(pollMs >= 1000)) pollMs = 2000;
  /* replay：进大屏时回放最近几条（0 = 不回放，空白起屏）。speed / poll / replay 都可用 URL 参数调 */
  var replayN = parseInt(q.get('replay')||'', 10); if(!(replayN >= 0)) replayN = 8;
  var CHUNK = 44, MAXCHUNK = 4, GAP = 440, QUEUE_MAX = 60;

  var state = { token:'', cursor:0, fails:0 };

  /* 撤下模式：token 从 URL hash 读入，读完立刻从地址栏抹掉；不写 Cookie、不落库 */
  (function(){
    var m = /(?:^|[#&])admin=([^&]+)/.exec(location.hash || '');
    if (m) {
      try { sessionStorage.setItem('ask_admin', decodeURIComponent(m[1])); } catch(e){}
      history.replaceState(null, '', location.pathname + location.search);
    }
    try { state.token = sessionStorage.getItem('ask_admin') || ''; } catch(e){}
    if (state.token) document.body.classList.add('admin');
  })();

  var stageEl = document.getElementById('stage');
  var dm;
  try { dm = new Danmaku({ container: stageEl, engine: 'DOM', speed: speed }); }
  catch(e) {
    stageEl.textContent = '弹幕引擎加载失败，请检查网络后刷新。';
    return;
  }

  function fitFont(){
    var h = document.documentElement.clientHeight;
    var fs = Math.round(h / 26);
    if (fs < 22) fs = 22;
    if (fs > 46) fs = 46;
    stageEl.style.fontSize = fs + 'px';
  }
  fitFont();

  var rt = 0;
  window.addEventListener('resize', function(){
    fitFont();
    clearTimeout(rt);
    rt = setTimeout(function(){ try { dm.resize(); } catch(e){} }, 180);
  });

  function chunk(text){
    var out = [], buf = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '\\n' || ch === '\\r') { if (buf) { out.push(buf); buf = ''; } continue; }
      buf += ch;
      if (buf.length >= CHUNK) { out.push(buf); buf = ''; }
    }
    if (buf) out.push(buf);
    if (!out.length) out = [''];
    if (out.length > MAXCHUNK) {
      out = out.slice(0, MAXCHUNK);
      out[MAXCHUNK - 1] = out[MAXCHUNK - 1].slice(0, CHUNK - 1) + '…';
    }
    return out;
  }

  function takedown(id){
    if (!state.token) return;
    if (!confirm('把这条从大屏撤下？（留言本身仍保留在后台）')) return;
    fetch('/ask/admin?token=' + encodeURIComponent(state.token) + '&unpub=' + id + '&json=1', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.ok) {
          var nodes = document.querySelectorAll('#stage .c[data-id="' + id + '"]');
          for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('x-hidden');
          toast('已从大屏撤下');
        } else { toast('撤下失败：密钥不正确'); }
      })
      .catch(function(){ toast('撤下失败：网络异常'); });
  }

  function makeNode(seg, id){
    var box = document.createElement('div');
    box.className = 'c';
    box.setAttribute('data-id', id);
    var sp = document.createElement('span');
    sp.textContent = seg;
    box.appendChild(sp);
    if (state.token) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '撤下';
      b.addEventListener('click', function(ev){ ev.stopPropagation(); takedown(id); });
      box.appendChild(b);
    }
    return box;
  }

  var queue = [];
  /* spread = true 时在每条之间多插一个空拍，用于「回放历史」时分得更开，不挤成一列 */
  function push(item, spread){
    var segs = chunk(String(item.body || ''));
    for (var i = 0; i < segs.length; i++) {
      if (i || spread) queue.push(null);
      queue.push({ text: segs[i], id: item.id });
    }
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX);
  }
  function pump(){
    if (!queue.length) return;
    var it = queue.shift();
    if (!it) return;
    dm.emit({
      text: it.text,
      mode: 'rtl',
      render: (function(t, id){ return function(){ return makeNode(t, id); }; })(it.text, it.id)
    });
    document.body.classList.add('has-comment');
  }
  setInterval(pump, GAP);

  function toast(msg){
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.classList.remove('on'); }, 2600);
  }

  var dotEl = document.getElementById('dot'), statEl = document.getElementById('stat');
  function setLive(ok){
    dotEl.className = ok ? 'dot' : 'dot off';
    statEl.textContent = ok ? '已连接' : '重连中…';
  }

  function ingest(items, spread){
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id != null) push(items[i], spread);
    }
  }

  function feed(url, spread, next){
    fetch(url, { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function(d){
        state.fails = 0;
        setLive(true);
        if (d && d.ok && d.items && d.items.length) ingest(d.items, spread);
        if (d && typeof d.cursor === 'number' && d.cursor > state.cursor) state.cursor = d.cursor;
        next(0);
      })
      .catch(function(){
        state.fails++;
        setLive(false);
        next(Math.min(pollMs + state.fails * 2000, 15000));
      });
  }

  function loop(){
    feed('/ask/feed?since=' + state.cursor + '&limit=30', false, function(wait){
      setTimeout(loop, wait || pollMs);
    });
  }

  /* 首次进入：先建立游标。replay=0 时只取游标不回放，起屏干净 */
  feed(replayN > 0 ? '/ask/feed?limit=' + replayN : '/ask/feed?probe=1', replayN > 0, function(){
    setTimeout(loop, 400);
  });

  document.getElementById('adm').addEventListener('click', function(){
    try { sessionStorage.removeItem('ask_admin'); } catch(e){}
    location.href = location.pathname;
  });

  /* 鼠标/键盘一动就把「撤下」按钮显出来，静置 4 秒后自动隐去 */
  var wakeTimer = 0;
  function wake(){
    document.body.classList.add('awake');
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(function(){ document.body.classList.remove('awake'); }, 4000);
  }
  document.addEventListener('mousemove', wake);
  document.addEventListener('mousedown', wake);
  document.addEventListener('keydown', wake);
  if (state.token) wake();

  function toggleFull(){
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }
  document.addEventListener('dblclick', toggleFull);
  document.addEventListener('keydown', function(e){
    if (e.key && e.key.toLowerCase() === 'f') toggleFull();
  });

  /* 投影时别让屏幕自动休眠 */
  function keepAwake(){
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').catch(function(){});
  }
  keepAwake();
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') { keepAwake(); setLive(true); }
  });
})();
</script>
</body>
</html>`;

async function submit(request, url, env) {
  const text = (await request.text()).trim();
  if (!text) return json({ ok: false, error: "empty" }, 400);
  if (text.length > 2000) return json({ ok: false, error: "too_long" }, 400);
  const isPublic = url.searchParams.get("public") === "1" ? 1 : 0;
  await ensureTable(env);
  await env.DB.prepare("INSERT INTO messages (body, is_public) VALUES (?, ?)")
    .bind(text, isPublic)
    .run();
  return json({ ok: true, public: !!isPublic });
}

/**
 * 公开留言流（给大屏轮询）。
 *   不带 since → 只回放最近 12 条（建立游标，空了也不刷屏）
 *   带 since   → 只返回 id > since 且 is_public = 1 的新留言，按 id 升序
 *   probe=1    → 不返回内容，只回当前最大 id（用于「不回放历史、干净起屏」）
 * 内容本身即公开，因此不校验 token。
 */
async function feed(url, env) {
  await ensureTable(env);

  if (url.searchParams.get("probe") === "1") {
    const row = await env.DB.prepare(
      "SELECT COALESCE(MAX(id), 0) AS c FROM messages WHERE is_public = 1"
    ).first();
    return json({ ok: true, items: [], cursor: (row && row.c) || 0 });
  }

  let limit = parseInt(url.searchParams.get("limit") || "", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 30;
  if (limit > 100) limit = 100;

  const sinceRaw = url.searchParams.get("since");
  let rows;
  let cursor = 0;

  if (sinceRaw === null || sinceRaw === "") {
    const n = Math.min(limit, 12);
    const r = await env.DB.prepare(
      "SELECT id, body, created_at FROM messages WHERE is_public = 1 ORDER BY id DESC LIMIT ?"
    ).bind(n).all();
    rows = (r.results || []).reverse();
  } else {
    const since = parseInt(sinceRaw, 10);
    if (!Number.isFinite(since) || since < 0) return json({ ok: false, error: "bad_since" }, 400);
    cursor = since;
    const r = await env.DB.prepare(
      "SELECT id, body, created_at FROM messages WHERE is_public = 1 AND id > ? ORDER BY id ASC LIMIT ?"
    ).bind(since, limit).all();
    rows = r.results || [];
  }
  if (rows.length) cursor = rows[rows.length - 1].id;

  return json({ ok: true, items: rows, cursor });
}

async function admin(url, env) {
  const token = url.searchParams.get("token");
  const asJson = url.searchParams.get("json") === "1";
  if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    if (asJson) return json({ ok: false, error: "forbidden" }, 403);
    return new Response("需要 token", { status: 403 });
  }
  await ensureTable(env);

  // 取消公开：从大屏撤下，但留言本身保留（老师仍可在后台看到）
  const unpub = url.searchParams.get("unpub");
  if (unpub && /^\d+$/.test(unpub)) {
    await env.DB.prepare("UPDATE messages SET is_public = 0 WHERE id = ?")
      .bind(Number(unpub))
      .run();
    if (asJson) return json({ ok: true, id: Number(unpub) });
    return Response.redirect(url.origin + "/ask/admin?token=" + encodeURIComponent(token), 303);
  }

  // 删除：?del=<id> 删单条，?del=all 清空。仅用于清理垃圾/误发内容。
  const del = url.searchParams.get("del");
  if (del) {
    if (del === "all") {
      await env.DB.prepare("DELETE FROM messages").run();
    } else if (/^\d+$/.test(del)) {
      await env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(Number(del)).run();
    }
    if (asJson) return json({ ok: true });
    return Response.redirect(
      url.origin + "/ask/admin?token=" + encodeURIComponent(token),
      303
    );
  }

  if (url.searchParams.get("format") === "csv") {
    const { results } = await env.DB.prepare(
      "SELECT id, created_at, is_public, body FROM messages ORDER BY id ASC"
    ).all();
    const cell = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = ["id,时间,是否公开,留言"];
    for (const r of results) {
      lines.push([r.id, cell(r.created_at), r.is_public ? "公开" : "私密", cell(r.body)].join(","));
    }
    return new Response("\uFEFF" + lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": 'attachment; filename="anonymous-messages.csv"',
        "cache-control": "no-store",
      },
    });
  }

  const { results } = await env.DB.prepare(
    "SELECT id, body, created_at, is_public FROM messages ORDER BY id DESC"
  ).all();
  const pubCount = results.filter((r) => r.is_public).length;
  const rows = results
    .map((r) => {
      const tag = r.is_public
        ? '<span class="badge on">公开</span>'
        : '<span class="badge">私密</span>';
      const unpubLink = r.is_public
        ? '　<a href="/ask/admin?token=' + encodeURIComponent(token) +
          "&amp;unpub=" + r.id + '">撤下大屏</a>'
        : "";
      return (
        '<tr><td class="m">' + esc(r.created_at) + "</td><td>" +
        esc(r.body).replace(/\n/g, "<br>") + "</td>" +
        '<td class="p">' + tag + "</td>" +
        '<td class="d"><a href="/ask/admin?token=' + encodeURIComponent(token) +
        "&amp;del=" + r.id + "\" onclick=\"return confirm('彻底删除这条留言？')\">删除</a>" +
        unpubLink + "</td></tr>"
      );
    })
    .join("");

  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>匿名留言 · ${results.length} 条</title><style>
body{margin:0;background:#0b0d10;color:#e6e8ea;padding:22px;
     font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
h1{font-size:18px;margin:0 0 4px}
.sub{color:#9aa3ab;font-size:13px;margin:0 0 16px}
a{color:#5ecfc4;font-size:13px;text-decoration:none;border-bottom:1px solid #2f6b64}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
td{padding:12px 10px;border-bottom:1px solid #242a31;vertical-align:top;line-height:1.75}
td.m{color:#9aa3ab;white-space:nowrap;width:1%;font-size:12.5px;font-variant-numeric:tabular-nums}
td.p{white-space:nowrap;width:1%;font-size:12px}
.badge{color:#7a8189;border:1px solid #2b323a;border-radius:999px;padding:2px 9px}
.badge.on{color:#5ecfc4;border-color:#2f6b64}
td.d{white-space:nowrap;width:1%;text-align:right;font-size:12.5px}
td.d a{color:#e0795f;border-bottom-color:#7a3a30}
</style></head><body>
<h1>匿名留言 · 共 ${results.length} 条</h1>
<p class="sub">按时间倒序。<b>公开</b>的会出现在 <a href="/ask/wall">/ask/wall</a> 大屏上，<b>私密</b>的只有你能看到。
　<a href="/ask/admin?token=${esc(token)}&amp;format=csv">导出 CSV</a>${
    results.length
      ? '　<a href="/ask/admin?token=' + encodeURIComponent(token) +
        '&amp;del=all" onclick="return confirm(\'清空全部 ' + results.length +
        ' 条留言？此操作不可撤销。\')">清空全部</a>'
      : ""
  }</p>
<p class="sub">当前公开 ${pubCount} 条（这些会在大屏上滚动）。</p>
<table>${rows}</table></body></html>`;

  return html(page);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const seg = ((params && params.path) || []).filter(Boolean).join("/");

  if (request.method === "GET" && seg === "") return html(PAGE);
  if (request.method === "POST" && seg === "submit") return submit(request, url, env);
  if (request.method === "GET" && seg === "feed") return feed(url, env);
  if (request.method === "GET" && seg === "wall") return html(WALL);
  if (request.method === "GET" && seg === "admin") return admin(url, env);
  return new Response("Not found", { status: 404 });
}
