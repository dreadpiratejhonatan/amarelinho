async function api(action, { method = "GET", body, day } = {}) {
  const url = new URL("api.php", window.location.href);
  url.searchParams.set("action", action);
  if (day) url.searchParams.set("day", day);
  const opts = {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  };
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ ok: false, error: "Resposta inválida" }));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

function showMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text;
  el.classList.add("is-on");
  el.classList.toggle("msg--ok", !!ok);
  el.classList.toggle("msg--err", !ok);
}

function wirePublicForm() {
  const form = document.getElementById("suggest-form");
  if (!form) return;
  const msg = document.getElementById("suggest-msg");
  const area = document.getElementById("suggest-body");
  const count = document.getElementById("char-count");
  const max = Number(area?.getAttribute("maxlength") || 2000);

  const refreshCount = () => {
    if (!count || !area) return;
    count.textContent = String(Math.max(0, max - area.value.length));
  };
  area?.addEventListener("input", refreshCount);
  refreshCount();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const body = (area?.value || form.body.value).trim();
    if (!body) {
      showMsg(msg, "Manda o pitaco — só não deixa em branco.", false);
      area?.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = "Mandando…";
    try {
      await api("submit", { method: "POST", body: { body } });
      form.reset();
      refreshCount();
      showMsg(msg, "Pitaco na comanda! A gente lê, aprova e coloca no bar. Valeu demais!", true);
      btn.textContent = "Mandar outro";
    } catch (err) {
      showMsg(msg, err.message || "Não rolou enviar. Tenta de novo num instante.", false);
      btn.textContent = "Mandar pitaco";
    } finally {
      btn.disabled = false;
    }
  });
}

const STATUS_LABEL = {
  pending: "Novo",
  approved: "Aprovado",
  rejected: "Recusado",
  shipped: "No ar",
};

function statusBadge(status) {
  const span = document.createElement("span");
  span.className = `badge badge--${status || "pending"}`;
  span.textContent = STATUS_LABEL[status] || status;
  return span;
}

function emptyHtml(text) {
  return `<p class="empty">${text}</p>`;
}

function wireAdmin() {
  const loginCard = document.getElementById("login-card");
  const adminCard = document.getElementById("admin-card");
  if (!loginCard || !adminCard) return;

  const pinForm = document.getElementById("pin-form");
  const msg = document.getElementById("admin-msg");
  const daySelect = document.getElementById("day-select");
  const promptEl = document.getElementById("day-prompt");
  const statsEl = document.getElementById("day-stats");
  const lists = {
    pending: document.getElementById("list-pending"),
    approved: document.getElementById("list-approved"),
    shipped: document.getElementById("list-shipped"),
    rejected: document.getElementById("list-rejected"),
  };

  function paintPipeline(stats) {
    const pending = stats?.pending || 0;
    const approved = stats?.approved || 0;
    const shipped = stats?.shipped || 0;
    document.querySelectorAll(".pipeline__step").forEach((el) => {
      el.classList.remove("is-active", "is-done");
      const step = el.getAttribute("data-step");
      if (step === "1") {
        if (pending > 0) el.classList.add("is-active");
        else if (approved > 0 || shipped > 0) el.classList.add("is-done");
      }
      if (step === "2") {
        if (approved > 0) el.classList.add("is-active");
        else if (shipped > 0 && pending === 0) el.classList.add("is-done");
      }
      if (step === "3") {
        if (approved > 0) el.classList.add("is-active");
        if (approved === 0 && shipped > 0) el.classList.add("is-done");
      }
    });
  }

  function renderTicket(t, mode) {
    const card = document.createElement("article");
    card.className = "ticket";
    const head = document.createElement("div");
    head.className = "ticket__head";
    const id = document.createElement("span");
    id.className = "ticket__id";
    id.textContent = t.id;
    head.append(id, statusBadge(t.status));

    const body = document.createElement("div");
    body.className = "ticket__body";
    body.textContent = t.body || "";

    const when = document.createElement("div");
    when.className = "ticket__author";
    when.textContent = t.createdAt || "";

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const setStatus = (status, label, primary = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = primary ? "btn" : "btn btn--ghost";
      b.textContent = label;
      b.addEventListener("click", async () => {
        try {
          await api("status", {
            method: "POST",
            body: { day: t.day, id: t.id, status },
          });
          await refresh(t.day);
          showMsg(msg, `${STATUS_LABEL[status] || status}.`, true);
        } catch (err) {
          showMsg(msg, err.message, false);
        }
      });
      return b;
    };

    if (mode === "pending") {
      actions.append(setStatus("approved", "Aprovar", true), setStatus("rejected", "Recusar"));
    } else if (mode === "approved") {
      actions.append(setStatus("pending", "Voltar"));
    } else if (mode === "rejected") {
      actions.append(setStatus("pending", "Reabrir"));
    }

    card.append(head, when, body);
    if (actions.childNodes.length) card.append(actions);
    return card;
  }

  async function refresh(day) {
    const data = await api("list", { day });
    const stats = data.stats || {};
    statsEl.textContent = `${stats.pending || 0} novos · ${stats.approved || 0} aprovados · ${stats.shipped || 0} no ar`;
    if (promptEl) promptEl.value = data.prompt || "";
    paintPipeline(stats);

    const buckets = { pending: [], approved: [], shipped: [], rejected: [] };
    for (const t of data.tickets) {
      const s = t.status || "pending";
      if (buckets[s]) buckets[s].push(t);
    }

    for (const key of Object.keys(lists)) {
      const el = lists[key];
      if (!el) continue;
      el.innerHTML = "";
      if (!buckets[key].length) {
        el.innerHTML = emptyHtml(
          {
            pending: "Nada novo por enquanto.",
            approved: "Nenhum aprovado ainda.",
            shipped: "Ainda não fechou nenhum no ar.",
            rejected: "Nenhum recusado.",
          }[key]
        );
        continue;
      }
      for (const t of buckets[key]) el.appendChild(renderTicket(t, key));
    }

    const approveAll = document.getElementById("btn-approve-all");
    const shipAll = document.getElementById("btn-ship-all");
    const copyBtn = document.getElementById("btn-copy-prompt");
    if (approveAll) approveAll.disabled = !(stats.pending > 0);
    if (shipAll) shipAll.disabled = !(stats.approved > 0);
    if (copyBtn) copyBtn.disabled = !(stats.approved > 0);
  }

  async function enterAdmin() {
    loginCard.hidden = true;
    adminCard.hidden = false;
    const days = await api("days");
    daySelect.innerHTML = "";
    const list = days.days.length ? [...days.days] : [days.today];
    if (!list.includes(days.today)) list.unshift(days.today);
    for (const d of list) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d === days.today ? `${d} (hoje)` : d;
      daySelect.appendChild(opt);
    }
    daySelect.value = days.today;
    await refresh(days.today);
  }

  pinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("login", { method: "POST", body: { pin: pinForm.pin.value } });
      showMsg(msg, "Entrou.", true);
      await enterAdmin();
    } catch (err) {
      showMsg(msg, err.message || "PIN incorreto", false);
    }
  });

  daySelect?.addEventListener("change", () => {
    refresh(daySelect.value).catch((err) => showMsg(msg, err.message, false));
  });

  document.getElementById("btn-refresh")?.addEventListener("click", () => {
    refresh(daySelect.value).catch((err) => showMsg(msg, err.message, false));
  });

  document.getElementById("btn-approve-all")?.addEventListener("click", async () => {
    try {
      const res = await api("approve_pending", {
        method: "POST",
        body: { day: daySelect.value },
      });
      await refresh(daySelect.value);
      showMsg(msg, res.changed ? `${res.changed} aprovado(s). Agora copia o pedido.` : "Nada novo.", true);
    } catch (err) {
      showMsg(msg, err.message, false);
    }
  });

  document.getElementById("btn-ship-all")?.addEventListener("click", async () => {
    if (!confirm("Já tá no site? Isso marca os aprovados do dia como no ar.")) return;
    try {
      const res = await api("ship_approved", {
        method: "POST",
        body: { day: daySelect.value },
      });
      await refresh(daySelect.value);
      showMsg(msg, res.changed ? `Fechado: ${res.changed} no ar.` : "Nada pra marcar.", true);
    } catch (err) {
      showMsg(msg, err.message, false);
    }
  });

  document.getElementById("btn-copy-prompt")?.addEventListener("click", async () => {
    const text = promptEl?.value?.trim() || "";
    if (!text || text.includes("Nenhum pitaco aprovado")) {
      showMsg(msg, "Aprova pelo menos um pitaco antes.", false);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showMsg(msg, "Pedido copiado. Cola no Cursor e manda implementar.", true);
    } catch {
      if (promptEl) {
        promptEl.hidden = false;
        promptEl.focus();
        promptEl.select();
      }
      showMsg(msg, "Copia o texto selecionado (Ctrl/Cmd+C).", false);
    }
  });

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    try {
      await api("logout", { method: "POST", body: {} });
    } catch {
      /* ignore */
    }
    location.reload();
  });

  api("days")
    .then(() => enterAdmin())
    .catch(() => {});
}

wirePublicForm();
wireAdmin();
