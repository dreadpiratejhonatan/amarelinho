# Pitacos do Amarelinho

Caixa pública em **`/amarelinho/pitacos/`** (HostGator / PHP).

## Fluxo

1. A galera abre a página, escreve o **pitaco** e clica **Mandar pitaco** (anônimo) → ticket do dia.
2. Dono entra em **`aprovacao.php`** com o PIN (`config.php`).
3. Aprova / recusa cada pitaco.
4. Copia o **prompt do dia** (só aprovados) e cola no Cursor Agent pra implementar e subir.

## PIN

Edite `admin_pin` em `config.php` depois do primeiro deploy.

## Dados

A pasta `data/` fica no servidor e **não é apagada** pelo FTP (`dangerous-clean-slate: false`). Não versionamos os pitacos no git.
