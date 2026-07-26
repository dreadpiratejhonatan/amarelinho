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
    <p class="lead">Escreve a ideia e manda. Sem nome, sem cadastro.</p>

    <nav class="nav">
      <a href="../">← Voltar pro bar</a>
    </nav>

    <section class="card">
      <form id="suggest-form">
        <label>
          Sua sugestão
          <textarea name="body" maxlength="2000" required placeholder="O que mudar no Amarelinho?"></textarea>
        </label>
        <button class="btn" type="submit">Enviar</button>
      </form>
      <div id="suggest-msg" class="msg" role="status"></div>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
