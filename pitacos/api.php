<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
  if ($method === 'GET' && $action === 'days') {
    if (!ama_admin_ok()) {
      ama_json_response(['ok' => false, 'error' => 'Não autorizado'], 401);
    }
    $days = ama_list_days();
    ama_json_response(['ok' => true, 'days' => $days, 'today' => ama_today()]);
  }

  if ($method === 'GET' && $action === 'list') {
    if (!ama_admin_ok()) {
      ama_json_response(['ok' => false, 'error' => 'Não autorizado'], 401);
    }
    $day = (string) ($_GET['day'] ?? ama_today());
    $tickets = ama_load_day($day);
    ama_json_response([
      'ok' => true,
      'day' => $day,
      'tickets' => $tickets,
      'stats' => ama_day_stats($tickets),
      'prompt' => ama_compile_prompt($day),
    ]);
  }

  if ($method === 'GET' && $action === 'prompt') {
    if (!ama_admin_ok()) {
      ama_json_response(['ok' => false, 'error' => 'Não autorizado'], 401);
    }
    $day = (string) ($_GET['day'] ?? ama_today());
    ama_json_response([
      'ok' => true,
      'day' => $day,
      'prompt' => ama_compile_prompt($day),
    ]);
  }

  if ($method === 'GET' && $action === 'today_count') {
    $tickets = ama_load_day(ama_today());
    ama_json_response([
      'ok' => true,
      'day' => ama_today(),
      'count' => count($tickets),
      'pending' => count(array_filter($tickets, static fn($t) => ($t['status'] ?? '') === 'pending')),
    ]);
  }

  if ($method === 'POST' && $action === 'submit') {
    $body = ama_read_json_body();
    if (!ama_rate_ok(ama_client_ip())) {
      ama_json_response(['ok' => false, 'error' => 'Calma aí — muitos pitacos deste IP. Tenta de novo em uma hora.'], 429);
    }
    $ticket = ama_create_ticket((string) ($body['body'] ?? ''));
    unset($ticket['ip']);
    ama_json_response(['ok' => true, 'ticket' => $ticket]);
  }

  if ($method === 'POST' && $action === 'login') {
    $body = ama_read_json_body();
    $pin = (string) ($body['pin'] ?? '');
    if (ama_admin_login($pin)) {
      ama_json_response(['ok' => true]);
    }
    ama_json_response(['ok' => false, 'error' => 'PIN incorreto'], 401);
  }

  if ($method === 'POST' && $action === 'logout') {
    ama_admin_logout();
    ama_json_response(['ok' => true]);
  }

  if ($method === 'POST' && $action === 'status') {
    if (!ama_admin_ok()) {
      ama_json_response(['ok' => false, 'error' => 'Não autorizado'], 401);
    }
    $body = ama_read_json_body();
    $day = (string) ($body['day'] ?? '');
    $id = (string) ($body['id'] ?? '');
    $status = (string) ($body['status'] ?? '');
    $ticket = ama_update_status($day, $id, $status);
    $tickets = ama_load_day($day);
    ama_json_response([
      'ok' => true,
      'ticket' => $ticket,
      'stats' => ama_day_stats($tickets),
      'prompt' => ama_compile_prompt($day),
    ]);
  }

  // Passo 1 em lote: todos os novos → aprovados
  if ($method === 'POST' && $action === 'approve_pending') {
    if (!ama_admin_ok()) {
      ama_json_response(['ok' => false, 'error' => 'Não autorizado'], 401);
    }
    $body = ama_read_json_body();
    $day = (string) ($body['day'] ?? ama_today());
    $n = ama_bulk_status($day, 'pending', 'approved');
    $tickets = ama_load_day($day);
    ama_json_response([
      'ok' => true,
      'changed' => $n,
      'stats' => ama_day_stats($tickets),
      'prompt' => ama_compile_prompt($day),
    ]);
  }

  // Passo 4: aprovados do dia → no ar (depois do deploy verde)
  if ($method === 'POST' && $action === 'ship_approved') {
    if (!ama_admin_ok()) {
      ama_json_response(['ok' => false, 'error' => 'Não autorizado'], 401);
    }
    $body = ama_read_json_body();
    $day = (string) ($body['day'] ?? ama_today());
    $n = ama_bulk_status($day, 'approved', 'shipped');
    $tickets = ama_load_day($day);
    ama_json_response([
      'ok' => true,
      'changed' => $n,
      'stats' => ama_day_stats($tickets),
      'prompt' => ama_compile_prompt($day),
    ]);
  }

  ama_json_response(['ok' => false, 'error' => 'Ação inválida'], 400);
} catch (InvalidArgumentException $e) {
  ama_json_response(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
  ama_json_response(['ok' => false, 'error' => 'Erro interno'], 500);
}
