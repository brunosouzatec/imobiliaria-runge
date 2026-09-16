# Docker e deploy

## Rodar localmente

1. Copie `.env.example` para `.env`.
2. Preencha `MAPBOX_TOKEN` com o token público do Mapbox.
3. Execute:

```bash
docker compose up --build
```

O sistema ficará disponível em `http://localhost:3000` e o banco será persistido no volume Docker `runge-data`.
O MySQL é publicado somente em `127.0.0.1:3306`; a aplicação conversa com ele pela rede interna do Compose.
O app local ainda usa HTTP. Em produção, mantenha a porta 3000 protegida por firewall até configurar um proxy HTTPS com domínio e certificado. Só defina `TRUST_PROXY=true` quando o app aceitar tráfego exclusivamente de um proxy confiável que sobrescreva `X-Forwarded-For` e `X-Forwarded-Proto`.
`MAPBOX_TOKEN` é enviado ao navegador para renderizar o mapa: configure somente um token público `pk.` com escopos e URLs permitidos no painel do Mapbox. Tokens secretos `sk.` são recusados pela aplicação.

### Desenvolvimento sem reconstruir a cada edição

Para desenvolvimento local, use o Compose adicional, que monta `apps/` e `packages/` no container. Alterações do frontend ficam disponíveis imediatamente; alterações do backend reiniciam o processo Node automaticamente:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Depois da primeira construção, não é necessário `--build` para alterações no código. O Compose padrão e o workflow de produção não incluem esse arquivo de desenvolvimento.

O Compose permanece na raiz do repositório de propósito: mover o arquivo pode alterar o nome dos volumes nomeados e fazer a aplicação iniciar com um volume de banco vazio. O Dockerfile da aplicação está em `infra/Dockerfile` e é referenciado pelo Compose.

O código da aplicação está organizado em `apps/frontend`, `apps/backend` e `packages/shared`. A interface continua sendo servida pelo backend no mesmo domínio e nas mesmas rotas.

## Modo de manutenção

Para colocar o site temporariamente offline, defina `MAINTENANCE_MODE=true` no `.env` do servidor e recrie somente o serviço da aplicação:

```bash
sed -i '/^MAINTENANCE_MODE=/d' .env
printf '%s\n' 'MAINTENANCE_MODE=true' >> .env
IMAGE_NAME=ghcr.io/brunosouzatec/imobiliaria-runge:latest docker compose up -d --no-build --remove-orphans imobiliaria-runge
```

Durante a manutenção, as páginas e APIs respondem com HTTP `503` e exibem `manutencao.html`. O endpoint `/healthz` continua disponível para monitoramento. Para reabrir o site, altere o valor para `false` e execute o mesmo comando.

O valor padrão é `false`, portanto uma nova implantação não coloca o site em manutenção por acidente.

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
