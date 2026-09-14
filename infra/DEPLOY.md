# Docker e deploy

## Rodar localmente

1. Copie `.env.example` para `.env`.
2. Preencha `MAPBOX_TOKEN` com o token público do Mapbox.
3. Execute:

```bash
docker compose up --build
```

O sistema ficará disponível em `http://localhost:3000` e o banco será persistido no volume Docker `runge-data`.

O Compose permanece na raiz do repositório de propósito: mover o arquivo pode alterar o nome dos volumes nomeados e fazer a aplicação iniciar com um volume de banco vazio. O Dockerfile da aplicação está em `infra/Dockerfile` e é referenciado pelo Compose.

O código da aplicação está organizado em `apps/frontend`, `apps/backend` e `packages/shared`. A interface continua sendo servida pelo backend no mesmo domínio e nas mesmas rotas.

## GitHub Actions + GHCR

O workflow `.github/workflows/deploy.yml` constrói a imagem e publica em:

```text
ghcr.io/brunosouzatec/imobiliaria-runge:latest
```

O job de deploy via SSH só é executado quando os secrets abaixo estiverem configurados no repositório:

- `DEPLOY_HOST`: IP ou domínio do servidor Docker.
- `DEPLOY_USER`: usuário SSH.
- `DEPLOY_SSH_KEY`: chave privada SSH.
- `DEPLOY_PATH`: diretório de deploy.
- `GHCR_READ_TOKEN`: token do GitHub com permissão `read:packages`.
- `MAPBOX_TOKEN`: token público do Mapbox.

O servidor de destino precisa ter Docker instalado e permitir acesso SSH. O banco fica no volume `runge-data` e não é incluído na imagem.
