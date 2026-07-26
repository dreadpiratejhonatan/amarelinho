<?php
/**
 * Configuração da caixa de sugestões.
 * Altere ADMIN_PIN antes de compartilhar o link de aprovação.
 */
return [
  // PIN para /sugestoes/aprovacao.php — troque depois do primeiro deploy
  'admin_pin' => 'boteco',
  // Fuso do “mesmo dia” (tickets agrupados por data)
  'timezone' => 'America/Sao_Paulo',
  // Limite de envios por IP por hora
  'rate_limit_per_hour' => 12,
  // Tamanhos máximos
  'max_title' => 80,
  'max_body' => 2000,
];
