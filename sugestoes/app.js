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
  const countEl = document.getElementById("today-count");

  api("today_count")
    .then((d) => {
      if (countEl) {
        countEl.textContent =
          d.count === 0
            ? `Nenhuma sugestão ainda hoje (${d.day}).`
            : `${d.count} sugestão(ões) hoje · ${d.pending} aguardando aprovação.`;
      }
    })
    .catch(() => {
      if (countEl) {
        countEl.textContent =
          "Servidor de sugestões indisponível aqui (precisa do PHP na HostGator). Em produção: /amarelinho/sugestoes/";
      }
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const author = form.author.value.trim();
    const title = form.title.value.trim();
    const body = form.body.value.trim();
    if (!title || !body) {
      showMsg(msg, "Escreve um título e a sugestão.", false);
      return;
    }
    btn.disabled = true;
    try {
      const data = await api("submit", {
        method: "POST",
        body: { author, title, body },
      });
      form.reset();
      showMsg(
        msg,
        `Ticket ${data.ticket.id} enviado pro dia ${data.ticket.day}. Valeu! Agora espera a aprovação.`,
        true
      );
      const d = await api("today_count");
      if (countEl) {
        countEl.textContent = `${d.count} sugestão(ões) hoje · ${d.pending} aguardando aprovação.`;
      }
    } catch (err) {
      showMsg(msg, err.message || "Não rolou enviar.", false);
    } finally {
      btn.disabled = false;
    }
  });
}

function statusBadge(status) {
  const span = document.createElement("span");
  span.className = `badge badge--${status || "pending"}`;
  const labels = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Recusado",
    shipped: "No ar",
  };
  span.textContent = labels[status] || status;
  return span;
}

function wireAdmin() {
  const loginCard = document.getElementById("login-card");
  const adminCard = document.getElementById("admin-card");
  if (!loginCard || !adminCard) return;

  const pinForm = document.getElementById("pin-form");
  const msg = document.getElementById("admin-msg");
  const daySelect = document.getElementById("day-select");
  const listEl = document.getElementById("ticket-list");
  const promptEl = document.getElementById("day-prompt");
  const dayTitle = document.getElementById("day-title");

  async function refresh(day) {
    const data = await api("list", { day });
    dayTitle.textContent = `Tickets · ${data.day}`;
    promptEl.value = data.prompt || "";
    listEl.innerHTML = "";
    if (!data.tickets.length) {
      listEl.innerHTML = '<p class="empty">Nenhum ticket neste dia.</p>';
      return;
    }
    for (const t of data.tickets) {
      const card = document.createElement("article");
      card.className = "ticket";
      const head = document.createElement("div");
      head.className = "ticket__head";
      const id = document.createElement("span");
      id.className = "ticket__id";
      id.textContent = t.id;
      head.append(id, statusBadge(t.status));
      const title = document.createElement("div");
      title.className = "ticket__title";
      title.textContent = t.title;
      const author = document.createElement("div");
      author.className = "ticket__author";
      author.textContent = `${t.author || "Anônimo"} · ${t.createdAt || ""}`;
      const body = document.createElement("div");
      body.className = "ticket__body";
      body.textContent = t.body || "";
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const mk = (label, status, ghost) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = ghost ? "btn btn--ghost" : "btn";
        b.textContent = label;
        b.addEventListener("click", async () => {
          try {
            const res = await api("status", {
              method: "POST",
              body: { day: t.day, id: t.id, status },
            });
            promptEl.value = res.prompt || "";
            await refresh(t.day);
            showMsg(msg, `Ticket ${t.id} → ${status}`, true);
          } catch (err) {
            showMsg(msg, err.message, false);
          }
        });
        return b;
      };
      if (t.status !== "approved") actions.append(mk("Aprovar", "approved"));
      if (t.status !== "rejected") actions.append(mk("Recusar", "rejected", true));
      if (t.status !== "pending") actions.append(mk("Voltar p/ pendente", "pending", true));
      if (t.status === "approved") actions.append(mk("Marcar no ar", "shipped", true));
      card.append(head, title, author, body, actions);
      listEl.appendChild(card);
    }
  }

  async function enterAdmin() {
    loginCard.hidden = true;
    adminCard.hidden = false;
    const days = await api("days");
    daySelect.innerHTML = "";
    const list = days.days.length ? days.days : [days.today];
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
    const pin = pinForm.pin.value;
    try {
      await api("login", { method: "POST", body: { pin } });
      showMsg(msg, "Entrou. Aprova os tickets do dia e copia o prompt.", true);
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

  document.getElementById("btn-copy-prompt")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(promptEl.value);
      showMsg(msg, "Prompt do dia copiado. Cola no Cursor Agent pra subir pra produção.", true);
    } catch {
      promptEl.select();
      showMsg(msg, "Seleciona o texto e copia manualmente (Ctrl/Cmd+C).", false);
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

  // Sessão já aberta?
  api("days")
    .then(() => enterAdmin())
    .catch(() => {
      /* precisa login */
    });
}

wirePublicForm();
wireAdmin();
