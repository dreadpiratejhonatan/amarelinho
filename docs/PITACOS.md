# Fluxo padrão de pitacos

Sempre o mesmo caminho — um lote por dia (fuso `America/Sao_Paulo`).

```
Galera manda  →  Novo  →  Aprovar  →  Copiar prompt  →  Cursor Agent  →  Deploy verde  →  No ar
 /pitacos/        painel    painel       painel           PR cursor/*      HostGator         painel
```

## Status

| Status | Label | Significado |
| --- | --- | --- |
| `pending` | Novo | Acabou de chegar |
| `approved` | Aprovado | Entra no prompt do lote |
| `shipped` | No ar | Já está em produção |
| `rejected` | Recusado | Fora do lote |

## Admin

URL: https://jhonatanribeiro.com/amarelinho/pitacos/aprovacao.php  

PIN: secret GitHub `PITACOS_ADMIN_PIN` (nunca no git).

1. Aprovar novos (ou “Aprovar todos”)
2. Copiar prompt do lote
3. Colar no Cursor Agent
4. Esperar auto-merge + Deploy HostGator verde
5. “Marcar lote no ar”
