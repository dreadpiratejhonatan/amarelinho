# Amarelinho — Noite no boteco

Jogo 3D no navegador (Three.js): uma noite no **Amarelinho**, boteco inspirado num bar real. Ande pela calçada, converse com os garçons (cada um tem uma história), sente numa mesa, peça no balcão e veja o pedido chegar na bandeja.

| Onde | URL |
| --- | --- |
| **Produção (HostGator)** | https://jhonatanribeiro.com/amarelinho/ |
| **GitHub Pages** | https://dreadpiratejhonatan.github.io/amarelinho/ |
| **Repo** | https://github.com/dreadpiratejhonatan/amarelinho |

## Garçons

| Nome | Perfil |
| --- | --- |
| **Toninho** | Cara de ranzinza |
| **Fabin** | Sorriso estampado |
| **Seu Oliveira** | Velho moreno simpático |
| **Val** | Cabelo médio grisalho |
| **Ney** | Velhinho simpático, cabelo curto bem branco |
| **Carlinhos** | Moreno, sempre de boné |

## Controles

| Tecla / gesto | Ação |
| --- | --- |
| WASD / stick | Mover |
| Mouse / arrastar | Olhar |
| Shift | Correr |
| Espaço | Pular |
| E / botão E | Interagir / sentar / levantar |
| Esc | Soltar mouse / levantar / fechar diálogo |

## Rodar localmente

```bash
npm install
npm run start:win
```

Abra http://127.0.0.1:5174/

## Branches e deploy

| Branch | O que faz |
| --- | --- |
| `develop` | push → CI + **FTP HostGator** + Pages |
| `main` | estável + Pages |
| `cursor/*` | Cloud Agent (celular) → auto-merge na `develop` → deploy |

**Celular (Cursor Cloud Agent):** mesmo fluxo do Neve Selvagem — prompt no app → PR `cursor/*` → auto-merge → HostGator. Guia: [`docs/MOBILE-AUTO-PROD.md`](docs/MOBILE-AUTO-PROD.md) · [`AGENTS.md`](AGENTS.md)

Detalhes e secrets: [`docs/DEPLOY.md`](docs/DEPLOY.md)

```bash
npm run build   # dist/ + release/hostgator-amarelinho/
```

Secrets FTP (mesmos nomes do `snow`): `HOSTGATOR_FTP_HOST`, `HOSTGATOR_FTP_USER`, `HOSTGATOR_FTP_PASSWORD`, `HOSTGATOR_FTP_DIR`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/set-ftp-secrets.ps1
```
