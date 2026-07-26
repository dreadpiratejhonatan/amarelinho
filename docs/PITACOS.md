# Pitacos — fluxo do dono

```
Galera manda → Dono aprova → Copia pedido → Cursor implementa → No ar
```

## Painel

https://jhonatanribeiro.com/amarelinho/pitacos/aprovacao.php

1. **Novos** — Aprovar / Recusar  
2. **Aprovados** — Copiar pedido do dia → colar no Cursor  
3. **No ar** — quando já estiver no site, marcar

## Agente (Cursor)

O texto copiado já traz regras de branch, `AMA_BUILD`, build e deploy.  
Depois do Deploy HostGator verde, o dono marca o lote como **No ar**.

## PIN

Secret GitHub `PITACOS_ADMIN_PIN` — nunca no repositório.
