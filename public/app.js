(() => {
  // ---- API
  async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  let data;
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => "");
  }

  if (!res.ok) {
    // Avoid dumping HTML error pages to the UI.
    const isHtml = typeof data === "string" && /<\s*html|<!doctype/i.test(data);
    const msg =
      (data && typeof data === "object" && data.error) ? data.error :
      isHtml ? `服务异常（HTTP ${res.status}）` :
      (typeof data === "string" ? data : JSON.stringify(data));

    throw new Error(msg || `HTTP ${res.status}`);
  }

  return data;
}

  // ---- utils
  const nowISO = () => new Date().toISOString();
  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return iso; }
  };


function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

  // 搜索防抖（可通过 index.html 的 window.APP_CONFIG.searchDebounceMs 配置）
  const SEARCH_DEBOUNCE_MS = (window.APP_CONFIG && typeof window.APP_CONFIG.searchDebounceMs === "number")
    ? window.APP_CONFIG.searchDebounceMs
    : 300;

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<"'>]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }
  const parseTags = (s) =>
    (s || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)
      .slice(0, 12);

  // ---- state
  let me = { authenticated: false, role: "none" };
  let memos = [];
  let totalMemos = 0;
  let notesAbort = null;
  let editingId = null;

  let adminNotes = [];
  let adminNotesLoaded = false;
  let adminNotesTotal = 0;
  let adminNotesPage = 1;
  const ADMIN_PAGE_SIZE = 10;
  let adminNotesAbort = null;

  // ---- message UI
  function setStatus(el, text = "", kind = "") {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "error", "warn");
    if (kind) el.classList.add(kind);
  }


function setLoading(on, text = "加载中…") {
  if (!loadingEl) return;
  loadingEl.textContent = on ? text : "";
  loadingEl.classList.toggle("hidden", !on);
}

  function clearLoginForm() {
    if (loginUser) loginUser.value = "";
    if (loginPass) loginPass.value = "";
    setStatus(loginMsg, "");
  }

  // ---- dom
  const $ = (id) => document.getElementById(id);
  // ---- UI helpers (replace native alert/confirm)
  const toastHost = $("toastHost");
  const sysMask = $("sysMask");
  const sysModal = $("sysModal");
  const sysTitle = $("sysTitle");
  const sysMsg = $("sysMsg");
  const btnSysOk = $("btnSysOk");
  const btnSysCancel = $("btnSysCancel");
  const btnSysClose = $("btnSysClose");

  let sysResolve = null;
  let sysHasCancel = false;

  function toast(text, type = "info", title) {
    if (!toastHost) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;

    const icon = document.createElement("div");
    icon.className = "toastIcon";
    icon.textContent = type === "error" ? "⚠️" : (type === "success" ? "✅" : "ℹ️");

    const body = document.createElement("div");
    body.className = "toastBody";

    const ttl = document.createElement("div");
    ttl.className = "toastTitle";
    ttl.textContent = title || (type === "error" ? "出错了" : (type === "success" ? "完成" : "提示"));

    const msg = document.createElement("div");
    msg.className = "toastText";
    msg.textContent = String(text || "");

    body.appendChild(ttl);
    body.appendChild(msg);

    t.appendChild(icon);
    t.appendChild(body);

    toastHost.appendChild(t);

    // auto-dismiss
    window.setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(6px)";
      window.setTimeout(() => t.remove(), 160);
    }, 2600);
  }

  function openSysDialog({ title = "提示", message = "", okText = "确定", cancelText = null, danger = false } = {}) {
    if (!sysMask || !sysModal || !sysTitle || !sysMsg || !btnSysOk) {
      // last resort fallback (should be rare)
      return Promise.resolve(window.confirm ? window.confirm(String(message || "")) : true);
    }

    sysHasCancel = !!cancelText;
    sysTitle.textContent = String(title || "提示");
    sysMsg.textContent = String(message || "");

    btnSysOk.textContent = String(okText || "确定");
    btnSysOk.classList.toggle("danger", !!danger);
    btnSysOk.classList.toggle("primary", !danger);

    if (btnSysCancel) {
      btnSysCancel.textContent = String(cancelText || "取消");
      btnSysCancel.classList.toggle("hidden", !cancelText);
    }

    sysMask.classList.remove("hidden");
    sysModal.classList.remove("hidden");

    // focus primary action
    window.setTimeout(() => btnSysOk.focus(), 0);

    return new Promise((resolve) => {
      sysResolve = resolve;
    });
  }

  function closeSysDialog(result) {
    if (!sysMask || !sysModal) return;
    sysMask.classList.add("hidden");
    sysModal.classList.add("hidden");
    const r = sysResolve;
    sysResolve = null;
    if (typeof r === "function") r(!!result);
  }

  if (btnSysOk) btnSysOk.addEventListener("click", () => closeSysDialog(true));
  if (btnSysCancel) btnSysCancel.addEventListener("click", () => closeSysDialog(false));
  if (btnSysClose) btnSysClose.addEventListener("click", () => closeSysDialog(false));
  if (sysMask) sysMask.addEventListener("click", () => closeSysDialog(false));
  document.addEventListener("keydown", (e) => {
    if (!sysModal || sysModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeSysDialog(false);
  });

  function uiConfirm(message, opts = {}) {
    return openSysDialog({
      title: opts.title || "请确认",
      message,
      okText: opts.okText || "确定",
      cancelText: opts.cancelText || "取消",
      danger: !!opts.danger,
    });
  }

  function uiAlert(message, opts = {}) {
    return openSysDialog({
      title: opts.title || "提示",
      message,
      okText: opts.okText || "知道了",
      cancelText: null,
      danger: false,
    });
  }

  const listEl = $("list");
  const emptyEl = $("empty");
  const statsEl = $("stats");
  const loadingEl = $("loading");
  const qEl = $("q");
  const filterEl = $("filter");
  const sortEl = $("sort");


// ---- pagination
const pagerEl = $("pager");
const pgFirst = $("pgFirst");
const pgPrev = $("pgPrev");
const pgNext = $("pgNext");
const pgLast = $("pgLast");
const pgInfo = $("pgInfo");
const pgJump = $("pgJump");
const pgGo = $("pgGo");

const PAGE_SIZE = 10;
let currentPage = 1;

function getTotalPages(total) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function updatePager(total) {
  if (!pagerEl) return;
  if (total <= PAGE_SIZE) {
    pagerEl.classList.add("hidden");
    return;
  }
  const totalPages = getTotalPages(total);
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  pagerEl.classList.remove("hidden");
  if (pgInfo) pgInfo.textContent = `第 ${currentPage}/${totalPages} 页 · 共 ${total} 条`;

  if (pgFirst) pgFirst.disabled = currentPage <= 1;
  if (pgPrev) pgPrev.disabled = currentPage <= 1;
  if (pgNext) pgNext.disabled = currentPage >= totalPages;
  if (pgLast) pgLast.disabled = currentPage >= totalPages;

  if (pgJump) {
    pgJump.max = String(totalPages);
    if (document.activeElement !== pgJump) pgJump.value = String(currentPage);
  }
}


function updateAdminPager(total) {
  if (!adminPagerEl) return;
  if (total <= ADMIN_PAGE_SIZE) {
    adminPagerEl.classList.add("hidden");
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  adminNotesPage = Math.min(Math.max(1, adminNotesPage), totalPages);

  adminPagerEl.classList.remove("hidden");
  if (aPgInfo) aPgInfo.textContent = `第 ${adminNotesPage}/${totalPages} 页 · 共 ${total} 条`;

  if (aPgFirst) aPgFirst.disabled = adminNotesPage <= 1;
  if (aPgPrev) aPgPrev.disabled = adminNotesPage <= 1;
  if (aPgNext) aPgNext.disabled = adminNotesPage >= totalPages;
  if (aPgLast) aPgLast.disabled = adminNotesPage >= totalPages;

  if (aPgJump) {
    aPgJump.max = String(totalPages);
    if (document.activeElement !== aPgJump) aPgJump.value = String(adminNotesPage);
  }
}

function bindAdminPagerHandlers() {
  if (!adminPagerEl) return;

  const goTo = async (p) => {
    const totalPages = Math.max(1, Math.ceil(adminNotesTotal / ADMIN_PAGE_SIZE));
    adminNotesPage = Math.min(Math.max(1, p), totalPages);
    await refreshAdminNotes({ resetPage: false });
  };

  aPgFirst?.addEventListener("click", () => goTo(1));
  aPgPrev?.addEventListener("click", () => goTo(adminNotesPage - 1));
  aPgNext?.addEventListener("click", () => goTo(adminNotesPage + 1));
  aPgLast?.addEventListener("click", () => goTo(Math.max(1, Math.ceil(adminNotesTotal / ADMIN_PAGE_SIZE))));

  const doJump = () => {
    const v = parseInt((aPgJump?.value || "").trim(), 10);
    if (!Number.isFinite(v)) return;
    goTo(v);
  };

  aPgGo?.addEventListener("click", doJump);
  aPgJump?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doJump();
  });
}

function bindPagerHandlers() {
  if (!pagerEl) return;
  const goTo = async (p) => {
    const totalPages = getTotalPages(totalMemos);
    currentPage = Math.min(Math.max(1, p), totalPages);
    await loadNotes();
  };

  pgFirst?.addEventListener("click", () => goTo(1));
  pgPrev?.addEventListener("click", () => goTo(currentPage - 1));
  pgNext?.addEventListener("click", () => goTo(currentPage + 1));
  pgLast?.addEventListener("click", () => goTo(getTotalPages(totalMemos)));

  const doJump = () => {
    const v = parseInt((pgJump?.value || "").trim(), 10);
    if (!Number.isFinite(v)) return;
    goTo(v);
  };

  pgGo?.addEventListener("click", doJump);
  pgJump?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doJump();
  });
}

bindPagerHandlers();


  const whoEl = $("who");
  const btnSwitch = $("btnSwitch");
  const btnLogout = $("btnLogout");
  const btnAdmin = $("btnAdmin");
  const btnGuestTools = $("btnGuestTools");

  // memo modal
  const maskEl = $("modalMask");
  const modalEl = $("modal");
  const modalTitleEl = $("modalTitle");
  const mTitleEl = $("mTitle");
  const mBodyEl = $("mBody");
  const mTagsEl = $("mTags");
  const mDoneEl = $("mDone");
  const mPinnedEl = $("mPinned");
  const btnDeleteEl = $("btnDelete");
  const btnShareEl = $("btnShare");


  // login modal
  const loginMask = $("loginMask");
  const guestToolsMask = $("guestToolsMask");
  const guestToolsModal = $("guestToolsModal");
  const btnGuestToolsClose = $("btnGuestToolsClose");
  const btnGuestToolsCancel = $("btnGuestToolsCancel");
  const btnGenRecover = $("btnGenRecover");
  const btnCopyRecover = $("btnCopyRecover");
  const recoverCodeOut = $("recoverCodeOut");
  const recoverCodeIn = $("recoverCodeIn");
  const btnUseRecover = $("btnUseRecover");
  const upgradeUsername = $("upgradeUsername");
  const upgradePasscode = $("upgradePasscode");
  const btnGuestUpgrade = $("btnGuestUpgrade");
  const guestToolsMsg = $("guestToolsMsg");
  const loginModal = $("loginModal");
  const loginUser = $("loginUser");
  const loginPass = $("loginPass");
  const loginMsg = $("loginMsg");
  // share modal
  const shareMask = $("shareMask");
  const shareModal = $("shareModal");
  const btnShareClose = $("btnShareClose");
  const btnShareCreate = $("btnShareCreate");
  const btnShareCopy = $("btnShareCopy");
  const shareBurn = $("shareBurn");
  const shareExpireHours = $("shareExpireHours");
  const shareLink = $("shareLink");
  const shareMsg = $("shareMsg");
  let shareForMemoId = null;


  // admin modal
  const adminMask = $("adminMask");
  const adminModal = $("adminModal");
  const adminTabUsers = $("adminTabUsers");
  const adminTabNotes = $("adminTabNotes");
  const adminPanelUsers = $("adminPanelUsers");
  const adminPanelNotes = $("adminPanelNotes");
  const adminNotesSearch = $("adminNotesSearch");
  const adminNotesOwner = $("adminNotesOwner");
  const adminNoteViewMask = $("adminNoteViewMask");
  const adminNoteViewModal = $("adminNoteViewModal");
  const adminNoteViewTitle = $("adminNoteViewTitle");
  const adminNoteViewMeta = $("adminNoteViewMeta");
  const adminNoteViewBody = $("adminNoteViewBody");
  const btnAdminNoteViewClose = $("btnAdminNoteViewClose");
  const btnAdminNoteViewX = $("btnAdminNoteViewX");
  const btnAdminNotesRefresh = $("btnAdminNotesRefresh");
  const adminNotesList = $("adminNotesList");
  const adminNotesEmpty = $("adminNotesEmpty");
  const adminNotesMsg = $("adminNotesMsg");
  const adminPagerEl = $("adminPager");
  const aPgFirst = $("aPgFirst");
  const aPgPrev = $("aPgPrev");
  const aPgNext = $("aPgNext");
  const aPgLast = $("aPgLast");
  const aPgInfo = $("aPgInfo");
  const aPgJump = $("aPgJump");
  const aPgGo = $("aPgGo");
  bindAdminPagerHandlers();
  const usersList = $("usersList");
  const usersEmpty = $("usersEmpty");
  const adminMsg = $("adminMsg");
  const newUsername = $("newUsername");
  const newPasscode = $("newPasscode");
  const newRole = $("newRole");

  // ---- auth
  async function refreshMe() {
    try {
      me = await api("/api/me");
    } catch {
      me = { authenticated: false, role: "none" };
    }
    renderWho();
    btnAdmin.classList.toggle("hidden", me.role !== "admin");
    btnGuestTools.classList.toggle("hidden", me.role !== "guest");
    btnLogout.classList.toggle("hidden", !me.authenticated);
  }

  function renderWho() {
    if (!me || !me.authenticated) {
      whoEl.classList.add("hidden");
      btnLogout.classList.add("hidden");
      return;
    }
    whoEl.classList.remove("hidden");
    const name = me.username ? me.username : (me.role === "guest" ? "游客" : "用户");
    whoEl.textContent = `${name} · ${me.role}`;
  }

  function openLogin() {
    clearLoginForm();
    loginMask.classList.remove("hidden");
    loginModal.classList.remove("hidden");
    setTimeout(() => loginUser.focus(), 0);
  }
  function closeLogin() {
    loginMask.classList.add("hidden");
    loginModal.classList.add("hidden");

    // 关闭/登录成功后都清空输入框
    clearLoginForm();
  }


  function openGuestTools() {
    setStatus(guestToolsMsg, "");
    recoverCodeOut.value = "";
    recoverCodeIn.value = "";
    upgradeUsername.value = "";
    upgradePasscode.value = "";
    guestToolsMask.classList.remove("hidden");
    guestToolsModal.classList.remove("hidden");
  }
  function closeGuestTools() {
    guestToolsMask.classList.add("hidden");
    guestToolsModal.classList.add("hidden");
  }

  async function genRecoverCode() {
    setStatus(guestToolsMsg, "正在生成恢复码…", "warn");
    try {
      const data = await api("/api/auth/guest/code", { method: "POST", body: "{}" });
      const code = data.code || data.recoveryCode || data.token || "";
      recoverCodeOut.value = code;
      setStatus(guestToolsMsg, code ? "已生成恢复码（建议尽快使用）。" : "生成成功，但未返回 code。", code ? "ok" : "warn");
    } catch (e) {
      setStatus(guestToolsMsg, "生成失败：" + (e.message || e), "error");
    }
  }

  async function useRecoverCode() {
    const code = (recoverCodeIn.value || "").trim();
    if (!code) return setStatus(guestToolsMsg, "请先输入恢复码。", "warn");
    setStatus(guestToolsMsg, "正在恢复…", "warn");
    try {
      await api("/api/auth/guest/recover", { method: "POST", body: JSON.stringify({ code }) });
      setStatus(guestToolsMsg, "恢复成功，正在刷新…", "ok");
      await refreshMe();
      await loadNotes();
      closeGuestTools();
    } catch (e) {
      setStatus(guestToolsMsg, "恢复失败：" + (e.message || e), "error");
    }
  }

  async function guestUpgrade() {
    const username = (upgradeUsername.value || "").trim();
    const passcode = (upgradePasscode.value || "").trim();
    if (!username) return setStatus(guestToolsMsg, "请输入新用户名。", "warn");
    if (passcode.length < 6) return setStatus(guestToolsMsg, "口令至少 6 位。", "warn");
    setStatus(guestToolsMsg, "正在转正并迁移…", "warn");
    try {
      await api("/api/auth/guest/upgrade", { method: "POST", body: JSON.stringify({ username, passcode }) });
      await refreshMe();
      await loadNotes();
      closeGuestTools();
    } catch (e) {
      setStatus(guestToolsMsg, "转正失败：" + (e.message || e), "error");
    }
  }

  async function loginAsGuest() {
    setStatus(loginMsg, "正在进入游客模式…", "warn");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ mode: "guest" }) });
      await refreshMe();
      await loadNotes();
      closeLogin();
    } catch (e) {
      setStatus(loginMsg, `进入失败：${e.message || e}`, "error");
    }
  }

  async function loginAsUser() {
    const u = (loginUser.value || "").trim();
    const p = (loginPass.value || "").trim();
    if (!u || !p) {
      setStatus(loginMsg, "请输入用户名和口令。", "warn");
      return;
    }
    setStatus(loginMsg, "登录中…", "warn");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ mode: "user", username: u, passcode: p }) });
      await refreshMe();
      await loadNotes();
      closeLogin();
    } catch (e) {
      setStatus(loginMsg, `登录失败：${e.message || e}`, "error");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    me = { authenticated: false, role: "none" };
    memos = [];
    renderWho();
    render();
    openLogin();
  }

  // ---- notes API
  async function loadNotes(opts = { resetPage: false }) {
  if (!me.authenticated) return;

  if (opts?.resetPage) currentPage = 1;

  // cancel previous in-flight request
  try { notesAbort?.abort(); } catch {}
  notesAbort = new AbortController();

  const params = new URLSearchParams({
    q: (qEl.value || "").trim(),
    filter: filterEl.value,
    sort: sortEl.value,
    page: String(currentPage),
    pageSize: String(PAGE_SIZE),
  });

  setLoading(true);
  try {
    const data = await api(`/api/notes?${params.toString()}`, { signal: notesAbort.signal });
    memos = data.items || [];
    totalMemos = Number(data.total ?? memos.length);

          // clamp page if data size changed (e.g. deleted last item on last page)
          const totalPages = getTotalPages(totalMemos);
          if (currentPage > totalPages) {
            currentPage = totalPages;
            await loadNotes();
            return;
          }


    if (data.page) currentPage = Number(data.page);

    render();
  } catch (e) {
    if (e?.name === "AbortError") return;
    throw e;
  } finally {
    setLoading(false);
  }
}


  async function createNote(note) {
    const data = await api("/api/notes", { method: "POST", body: JSON.stringify(note) });
    return data.item;
  }
  async function updateNote(id, patch) {
    const data = await api(`/api/notes/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) });
    return data.item;
  }
  async function deleteNote(id) {
    await api(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // ---- UI render
  function updateStats(total) {
  const pageCount = memos.length;
  const done = memos.filter(x => x.done).length;
  const pinned = memos.filter(x => x.pinned).length;
  statsEl.textContent = `共 ${total} 条 · 当前页 ${pageCount} 条 · 当前页已完成 ${done} 条 · 当前页置顶 ${pinned} 条`;
}


  
function render() {
  listEl.innerHTML = "";
  updateStats(totalMemos);
  updatePager(totalMemos);

  if (totalMemos === 0) {
    emptyEl.classList.remove("hidden");
    if (pagerEl) pagerEl.classList.add("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  for (const x of memos) {

      const card = document.createElement("div");
      card.className = "card";
      card.dataset.id = x.id;

      const left = document.createElement("div");
      left.className = "left";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "chk";
      chk.checked = !!x.done;
      chk.title = "标记完成/未完成";
      chk.addEventListener("change", async () => {
        try {
          const updated = await updateNote(x.id, { done: chk.checked });
          Object.assign(x, updated);
          render();
        } catch (e) {
          toast(e.message || e, "error");
          chk.checked = !!x.done;
        }
      });
      left.appendChild(chk);

      const content = document.createElement("div");
      content.className = "content";

      const titleRow = document.createElement("div");
      titleRow.className = "cardTitle";

      const t = document.createElement("div");
      t.className = "t";
      t.textContent = x.title || "(无标题)";
      if (x.done) t.style.textDecoration = "line-through";
      titleRow.appendChild(t);

      if (x.pinned) {
        const badge = document.createElement("span");
        badge.className = "badge pin";
        badge.textContent = "置顶";
        titleRow.appendChild(badge);
      }

      content.appendChild(titleRow);

      const body = document.createElement("div");
      body.className = "cardBody";
      body.textContent = x.body || "";
      content.appendChild(body);

      const meta = document.createElement("div");
      meta.className = "meta";

      const time = document.createElement("div");
      time.textContent = `更新：${formatTime(x.updatedAt)}`;
      meta.appendChild(time);

      const tagsWrap = document.createElement("div");
      tagsWrap.className = "tags";
      (x.tags || []).forEach(tag => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = `#${tag}`;
        span.title = "点击按该标签搜索";
        span.addEventListener("click", async (e) => {
          e.stopPropagation();
          qEl.value = tag;
          await loadNotes({ resetPage: true });
        });
        tagsWrap.appendChild(span);
      });
      meta.appendChild(tagsWrap);

      content.appendChild(meta);

      const right = document.createElement("div");
      right.className = "right";

      const btnPin = document.createElement("button");
      btnPin.className = "iconBtn";
      btnPin.textContent = x.pinned ? "📌" : "📍";
      btnPin.title = x.pinned ? "取消置顶" : "置顶";
      btnPin.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const updated = await updateNote(x.id, { pinned: !x.pinned });
          Object.assign(x, updated);
          render();
        } catch (err) {
          toast(err.message || err, "error");
        }
      });

      const btnEdit = document.createElement("button");
      btnEdit.className = "iconBtn";
      btnEdit.textContent = "✏️";
      btnEdit.title = "编辑";
      btnEdit.addEventListener("click", (e) => {
        e.stopPropagation();
        openMemoModal(x.id);
      });

      right.appendChild(btnPin);
      right.appendChild(btnEdit);

      card.appendChild(left);
      card.appendChild(content);
      card.appendChild(right);
      card.addEventListener("click", () => openMemoModal(x.id));
listEl.appendChild(card);

// 仅在内容被截断时启用底部渐隐（避免短内容出现“变色”）
requestAnimationFrame(() => {
  const overflow = body.scrollHeight > body.clientHeight + 1;
  body.classList.toggle("fade", overflow);
});

    }
  }

  // ---- Memo modal
  function openMemoModal(idOrNull) {
    editingId = idOrNull || null;
    const isEdit = !!editingId;
    const x = isEdit ? memos.find(m => m.id === editingId) : null;

    modalTitleEl.textContent = isEdit ? "编辑备忘录" : "新建备忘录";
    btnDeleteEl.classList.toggle("hidden", !isEdit);
    if (btnShareEl) btnShareEl.classList.toggle("hidden", !isEdit || !me?.authenticated);


    mTitleEl.value = x?.title || "";
    mBodyEl.value = x?.body || "";
    mTagsEl.value = (x?.tags || []).join(", ");
    mDoneEl.checked = !!x?.done;
    mPinnedEl.checked = !!x?.pinned;

    maskEl.classList.remove("hidden");
    modalEl.classList.remove("hidden");
    setTimeout(() => mTitleEl.focus(), 0);
  }

  function closeMemoModal() {
    editingId = null;
    maskEl.classList.add("hidden");
    modalEl.classList.add("hidden");
  }

  async function saveMemoModal() {
    const title = (mTitleEl.value || "").trim();
    const body = (mBodyEl.value || "").trim();
    const tags = parseTags(mTagsEl.value);
    const done = !!mDoneEl.checked;
    const pinned = !!mPinnedEl.checked;

    if (!title && !body) {
      toast("标题和内容至少填写一个。", "error");
      return;
    }

    try {
      if (editingId) {
        const updated = await updateNote(editingId, { title, body, tags, done, pinned });
        const idx = memos.findIndex(x => x.id === editingId);
        if (idx >= 0) memos[idx] = updated;
      } else {
        const created = await createNote({ title, body, tags, done, pinned });
        memos.unshift(created);
      }
      closeMemoModal();
      await loadNotes();
    } catch (e) {
      toast(e.message || e, "error");
    }
  }

  async function doDeleteMemo() {
    if (!editingId) return;
    const ok = await uiConfirm("确定删除这条备忘录吗？", { title: "删除备忘录", danger: true });
    if (!ok) return;
    try {
      await deleteNote(editingId);
      closeMemoModal();
      await loadNotes();
    } catch (e) {
      toast(e.message || e, "error");
    }
  }

  // ---- Import/Export (client-side file, server-side store)
  async function exportJson() {
  const q = (qEl?.value || "").trim();
  const filter = filterEl?.value || "all";
  const sort = sortEl?.value || "updated_desc";

  let page = 1;
  const pageSize = 100;
  const all = [];

  while (true) {
    const params = new URLSearchParams({
      q, filter, sort,
      page: String(page),
      pageSize: String(pageSize),
    });
    const data = await api(`/api/notes?${params.toString()}`);
    const items = data.items || [];
    all.push(...items);

    const total = Number(data.total ?? all.length);
    if (all.length >= total || items.length === 0) break;
    page++;
  }

  const content = JSON.stringify(all, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `memos_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
    const text = await file.text();
    let arr;
    try {
      arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error("JSON 应为数组");
    } catch (e) {
      toast("导入失败：JSON 格式不正确", "error");
      return;
    }
    // 逐条创建（简单可靠）
    let ok = 0, fail = 0;
    for (const x of arr) {
      try {
        await createNote({
          title: String(x.title || ""),
          body: String(x.body || ""),
          tags: Array.isArray(x.tags) ? x.tags.map(String) : parseTags(String(x.tags || "")),
          done: !!x.done,
          pinned: !!x.pinned,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    toast(`导入完成：成功 ${ok} 条，失败 ${fail} 条`, "success");
    await loadNotes();
  }

  // ---- Admin UI
  function openAdmin() {
  adminMsg.textContent = "";
  adminMask.classList.remove("hidden");
  adminModal.classList.remove("hidden");
  // ✅ 每次打开都保证 Tab 事件绑定成功
  bindAdminTabs();
  // ✅ 默认进入用户 Tab（或者你想默认 notes 也行）
  setAdminTab("users");
  // ✅ 关键：立刻拉取用户列表
  refreshUsers();
}
  function bindAdminTabs() {
  const tabUsers = document.getElementById("adminTabUsers");
  const tabNotes = document.getElementById("adminTabNotes");

  // 元素还没渲染出来就直接返回（下次 openAdmin 再绑）
  if (!tabUsers || !tabNotes) return;

  // 防止重复绑定
  if (!tabUsers.dataset.bound) {
    tabUsers.dataset.bound = "1";
    tabUsers.addEventListener("click", (e) => {
      e.preventDefault();
      setAdminTab("users");
    });
  }

  if (!tabNotes.dataset.bound) {
    tabNotes.dataset.bound = "1";
    tabNotes.addEventListener("click", (e) => {
      e.preventDefault();
      setAdminTab("notes");
    });
  }
}
  function closeAdmin() {
    adminMask.classList.add("hidden");
    adminModal.classList.add("hidden");
  }

  async function refreshUsers() {
    try {
      const data = await api("/api/admin/users", { method: "GET" });
      const users = data.items || [];
      usersList.innerHTML = "";
      usersEmpty.classList.toggle("hidden", users.length !== 0);

      for (const u of users) {
        const row = document.createElement("div");
        row.className = "adminNoteRow userRow";

        const name = document.createElement("div");
        name.className = "u";
        name.textContent = u.username;

        const pill = document.createElement("div");
        pill.className = "pill";
        pill.textContent = u.role;

        const created = document.createElement("div");
        created.className = "smallmuted";
        created.textContent = `创建：${formatTime(u.createdAt)}  更新：${formatTime(u.updatedAt)}`;

        const roleSel = document.createElement("select");
        roleSel.className = "select";
        roleSel.innerHTML = `<option value="user">普通用户</option><option value="admin">管理员</option>`;
        roleSel.value = u.role;

        const passInput = document.createElement("input");
        passInput.className = "input";
        passInput.placeholder = "重置口令（可选）";

        const btnSave = document.createElement("button");
        btnSave.className = "btn primary";
        btnSave.textContent = "保存";
        btnSave.addEventListener("click", async () => {
          try {
            await api(`/api/admin/users/${encodeURIComponent(u.id)}`, {
              method: "PATCH",
              body: JSON.stringify({
                role: roleSel.value,
                passcode: (passInput.value || "").trim() || undefined,
              }),
            });
            adminMsg.textContent = "已保存。";
            await refreshUsers();
          } catch (e) {
            adminMsg.textContent = `保存失败：${e.message || e}`;
          }
        });

        const btnDel = document.createElement("button");
        btnDel.className = "btn danger";
        btnDel.textContent = "删除";
        btnDel.addEventListener("click", async () => {
          const ok = await uiConfirm(`确定删除用户 ${u.username} 吗？`, { title: "删除用户", danger: true });
          if (!ok) return;
          try {
            await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE" });
            adminMsg.textContent = "已删除。";
            await refreshUsers();
          } catch (e) {
            adminMsg.textContent = `删除失败：${e.message || e}`;
          }
        });

        row.appendChild(name);
        row.appendChild(pill);
        row.appendChild(created);
        row.appendChild(roleSel);
        row.appendChild(passInput);
        row.appendChild(btnSave);
        row.appendChild(btnDel);

        usersList.appendChild(row);
      }
    } catch (e) {
      adminMsg.textContent = `加载用户失败：${e.message || e}`;
    }
  }


  function setAdminTab(which){
  const tabUsers = document.getElementById("adminTabUsers");
  const tabNotes = document.getElementById("adminTabNotes");
  const panelUsers = document.getElementById("adminPanelUsers");
  const panelNotes = document.getElementById("adminPanelNotes");

  const isNotes = which === "notes";
  tabUsers?.classList.toggle("active", !isNotes);
  tabNotes?.classList.toggle("active", isNotes);

  panelUsers?.classList.toggle("hidden", isNotes);
  panelNotes?.classList.toggle("hidden", !isNotes);

  // ✅ 关键：切到哪个 tab 就加载哪个
  if (isNotes) refreshAdminNotes?.();
  else refreshUsers();
}

  function ownerLabel(n) {
    if (n && n.ownerUsername) return `${n.ownerUsername} · user`;
    if (n && n.ownerType === "guest") return "游客 · guest";
    return (n && n.ownerId) ? String(n.ownerId) : "unknown";
  }

  function rebuildAdminNotesOwners(owners = null) {
  if (!adminNotesOwner) return;
  const prev = adminNotesOwner.value || "";

  adminNotesOwner.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "所有创建者";
  adminNotesOwner.appendChild(optAll);

  const list = Array.isArray(owners) ? owners : [];
  for (const o of list) {
    const id = String(o.ownerId || "");
    if (!id) continue;
    const opt = document.createElement("option");
    opt.value = id;
    const name = o.ownerUsername ? `${o.ownerUsername} (${id})` : id;
    opt.textContent = name;
    adminNotesOwner.appendChild(opt);
  }

  adminNotesOwner.value = prev;
}

  
// --- Admin: Note full-view (better UI)
let __adminNoteViewReady = false;

function ensureAdminNoteViewer() {
  if (__adminNoteViewReady) return;

  let mask = document.getElementById("adminNoteViewMask");
  let modal = document.getElementById("adminNoteViewModal");

  if (!mask) {
    mask = document.createElement("div");
    mask.id = "adminNoteViewMask";
    mask.className = "mask hidden";
    document.body.appendChild(mask);
  }
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "adminNoteViewModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modalHeader">
        <div class="modalTitle" id="adminNoteViewTitle">(无标题)</div>
        <button class="iconBtn" id="btnAdminNoteViewX" type="button" title="关闭">✕</button>
      </div>
      <div class="modalBody">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;">
          <div class="smallmuted" id="adminNoteViewMeta"></div>
          <span class="spacer"></span>
          <div class="adminNoteViewActions">
            <button class="btn small" id="btnAdminNoteCopy" type="button">复制内容</button>
            <button class="btn small" id="btnAdminNoteCopyAll" type="button">复制标题+内容</button>
            <button class="btn small" id="btnAdminNoteDownload" type="button">下载 TXT</button>
            <button class="btn small" id="btnAdminNoteViewClose" type="button">关闭</button>
          </div>
        </div>
        <div class="adminNoteViewBodyWrap">
          <pre class="adminNoteViewBody" id="adminNoteViewBody"></pre>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const close = () => closeAdminNoteView();

  // click mask to close
  mask.addEventListener("click", close);

  // close buttons
  modal.querySelector("#btnAdminNoteViewClose")?.addEventListener("click", close);
  modal.querySelector("#btnAdminNoteViewX")?.addEventListener("click", close);

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const mm = document.getElementById("adminNoteViewModal");
      if (mm && !mm.classList.contains("hidden")) close();
    }
  });

  __adminNoteViewReady = true;
}

async function __copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }
}

function openAdminNoteView(n) {
  ensureAdminNoteViewer();

  const mask = document.getElementById("adminNoteViewMask");
  const modal = document.getElementById("adminNoteViewModal");
  const titleEl = document.getElementById("adminNoteViewTitle");
  const metaEl = document.getElementById("adminNoteViewMeta");
  const bodyEl = document.getElementById("adminNoteViewBody");

  if (!mask || !modal || !titleEl || !metaEl || !bodyEl) {
    // fallback (shouldn't happen)
    uiAlert(((n?.title || "(无标题)") + "\n\n" + (n?.body || "")).trim(), { title: "备忘录详情" });
    return;
  }

  const t = (n?.title || "(无标题)").trim() || "(无标题)";
  const b = (n?.body || "");
  titleEl.textContent = t;

  const idText = n?.id ? ` · ${n.id}` : "";
  const meta = `创建者：${ownerLabel(n)} · 创建：${formatTime(n.createdAt || "")} · 更新：${formatTime(n.updatedAt || "")}${idText}`;
  metaEl.textContent = meta;

  bodyEl.textContent = b;

  // actions
  modal.querySelector("#btnAdminNoteCopy")?.addEventListener("click", async () => {
    await __copyToClipboard(b || "");
  }, { once: true });

  modal.querySelector("#btnAdminNoteCopyAll")?.addEventListener("click", async () => {
    await __copyToClipboard((t + "\n\n" + (b || "")).trim());
  }, { once: true });

  modal.querySelector("#btnAdminNoteDownload")?.addEventListener("click", () => {
    try {
      const blob = new Blob([b || ""], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (t || "note") + ".txt";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (_) {}
  }, { once: true });

  mask.classList.remove("hidden");
  modal.classList.remove("hidden");

  // scroll to top
  bodyEl.parentElement?.scrollTo?.({ top: 0 });
}

function closeAdminNoteView() {
  const mask = document.getElementById("adminNoteViewMask");
  const modal = document.getElementById("adminNoteViewModal");
  if (mask) mask.classList.add("hidden");
  if (modal) modal.classList.add("hidden");
}

  function renderAdminNotes() {
    adminNotesList.innerHTML = "";
    adminNotesEmpty.classList.toggle("hidden", (adminNotes || []).length !== 0);
    if ((adminNotes || []).length === 0) return;

    for (const n of (adminNotes || [])) {
      const row = document.createElement("div");
      row.className = "userRow";

      const main = document.createElement("div");
      main.className = "adminNoteMain";

      const title = document.createElement("div");
      title.className = "adminNoteTitle";
      title.textContent = n.title || "(无标题)";

      const snippet = document.createElement("div");
      snippet.className = "adminNoteSnippet";
      snippet.textContent = (n.body || "").slice(0, 120);

      const meta = document.createElement("div");
      meta.className = "smallmuted";
      meta.textContent = `创建者：${ownerLabel(n)} · 更新：${formatTime(n.updatedAt || "")}`;

      main.appendChild(title);
      main.appendChild(snippet);
      main.appendChild(meta);

      const spacer = document.createElement("div");
      spacer.className = "spacer";

      const btn = document.createElement("button");
      btn.className = "btn small";
      btn.type = "button";
      btn.textContent = "查看全文";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openAdminNoteView(n);
      });

      row.appendChild(main);
      row.appendChild(spacer);
      row.appendChild(btn);
      adminNotesList.appendChild(row);
    }
  }



async function refreshAdminNotes(opts = { resetPage: false }) {
  adminNotesMsg.textContent = "加载中…";
  if (opts?.resetPage) adminNotesPage = 1;

  try { adminNotesAbort?.abort(); } catch {}
  adminNotesAbort = new AbortController();

  const params = new URLSearchParams({
    q: (adminNotesSearch?.value || "").trim(),
    ownerId: (adminNotesOwner?.value || "").trim(),
    page: String(adminNotesPage),
    pageSize: String(ADMIN_PAGE_SIZE),
  });

  try {
    const data = await api(`/api/admin/notes?${params.toString()}`, { method: "GET", signal: adminNotesAbort.signal });

const list = Array.isArray(data.items) ? data.items
           : Array.isArray(data.notes) ? data.notes
           : [];
adminNotes = list;
adminNotesTotal = Number(data.total ?? data.page?.total ?? list.length);
adminNotesPage = Number(data.pageNum ?? data.page?.pageNum ?? adminNotesPage ?? 1);
adminNotesLoaded = true;
    adminNotesMsg.textContent = "";

    if (Array.isArray(data.owners)) rebuildAdminNotesOwners(data.owners);
    updateAdminPager(adminNotesTotal);
    renderAdminNotes();
  } catch (e) {
    if (e?.name === "AbortError") return;
    adminNotesMsg.textContent = "加载失败：" + (e.message || e);
  }
}

  async function createUser() {
    const u = (newUsername.value || "").trim();
    const p = (newPasscode.value || "").trim();
    const r = newRole.value;
    if (!u || !p) {
      adminMsg.textContent = "请输入用户名和口令。";
      return;
    }
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify({ username: u, passcode: p, role: r }) });
      newUsername.value = "";
      newPasscode.value = "";
      adminMsg.textContent = "创建成功。";
      await refreshUsers();
    } catch (e) {
      adminMsg.textContent = `创建失败：${e.message || e}`;
    }
  }

  // ---- events
  $("btnNew").addEventListener("click", () => openMemoModal(null));
  $("btnExport").addEventListener("click", () => exportJson());

  $("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await importJson(file);
    e.target.value = "";
  });

  $("btnClose").addEventListener("click", closeMemoModal);
  
  // ---- share
  function closeShareModal() {
    if (!shareModal) return;
    shareMask.classList.add("hidden");
    shareModal.classList.add("hidden");
    shareForMemoId = null;
    if (shareMsg) shareMsg.textContent = "";
    if (shareLink) shareLink.value = "";
  }

  async function openShareModal(memoId) {
    if (!memoId) {
      toast("请先保存备忘录后再分享。", "error");
      return;
    }
    if (!me || !me.authenticated) {
      toast("请先登录后再分享。", "error");
      return;
    }
    shareForMemoId = memoId;
    if (shareMsg) shareMsg.textContent = "";
    if (shareLink) shareLink.value = "";
    if (shareMask) shareMask.classList.remove("hidden");
    if (shareModal) shareModal.classList.remove("hidden");
  }

  async function createShareLink() {
    if (!shareForMemoId) return;
    const burn = !!(shareBurn && shareBurn.checked);
    const hoursRaw = (shareExpireHours && shareExpireHours.value) ? String(shareExpireHours.value).trim() : "";
    const expireHours = hoursRaw ? Number(hoursRaw) : 0;
    if (hoursRaw && (!Number.isFinite(expireHours) || expireHours < 0)) {
      shareMsg.textContent = "有效期请输入非负数字（小时）。";
      return;
    }
    shareMsg.textContent = "生成中...";
    try {
      const data = await api("/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          noteId: shareForMemoId,
          burnAfterRead: burn,
          expireHours: expireHours || 0,
        }),
      });
      // data: { url } or { token } depending on backend
      const url = data.url || (data.token ? (location.origin + "/share.html?token=" + encodeURIComponent(data.token)) : "");
      if (!url) throw new Error("后端未返回分享链接。");
      shareLink.value = url;
      shareMsg.textContent = "已生成。";
    } catch (e) {
      shareMsg.textContent = `生成失败：${e.message || e}`;
    }
  }

  async function copyShareLink() {
    const v = shareLink && shareLink.value ? shareLink.value : "";
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      shareMsg.textContent = "已复制到剪贴板。";
    } catch {
      // fallback
      const el = shareLink;
      el.focus();
      el.select();
      document.execCommand("copy");
      shareMsg.textContent = "已复制到剪贴板。";
    }
  }

$("btnCancel").addEventListener("click", closeMemoModal);
  $("btnSave").addEventListener("click", saveMemoModal);
  $("btnDelete").addEventListener("click", doDeleteMemo);

  // share
  if (btnShareEl) btnShareEl.addEventListener("click", () => openShareModal(editingId));
  if (btnShareClose) btnShareClose.addEventListener("click", closeShareModal);
  if (shareMask) shareMask.addEventListener("click", closeShareModal);
  if (btnShareCreate) btnShareCreate.addEventListener("click", createShareLink);
  if (btnShareCopy) btnShareCopy.addEventListener("click", copyShareLink);
  maskEl.addEventListener("click", closeMemoModal);

  // search/filter/sort
  const debouncedSearch = debounce(() => loadNotes({ resetPage: true }), SEARCH_DEBOUNCE_MS);
  qEl.addEventListener("input", debouncedSearch);
  filterEl.addEventListener("change", () => loadNotes({ resetPage: true }));
  sortEl.addEventListener("change", () => loadNotes({ resetPage: true }));

  // login modal events
  $("btnSwitch").addEventListener("click", openLogin);
  $("btnLogout").addEventListener("click", logout);
  $("btnGuest").addEventListener("click", loginAsGuest);
  $("btnLogin").addEventListener("click", loginAsUser);

  $("btnLoginClose").addEventListener("click", closeLogin);
  $("btnLoginCancel").addEventListener("click", closeLogin);
  loginMask.addEventListener("click", closeLogin);

  // admin modal events
  btnAdmin.addEventListener("click", openAdmin);
  // Admin tabs: bind once to avoid occasional non-responsive clicks
  adminTabUsers.addEventListener("click", () => setAdminTab("users"));
  adminTabNotes.addEventListener("click", () => setAdminTab("notes"));
  btnGuestTools.addEventListener("click", openGuestTools);
  btnGuestToolsClose.addEventListener("click", closeGuestTools);
  btnGuestToolsCancel.addEventListener("click", closeGuestTools);
  guestToolsMask.addEventListener("click", closeGuestTools);
  btnGenRecover.addEventListener("click", genRecoverCode);
  btnCopyRecover.addEventListener("click", async () => {
    try {
      if (recoverCodeOut.value) await navigator.clipboard.writeText(recoverCodeOut.value);
      setStatus(guestToolsMsg, recoverCodeOut.value ? "已复制" : "没有可复制的恢复码", recoverCodeOut.value ? "ok" : "warn");
    } catch {
      setStatus(guestToolsMsg, "复制失败，请手动复制。", "error");
    }
  });
  btnUseRecover.addEventListener("click", useRecoverCode);
  btnGuestUpgrade.addEventListener("click", guestUpgrade);
  $("btnAdminClose").addEventListener("click", closeAdmin);
  $("btnAdminCancel").addEventListener("click", closeAdmin);
  adminMask.addEventListener("click", closeAdmin);
  $("btnCreateUser").addEventListener("click", createUser);
  // admin notes events
  btnAdminNotesRefresh.addEventListener("click", refreshAdminNotes);

// Admin notes: server-side search / filter with debounce
if (adminNotesSearch) {
  adminNotesSearch.addEventListener("input", debounce(() => refreshAdminNotes({ resetPage: true }), SEARCH_DEBOUNCE_MS));
}
if (adminNotesOwner) {
  adminNotesOwner.addEventListener("change", () => refreshAdminNotes({ resetPage: true }));
}
  btnAdminNoteViewClose && btnAdminNoteViewClose.addEventListener("click", closeAdminNoteView);
  btnAdminNoteViewX && btnAdminNoteViewX.addEventListener("click", closeAdminNoteView);
  adminNoteViewMask && adminNoteViewMask.addEventListener("click", closeAdminNoteView);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modalEl.classList.contains("hidden")) closeMemoModal();
      if (!loginModal.classList.contains("hidden")) closeLogin();
      if (!adminNoteViewModal.classList.contains("hidden")) closeAdminNoteView();
       if (!adminModal.classList.contains("hidden")) closeAdmin();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      qEl.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      openMemoModal(null);
    }
  });

  // ---- init
  (async () => {
    await refreshMe();
    if (!me.authenticated) openLogin();
    else await loadNotes();
  })();
})();
