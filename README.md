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

Os dados iniciais estão em `src/data.js`. Na publicação, convidados, empresas e links de LinkedIn são armazenados no banco, e as novas fotos no armazenamento de imagens. A presença e o sorteio continuam vinculados ao dispositivo do totem. Em desenvolvimento com `npm run dev`, sem o backend da publicação, o app usa os dados mockados; o cadastro administrativo requer a publicação.

Na lista de presença, toque três vezes rapidamente em “Lista de presença” para escolher entre gerenciar convidados ou empresas. Após informar a senha de operação, é possível editar nome, descrição e foto de cada empresa. As alterações aparecem no card da empresa nos perfis de networking. O sorteio considera somente os convidados presentes e alterna suas fotos durante a animação.

Ao final da lista de check-in, “Adicionar convidado à lista” abre um cadastro rápido com nome e pergunta se a pessoa faz parte de uma empresa. Não é necessário informar o cargo: novos convidados recebem a descrição padrão “Convidado(a)” e uma imagem padrão. O formulário restrito de convidados usa teclado físico; a busca e o cadastro rápido mantêm o teclado na tela para o totem.

O QR Code aponta para a URL pública de produção em `/conexoes/?from=:id`, sem passar pela página inicial do totem. Para que celulares de convidados abram a página, a publicação precisa permitir acesso a visitantes sem login.

Para gerenciar links de LinkedIn, toque cinco vezes rapidamente no nome do evento no topo da página de conexões e informe a senha de operação. Links não cadastrados aparecem como indisponíveis, sem encaminhar o visitante para a página genérica do LinkedIn.

## Build de produção

```bash
npm run build
npm run preview
```

Os arquivos finais são gerados na pasta `dist/`.

Para testar a administração sem backend, configure `VITE_LOCAL_ADMIN_PASSWORD` em `.env.local`. Quando `/api/admin/verify` não existe, essa senha libera o painel e os dados editados ficam somente no armazenamento deste navegador. Esse modo não é seguro para uma publicação pública nem sincroniza alterações entre dispositivos.

O teste do backend Cloudflare pode ser executado com `node scripts/smoke-worker.mjs` após o build. O teste do backend Vercel usa `node scripts/smoke-vercel-api.mjs`.

Na Vercel, conecte o repositório GitHub ao projeto e uma base Turso Cloud ao mesmo projeto. A integração Turso fornece `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Configure `ADMIN_PASSWORD` como variável secreta de produção na Vercel e publique novamente. A senha nunca deve ser colocada no código-fonte. O backend cria as tabelas SQLite no primeiro acesso e usa o mesmo conjunto de rotas `/api/` do Worker original.
