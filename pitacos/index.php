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
  <meta name="description" content="Manda teu pitaco pro Amarelinho — ideia, melhoria ou correção. Anônimo e direto." />
  <title>Meu pitaco — Amarelinho</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="page-suggest">
  <div class="glow" aria-hidden="true"></div>
  <div class="lamp" aria-hidden="true"></div>

  <main class="stage">
    <a class="back" href="../">← Voltar pro bar</a>

    <header class="hero">
      <p class="hero__eyebrow">Noite no boteco</p>
      <h1 class="hero__brand">AMARELINHO</h1>
      <p class="hero__line">Manda teu pitaco</p>
      <p class="hero__sub">
        Ideia nova, melhoria, correção, coisa que tá faltando — escreve do jeito que vier na cabeça.
        Sem nome. A gente lê, aprova e sobe pro bar.
      </p>
    </header>

    <form id="suggest-form" class="napkin" autocomplete="off">
      <label class="napkin__label" for="suggest-body">Meu pitaco</label>
      <textarea
        id="suggest-body"
        name="body"
        maxlength="2000"
        required
        rows="8"
        placeholder="Ex.: a calçada podia ficar mais clara…&#10;ou o Fabin podia ter mais falas…&#10;ou o botão E no celular às vezes não pega…"
      ></textarea>
      <div class="napkin__foot">
        <span id="char-count" class="napkin__count" aria-live="polite">2000</span>
        <button class="btn btn--send" type="submit">Mandar pitaco</button>
      </div>
      <div id="suggest-msg" class="msg" role="status"></div>
    </form>

    <p class="reassure">
      Fica entre a gente e a comanda. Nada de perfil, nada de Zap —
      só o teu pitaco pro Amarelinho.
    </p>
  </main>

  <script src="app.js"></script>
</body>
</html>
