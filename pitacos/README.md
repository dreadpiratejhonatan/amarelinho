# Pitacos do Amarelinho

Caixa pública em **`/amarelinho/pitacos/`** (HostGator / PHP).

## Fluxo

1. A galera abre a página, escreve o **pitaco** e clica **Mandar pitaco** (anônimo) → ticket do dia.
2. Dono entra em **`aprovacao.php`** com o PIN de admin.
3. Aprova / recusa cada pitaco.
4. Copia o **prompt do dia** (só aprovados) e cola no Cursor Agent pra implementar e subir.

## PIN (segredo)

O PIN **não** vai no git. Fica no secret do GitHub:

`Settings → Secrets and variables → Actions → PITACOS_ADMIN_PIN`

No **Deploy HostGator**, o Action gera `pitacos/config.local.php` só no servidor.
Esse arquivo está bloqueado pra HTTP (`.htaccess`) e no `.gitignore`.

## Dados

A pasta `data/` fica no servidor e **não é apagada** pelo FTP. Não versionamos os pitacos no git.
