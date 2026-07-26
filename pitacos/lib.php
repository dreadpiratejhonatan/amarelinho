<?php
declare(strict_types=1);

const AMA_SUGESTOES_STATUSES = ['pending', 'approved', 'rejected', 'shipped'];

function ama_config(): array
{
  static $cfg = null;
  if ($cfg === null) {
    $base = require __DIR__ . '/config.php';
    $local = [];
    $localPath = __DIR__ . '/config.local.php';
    if (is_file($localPath)) {
      $loaded = require $localPath;
      if (is_array($loaded)) {
        $local = $loaded;
      }
    }
    $cfg = array_merge($base, $local);
  }
  return $cfg;
}

function ama_tz(): DateTimeZone
{
  return new DateTimeZone(ama_config()['timezone'] ?? 'America/Sao_Paulo');
}

function ama_today(): string
{
  return (new DateTimeImmutable('now', ama_tz()))->format('Y-m-d');
}

function ama_data_dir(): string
{
  return __DIR__ . '/data';
}

function ama_day_dir(string $day): string
{
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) {
    throw new InvalidArgumentException('Dia inválido');
  }
  return ama_data_dir() . '/' . $day;
}

function ama_ensure_data_dirs(): void
{
  $root = ama_data_dir();
  if (!is_dir($root)) {
    mkdir($root, 0755, true);
  }
  $ht = $root . '/.htaccess';
  if (!is_file($ht)) {
    file_put_contents($ht, "Require all denied\n");
  }
}

function ama_json_response(array $payload, int $code = 200): void
{
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function ama_read_json_body(): array
{
  $raw = file_get_contents('php://input') ?: '';
  if ($raw === '') {
    return $_POST ?: [];
  }
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function ama_clean_text(string $s, int $max): string
{
  $s = trim(preg_replace('/\s+/u', ' ', str_replace("\0", '', $s)) ?? '');
  if (function_exists('mb_substr')) {
    return mb_substr($s, 0, $max);
  }
  return substr($s, 0, $max);
}

function ama_client_ip(): string
{
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  return preg_replace('/[^0-9a-fA-F:.]/', '', $ip) ?: '0.0.0.0';
}

function ama_rate_ok(string $ip): bool
{
  ama_ensure_data_dirs();
  $limit = (int) (ama_config()['rate_limit_per_hour'] ?? 12);
  $file = ama_data_dir() . '/rate.json';
  $now = time();
  $bucket = [];
  if (is_file($file)) {
    $bucket = json_decode((string) file_get_contents($file), true) ?: [];
  }
  $hits = array_values(array_filter(
    $bucket[$ip] ?? [],
    static fn($t) => is_int($t) && ($now - $t) < 3600
  ));
  if (count($hits) >= $limit) {
    $bucket[$ip] = $hits;
    file_put_contents($file, json_encode($bucket), LOCK_EX);
    return false;
  }
  $hits[] = $now;
  $bucket[$ip] = $hits;
  // prune old IPs
  foreach ($bucket as $k => $list) {
    $bucket[$k] = array_values(array_filter(
      $list,
      static fn($t) => is_int($t) && ($now - $t) < 3600
    ));
    if ($bucket[$k] === []) {
      unset($bucket[$k]);
    }
  }
  file_put_contents($file, json_encode($bucket), LOCK_EX);
  return true;
}

function ama_list_days(): array
{
  ama_ensure_data_dirs();
  $days = [];
  foreach (scandir(ama_data_dir()) ?: [] as $name) {
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $name) && is_dir(ama_data_dir() . '/' . $name)) {
      $days[] = $name;
    }
  }
  rsort($days);
  return $days;
}

function ama_load_day(string $day): array
{
  $dir = ama_day_dir($day);
  if (!is_dir($dir)) {
    return [];
  }
  $tickets = [];
  foreach (scandir($dir) ?: [] as $name) {
    if (!preg_match('/^t-\d{8}-\d{3}\.json$/', $name)) {
      continue;
    }
    $raw = file_get_contents($dir . '/' . $name);
    $t = json_decode((string) $raw, true);
    if (is_array($t) && !empty($t['id'])) {
      $tickets[] = $t;
    }
  }
  usort($tickets, static function ($a, $b) {
    return strcmp((string) ($a['id'] ?? ''), (string) ($b['id'] ?? ''));
  });
  return $tickets;
}

function ama_ticket_path(string $day, string $id): string
{
  if (!preg_match('/^t-\d{8}-\d{3}$/', $id)) {
    throw new InvalidArgumentException('ID inválido');
  }
  return ama_day_dir($day) . '/' . $id . '.json';
}

function ama_next_id(string $day): string
{
  $compact = str_replace('-', '', $day);
  $tickets = ama_load_day($day);
  $n = count($tickets) + 1;
  foreach ($tickets as $t) {
    if (preg_match('/^t-\d{8}-(\d{3})$/', (string) ($t['id'] ?? ''), $m)) {
      $n = max($n, ((int) $m[1]) + 1);
    }
  }
  return sprintf('t-%s-%03d', $compact, $n);
}

function ama_title_from_body(string $body, int $max): string
{
  $line = trim(preg_split('/\n/', $body, 2)[0] ?? $body);
  $line = ama_clean_text($line, $max);
  return $line !== '' ? $line : 'Pitaco';
}

function ama_create_ticket(string $body): array
{
  $cfg = ama_config();
  $body = trim(str_replace("\0", '', $body));
  $body = preg_replace("/\r\n?/", "\n", $body) ?? $body;
  if (function_exists('mb_substr')) {
    $body = mb_substr($body, 0, (int) $cfg['max_body']);
  } else {
    $body = substr($body, 0, (int) $cfg['max_body']);
  }
  $body = trim($body);

  if ($body === '') {
    throw new InvalidArgumentException('Manda o pitaco.');
  }

  $title = ama_title_from_body($body, (int) $cfg['max_title']);

  ama_ensure_data_dirs();
  $day = ama_today();
  $dir = ama_day_dir($day);
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }

  $id = ama_next_id($day);
  $now = (new DateTimeImmutable('now', ama_tz()))->format(DateTimeInterface::ATOM);
  $ticket = [
    'id' => $id,
    'day' => $day,
    'createdAt' => $now,
    'title' => $title,
    'body' => $body,
    'status' => 'pending',
    'approvedAt' => null,
    'ip' => ama_client_ip(),
  ];

  $path = ama_ticket_path($day, $id);
  $ok = file_put_contents(
    $path,
    json_encode($ticket, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n",
    LOCK_EX
  );
  if ($ok === false) {
    throw new RuntimeException('Não foi possível salvar o ticket.');
  }
  return $ticket;
}

function ama_update_status(string $day, string $id, string $status): array
{
  if (!in_array($status, AMA_SUGESTOES_STATUSES, true)) {
    throw new InvalidArgumentException('Status inválido');
  }
  $path = ama_ticket_path($day, $id);
  if (!is_file($path)) {
    throw new InvalidArgumentException('Ticket não encontrado');
  }
  $ticket = json_decode((string) file_get_contents($path), true);
  if (!is_array($ticket)) {
    throw new RuntimeException('Ticket corrompido');
  }
  $ticket['status'] = $status;
  if ($status === 'approved' && empty($ticket['approvedAt'])) {
    $ticket['approvedAt'] = (new DateTimeImmutable('now', ama_tz()))->format(DateTimeInterface::ATOM);
  }
  if ($status === 'pending' || $status === 'rejected') {
    $ticket['approvedAt'] = null;
  }
  file_put_contents(
    $path,
    json_encode($ticket, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n",
    LOCK_EX
  );
  return $ticket;
}

function ama_compile_prompt(string $day, bool $approvedOnly = true): string
{
  $tickets = ama_load_day($day);
  $picked = array_values(array_filter(
    $tickets,
    static fn($t) => !$approvedOnly || (($t['status'] ?? '') === 'approved')
  ));

  $lines = [];
  $lines[] = "Implemente os pitacos aprovados do Amarelinho do dia {$day}.";
  $lines[] = 'Site: https://jhonatanribeiro.com/amarelinho/';
  $lines[] = 'Trabalho em branch cursor/*, PR para develop, bump AMA_BUILD, npm run build, e deixe pronto para auto-merge/deploy.';
  $lines[] = 'Mantenha o visual do boteco (Bebas Neue / DM Sans / amarelo), touch controls e copy em português.';
  $lines[] = '';
  if ($picked === []) {
    $lines[] = '(Nenhum pitaco aprovado neste dia.)';
    return implode("\n", $lines);
  }

  $lines[] = 'Pitacos aprovados (um por vez no mesmo dia — implemente todos abaixo):';
  $lines[] = '';
  foreach ($picked as $t) {
    $id = $t['id'] ?? '?';
    $title = $t['title'] ?? 'Pitaco';
    $body = trim((string) ($t['body'] ?? ''));
    $lines[] = "## Pitaco {$id} — {$title}";
    $lines[] = $body;
    $lines[] = '';
  }
  $lines[] = 'Ao terminar, marque esses pitacos como feitos no fluxo de aprovação se fizer sentido.';
  return implode("\n", $lines);
}

function ama_session_start(): void
{
  if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('ama_pitacos');
    session_start([
      'cookie_httponly' => true,
      'cookie_samesite' => 'Lax',
    ]);
  }
}

function ama_admin_ok(): bool
{
  ama_session_start();
  return !empty($_SESSION['ama_admin']);
}

function ama_admin_login(string $pin): bool
{
  ama_session_start();
  $expected = (string) (ama_config()['admin_pin'] ?? '');
  // Sem PIN no servidor (secret não configurado) → ninguém entra
  if ($expected === '' || !hash_equals($expected, $pin)) {
    return false;
  }
  $_SESSION['ama_admin'] = true;
  return true;
}

function ama_admin_logout(): void
{
  ama_session_start();
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
  }
  session_destroy();
}

function ama_h(?string $s): string
{
  return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
