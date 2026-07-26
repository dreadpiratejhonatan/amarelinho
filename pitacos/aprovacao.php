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
  <title>Aprovar pitacos — Amarelinho</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="wrap wrap--admin">
    <p class="kicker">Comanda do dono</p>
    <h1 class="brand">PITACOS</h1>
    <p class="lead">Aprova o que a galera mandou. Depois manda pro bar. Simples assim.</p>

    <nav class="nav">
      <a href="./">← Caixa da galera</a>
      <a href="../">Bar</a>
    </nav>

    <ol class="pipeline" aria-label="Fluxo">
      <li class="pipeline__step" data-step="1"><span>1</span> Novos</li>
      <li class="pipeline__step" data-step="2"><span>2</span> Aprovados</li>
      <li class="pipeline__step" data-step="3"><span>3</span> No ar</li>
    </ol>

    <section class="card" id="login-card">
      <form id="pin-form">
        <label>
          PIN
          <div class="pin-row">
            <input name="pin" type="password" required autocomplete="current-password" placeholder="Seu PIN" />
            <button class="btn" type="submit">Entrar</button>
          </div>
        </label>
      </form>
      <div id="admin-msg" class="msg" role="status"></div>
    </section>

    <section id="admin-card" hidden>
      <div class="card">
        <div class="toolbar">
          <label style="margin:0">
            Dia
            <select id="day-select"></select>
          </label>
          <button type="button" class="btn btn--ghost" id="btn-refresh">Atualizar</button>
          <button type="button" class="btn btn--ghost" id="btn-logout">Sair</button>
        </div>
        <p id="day-stats" class="meta meta--stats"></p>
      </div>

      <section class="card flow-card">
        <h2 class="day-title">1 · Novos</h2>
        <p class="flow-help">O que chegou pra você olhar.</p>
        <div class="row-actions">
          <button type="button" class="btn" id="btn-approve-all">Aprovar todos</button>
        </div>
        <div id="list-pending" class="ticket-list"></div>
      </section>

      <section class="card flow-card">
        <h2 class="day-title">2 · Aprovados</h2>
        <p class="flow-help">Esses vão pro bar. Copia o pedido e manda no Cursor.</p>
        <div id="list-approved" class="ticket-list"></div>
        <textarea id="day-prompt" class="prompt-box" hidden readonly aria-hidden="true"></textarea>
        <div class="row-actions">
          <button type="button" class="btn" id="btn-copy-prompt">Copiar pedido do dia</button>
        </div>
      </section>

      <section class="card flow-card">
        <h2 class="day-title">3 · No ar</h2>
        <p class="flow-help">Já tá no site? Fecha a comanda do dia.</p>
        <div class="row-actions">
          <button type="button" class="btn" id="btn-ship-all">Marcar como no ar</button>
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
