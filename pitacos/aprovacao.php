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
  <main class="wrap">
    <p class="kicker">Painel do dono</p>
    <h1 class="brand">PITACOS</h1>
    <p class="lead">
      Aprova os pitacos do dia, copia o prompt e manda pro Cursor Agent subir pra produção.
      Um lote por dia — cada pitaco fica separado no prompt.
    </p>

    <nav class="nav">
      <a href="./">← Caixa de pitacos</a>
      <a href="../">Bar</a>
    </nav>

    <section class="card" id="login-card">
      <form id="pin-form">
        <label>
          PIN de aprovação
          <div class="pin-row">
            <input name="pin" type="password" required autocomplete="current-password" placeholder="PIN" />
            <button class="btn" type="submit">Entrar</button>
          </div>
        </label>
      </form>
      <p class="meta">Só quem tem o PIN de administrador entra. O PIN não fica no site nem no código público.</p>
      <div id="admin-msg" class="msg" role="status"></div>
    </section>

    <section class="card" id="admin-card" hidden>
      <div class="toolbar">
        <label style="margin:0">
          Dia
          <select id="day-select"></select>
        </label>
        <button type="button" class="btn btn--ghost" id="btn-refresh">Atualizar</button>
        <button type="button" class="btn btn--ghost" id="btn-logout">Sair</button>
      </div>

      <h2 class="day-title" id="day-title">Pitacos</h2>
      <div id="ticket-list"></div>

      <h2 class="day-title" style="margin-top:22px;font-size:24px">Prompt do dia (aprovados)</h2>
      <textarea id="day-prompt" class="prompt-box" readonly></textarea>
      <div class="row-actions">
        <button type="button" class="btn" id="btn-copy-prompt">Copiar prompt pra produção</button>
      </div>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
