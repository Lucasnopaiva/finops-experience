# FinOps Experience

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
- `/conexoes/` — página independente de participantes, acessada pelo QR Code
- `/conexoes/#/perfil/:id` — perfil, LinkedIn e colegas da mesma empresa

## Dados e integração futura

Os dados iniciais estão em `src/data.js`. Na publicação, os convidados e links de LinkedIn são armazenados no banco e as novas fotos no armazenamento de imagens. A presença e o sorteio continuam vinculados ao dispositivo do totem. Em desenvolvimento com `npm run dev`, sem o backend da publicação, o app usa os dados mockados; o cadastro administrativo requer a publicação.

O QR Code usa a origem atual e aponta para `/conexoes/?from=:id`, sem passar pela página inicial do totem. Para que celulares de convidados abram a página, a publicação precisa permitir acesso a visitantes sem login.

Para gerenciar links de LinkedIn, toque cinco vezes rapidamente no nome do evento no topo da página de conexões e informe a senha de operação. Links não cadastrados aparecem como indisponíveis, sem encaminhar o visitante para a página genérica do LinkedIn.

## Build de produção

```bash
npm run build
npm run preview
```

Os arquivos finais são gerados na pasta `dist/`.

O teste do backend pode ser executado com `node scripts/smoke-worker.mjs` após o build. A senha administrativa é fornecida à publicação pela variável de ambiente `ADMIN_PASSWORD`; não deve ser colocada no código-fonte.
