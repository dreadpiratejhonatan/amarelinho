# Deploy — Amarelinho

Site: **https://jhonatanribeiro.com/amarelinho/**

## Deploy automático (GitHub Actions → FTP)

Workflow: [`.github/workflows/deploy-hostgator.yml`](../.github/workflows/deploy-hostgator.yml)

Dispara em **push na `develop`** ou manualmente em Actions → **Deploy HostGator**.

### Secrets do repositório

`Settings → Secrets and variables → Actions` — **só os nomes**; valores ficam só no GitHub:

| Secret | Conteúdo |
| --- | --- |
| `HOSTGATOR_FTP_HOST` | host FTP |
| `HOSTGATOR_FTP_USER` | usuário FTP dedicado do Amarelinho |
| `HOSTGATOR_FTP_PASSWORD` | senha FTP |
| `HOSTGATOR_FTP_DIR` | pasta remota (raiz da conta FTP jail, em geral `/` ou `./`) |
| `PITACOS_ADMIN_PIN` | PIN do painel `/pitacos/aprovacao.php` (não vai pro git; só no servidor) |

Mesmo esquema do Neve Selvagem (`snow`): conta FTP própria jailada em `public_html/amarelinho/`.

Script auxiliar (pede os valores e grava no repo):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/set-ftp-secrets.ps1
```

### Branches

| Branch | Papel |
| --- | --- |
| `develop` | desenvolvimento + deploy HostGator (e Pages) |
| `main` | estável + GitHub Pages |

## GitHub Pages

Workflow: [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)

URL típica: https://dreadpiratejhonatan.github.io/amarelinho/

Em **Settings → Pages → Source: GitHub Actions**.

## Build local / pacote manual

```bash
npm run build
```

- `dist/` — preview (`npm run preview`)
- `release/hostgator-amarelinho/` — conteúdo para `public_html/amarelinho/`

## FTP sync state

Se apagar arquivos no File Manager e o deploy Action ficar verde sem subir nada, apague no servidor:

`.ftp-deploy-sync-state.json`

e rode de novo **Deploy HostGator**.

## Checklist pós-deploy

- [ ] https://jhonatanribeiro.com/amarelinho/ abre
- [ ] Console: `[Amarelinho] build vXX` (cache atual)
- [ ] Hard refresh `Ctrl+Shift+R`
