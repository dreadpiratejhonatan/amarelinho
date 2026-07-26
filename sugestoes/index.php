<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
$today = ama_today();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#c9a000" />
  <title>Sugestões — Amarelinho</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="wrap">
    <p class="kicker">Caixa do boteco · <?= ama_h($today) ?></p>
    <h1 class="brand">SUGESTÕES</h1>
    <p class="lead">
      Em vez de mandar no Zap, escreve aqui a ideia pra mudar o Amarelinho.
      Cada envio vira um ticket do dia. Depois a gente aprova, monta o prompt e sobe pra produção.
    </p>

    <nav class="nav">
      <a href="../">← Voltar pro bar</a>
      <a href="aprovacao.php">Aprovação (dono)</a>
    </nav>

    <section class="card">
      <form id="suggest-form">
        <label>
          Seu nome (opcional)
          <input name="author" maxlength="40" placeholder="Ex: Ju, Pedrão…" autocomplete="nickname" />
        </label>
        <label>
          Título curto
          <input name="title" maxlength="80" required placeholder="Ex: Mais luz na calçada" />
        </label>
        <label>
          O que mudar?
          <textarea name="body" maxlength="2000" required placeholder="Conta com calma: o que tá estranho, o que quer ver no bar…"></textarea>
        </label>
        <button class="btn" type="submit">Enviar ticket de hoje</button>
      </form>
      <div id="suggest-msg" class="msg" role="status"></div>
      <p id="today-count" class="meta">Carregando contagem do dia…</p>
    </section>

    <section class="card">
      <h2 class="day-title" style="font-size:22px">Como rola</h2>
      <p class="lead" style="margin:0">
        1) Você manda a ideia · 2) o dono aprova no painel · 3) os tickets aprovados do <strong>mesmo dia</strong>
        viram um prompt só · 4) o agente aplica e publica.
      </p>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
