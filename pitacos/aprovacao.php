<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#c9a000" />
  <meta name="robots" content="noindex" />
  <title>Fluxo de pitacos — Amarelinho</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="wrap wrap--admin">
    <p class="kicker">Painel do dono · fluxo padrão</p>
    <h1 class="brand">PITACOS</h1>
    <p class="lead">
      Sempre o mesmo caminho: <strong>Novo → Aprovar → Copiar prompt → Cursor → No ar</strong>.
      Um lote por dia.
    </p>

    <nav class="nav">
      <a href="./">← Caixa pública</a>
      <a href="../">Bar</a>
    </nav>

    <ol class="pipeline" aria-label="Fluxo padrão">
      <li class="pipeline__step" data-step="1"><span>1</span> Novos</li>
      <li class="pipeline__step" data-step="2"><span>2</span> Aprovar</li>
      <li class="pipeline__step" data-step="3"><span>3</span> Prompt</li>
      <li class="pipeline__step" data-step="4"><span>4</span> Cursor</li>
      <li class="pipeline__step" data-step="5"><span>5</span> No ar</li>
    </ol>

    <section class="card" id="login-card">
      <form id="pin-form">
        <label>
          PIN de administrador
          <div class="pin-row">
            <input name="pin" type="password" required autocomplete="current-password" placeholder="PIN" />
            <button class="btn" type="submit">Entrar</button>
          </div>
        </label>
      </form>
      <p class="meta">PIN só no secret <code>PITACOS_ADMIN_PIN</code> do GitHub — nunca no código.</p>
      <div id="admin-msg" class="msg" role="status"></div>
    </section>

    <section id="admin-card" hidden>
      <div class="card">
        <div class="toolbar">
          <label style="margin:0">
            Lote do dia
            <select id="day-select"></select>
          </label>
          <button type="button" class="btn btn--ghost" id="btn-refresh">Atualizar</button>
          <button type="button" class="btn btn--ghost" id="btn-logout">Sair</button>
        </div>
        <p id="day-stats" class="meta meta--stats"></p>
      </div>

      <!-- 1 · Novos -->
      <section class="card flow-card" data-flow="1">
        <h2 class="day-title">1 · Novos</h2>
        <p class="flow-help">Pitacos que a galera mandou. Aprove ou recuse.</p>
        <div class="row-actions" id="pending-actions">
          <button type="button" class="btn" id="btn-approve-all">Aprovar todos os novos</button>
        </div>
        <div id="list-pending" class="ticket-list"></div>
      </section>

      <!-- 2 · Aprovados + 3 · Prompt -->
      <section class="card flow-card" data-flow="2">
        <h2 class="day-title">2 · Aprovados · 3 · Prompt do lote</h2>
        <p class="flow-help">Só os aprovados entram no prompt. Copie e cole no Cursor Agent.</p>
        <div id="list-approved" class="ticket-list"></div>
        <textarea id="day-prompt" class="prompt-box" readonly placeholder="Aprove pelo menos um pitaco pra gerar o prompt…"></textarea>
        <div class="row-actions">
          <button type="button" class="btn" id="btn-copy-prompt">3 · Copiar prompt do lote</button>
        </div>
      </section>

      <!-- 4 · Cursor -->
      <section class="card flow-card" data-flow="4">
        <h2 class="day-title">4 · Cursor Agent</h2>
        <ol class="flow-olist">
          <li>Cole o prompt num agente Cursor (cloud/mobile).</li>
          <li>Espere o PR <code>cursor/*</code> → auto-merge em <code>develop</code>.</li>
          <li>Espere o Action <strong>Deploy HostGator</strong> ficar verde.</li>
        </ol>
      </section>

      <!-- 5 · No ar -->
      <section class="card flow-card" data-flow="5">
        <h2 class="day-title">5 · No ar</h2>
        <p class="flow-help">Deploy verde? Feche o lote. Os aprovados viram “No ar”.</p>
        <div class="row-actions">
          <button type="button" class="btn" id="btn-ship-all">Marcar lote no ar</button>
        </div>
        <div id="list-shipped" class="ticket-list"></div>
      </section>

      <section class="card flow-card flow-card--muted">
        <h2 class="day-title" style="font-size:22px">Recusados</h2>
        <div id="list-rejected" class="ticket-list"></div>
      </section>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
