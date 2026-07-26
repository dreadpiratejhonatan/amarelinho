<?php
/**
 * Config pública (sem segredo).
 * O PIN fica só em config.local.php, gerado no Deploy HostGator
 * a partir do secret PITACOS_ADMIN_PIN (não vai pro git).
 */
return [
  'timezone' => 'America/Sao_Paulo',
  'rate_limit_per_hour' => 12,
  'max_title' => 80,
  'max_body' => 2000,
];
