# PICBRAND — FinOps Experience

Aplicação web para o totem de check-in do evento e para a experiência mobile de networking acessada via QR Code.

## Rodar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra o endereço exibido no terminal. A rota inicial é o fluxo do totem.

## Rotas

- `#/totem` — início e acesso ao sorteio
- `#/totem/presenca` — lista de presença
- `#/totem/qrcode/:id` — confirmação e QR Code
- `#/networking` — participantes no mobile
- `#/networking/perfil/:id` — perfil e pessoas da mesma empresa

## Dados e integração futura

Todos os dados mockados estão em `src/data.js`. Para conectar uma API, substitua a origem de `participants`, `companies` e `event`, mantendo o mesmo formato dos objetos ou adaptando-os nesse arquivo.

O QR Code usa a origem atual da aplicação e aponta para `#/networking`, por isso funciona tanto localmente quanto em uma publicação.

## Build de produção

```bash
npm run build
npm run preview
```

Os arquivos finais são gerados na pasta `dist/`.
