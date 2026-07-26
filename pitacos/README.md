# Pitacos do Amarelinho — fluxo padrão

Caixa pública: **`/amarelinho/pitacos/`**  
Painel admin: **`/amarelinho/pitacos/aprovacao.php`**

## Fluxo padrão (sempre igual)

| Passo | O quê | Onde |
| --- | --- | --- |
| **0** | Galera manda o pitaco (anônimo) | `/pitacos/` |
| **1** | Pitacos ficam **Novos** (lote do dia) | painel |
| **2** | Admin **Aprova** (ou recusa) | painel · botão “Aprovar todos” |
| **3** | Admin **Copia o prompt do lote** | painel |
| **4** | Cola no **Cursor Agent** → PR `cursor/*` → auto-merge → Deploy HostGator | Cursor + Actions |
| **5** | Deploy verde → admin **Marca lote no ar** | painel |

Status possíveis: `pending` (Novo) → `approved` (Aprovado) → `shipped` (No ar), ou `rejected` (Recusado).

## PIN (segredo)

Secret do GitHub: **`PITACOS_ADMIN_PIN`**

`Settings → Secrets and variables → Actions`

No Deploy HostGator o Action gera `config.local.php` só no servidor (bloqueado pra HTTP, fora do git).

## Dados

Pasta `data/YYYY-MM-DD/` no servidor — um arquivo JSON por pitaco. Não sobe no FTP sync da pasta de tickets.
