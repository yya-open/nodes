(() => {
  // ---- API
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : (typeof data === "string" ? data : JSON.stringify(data));
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
  let editingId = null;

  let adminNotes = [];
  let adminNotesLoaded = false;

  // ---- message UI
  function setStatus(el, text = "", kind = "") {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "error", "warn");
    if (kind) el.classList.add(kind);
  }

  function clearLoginForm() {
    if (loginUser) loginUser.value = "";
    if (loginPass) loginPass.value = "";
    setStatus(loginMsg, "");
  }

  // ---- dom
  const $ = (id) => document.getElementById(id);

  const listEl = $("list");
  const emptyEl = $("empty");
  const statsEl = $("stats");
  const qEl = $("q");
  const filterEl = $("filter");
  const sortEl = $("sort");

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
  async function loadNotes() {
    if (!me.authenticated) return;
    const params = new URLSearchParams({
      q: (qEl.value || "").trim(),
      filter: filterEl.value,
      sort: sortEl.value,
    });
    const data = await api(`/api/notes?${params.toString()}`);
    memos = data.items || [];
    render();
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
  function updateStats(filteredCount) {
    const total = memos.length;
    const done = memos.filter(x => x.done).length;
    const pinned = memos.filter(x => x.pinned).length;
    statsEl.textContent = `共 ${total} 条 · 已完成 ${done} 条 · 置顶 ${pinned} 条 · 当前显示 ${filteredCount} 条`;
  }

  function render() {
    const items = memos.slice(); // server already filtered/sorted
    listEl.innerHTML = "";
    updateStats(items.length);

    if (items.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    for (const x of items) {
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
          alert(e.message || e);
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
          await loadNotes();
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
          alert(err.message || err);
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
      alert("标题和内容至少填写一个。");
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
      alert(e.message || e);
    }
  }

  async function doDeleteMemo() {
    if (!editingId) return;
    const ok = confirm("确定删除这条备忘录吗？");
    if (!ok) return;
    try {
      await deleteNote(editingId);
      closeMemoModal();
      await loadNotes();
    } catch (e) {
      alert(e.message || e);
    }
  }

  // ---- Import/Export (client-side file, server-side store)
  async function exportJson() {
    const params = new URLSearchParams({ q: "", filter: "all", sort: "updated_desc" });
    const data = await api(`/api/notes?${params.toString()}`);
    const content = JSON.stringify(data.items || [], null, 2);
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
      alert("导入失败：JSON 格式不正确");
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
    alert(`导入完成：成功 ${ok} 条，失败 ${fail} 条`);
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
        row.className = "userRow";

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
          const ok = confirm(`确定删除用户 ${u.username} 吗？`);
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

  function rebuildAdminNotesOwners() {
    if (!adminNotesOwner) return;
    const prev = (adminNotesOwner.value || "").trim();
    const map = new Map();
    for (const n of (adminNotes || [])) {
      const id = String(n.ownerId || "").trim();
      if (!id) continue;
      map.set(id, ownerLabel(n));
    }
    // clear + rebuild
    adminNotesOwner.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "所有创建者";
    adminNotesOwner.appendChild(optAll);

    const items = Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "zh"));
    for (const [id, label] of items) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      adminNotesOwner.appendChild(opt);
    }
    if (prev && map.has(prev)) adminNotesOwner.value = prev;
    else adminNotesOwner.value = "";
  }

  function openAdminNoteView(n) {
    if (!adminNoteViewModal) return;
    adminNoteViewTitle.textContent = n.title || "(无标题)";
    const meta = `创建者：${ownerLabel(n)} · 创建：${formatTime(n.createdAt || "")} · 更新：${formatTime(n.updatedAt || "")}`;
    adminNoteViewMeta.textContent = meta;
    adminNoteViewBody.textContent = n.body || "";
    adminNoteViewMask.classList.remove("hidden");
    adminNoteViewModal.classList.remove("hidden");
  }

  function closeAdminNoteView() {
    if (!adminNoteViewModal) return;
    adminNoteViewMask.classList.add("hidden");
    adminNoteViewModal.classList.add("hidden");
  }

  function renderAdminNotes() {
    const q = (adminNotesSearch.value || "").trim().toLowerCase();
    const ownerSel = (adminNotesOwner && adminNotesOwner.value) ? adminNotesOwner.value.trim() : "";
    const list = (adminNotes || []).filter((n) => {
      if (ownerSel && String(n.ownerId || "") !== ownerSel) return false;
      if (!q) return true;
      const hay = `${n.title || ""} ${n.body || ""} ${n.ownerUsername || ""} ${n.ownerId || ""}`.toLowerCase();
      return hay.includes(q);
    });

    adminNotesList.innerHTML = "";
    adminNotesEmpty.classList.toggle("hidden", list.length !== 0);
    if (list.length === 0) return;

    for (const n of list) {
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


async function refreshAdminNotes() {
    adminNotesMsg.textContent = "加载中…";
    try {
      const data = await api("/api/admin/notes", { method: "GET" });
      adminNotes = data.notes || data || [];
      adminNotesLoaded = true;
      adminNotesMsg.textContent = "";
      rebuildAdminNotesOwners();
      renderAdminNotes();
    } catch (e) {
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
      alert("请先保存备忘录后再分享。");
      return;
    }
    if (!me || !me.authenticated) {
      alert("请先登录后再分享。");
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
          expiresInSeconds: (expireHours > 0 ? Math.round(expireHours * 3600) : 0) || 0,
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
  qEl.addEventListener("input", () => loadNotes());
  filterEl.addEventListener("change", () => loadNotes());
  sortEl.addEventListener("change", () => loadNotes());

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
  adminNotesSearch.addEventListener("input", renderAdminNotes);
  adminNotesOwner && adminNotesOwner.addEventListener("change", renderAdminNotes);
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