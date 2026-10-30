# LikindaLine — loja online (HTML + CSS + JavaScript)

Site estático para a Vercel, com catálogo, página por produto, pedidos pelo WhatsApp e painel de administração.

## Ficheiros

| Ficheiro                                      | Função                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `index.html`                                  | Página inicial: pesquisa, categorias, ordenação, destaques, catálogo, contacto   |
| `produto.html`                                | Página individual (`produto.html?id=sumax-g89`)                                  |
| `admin.html`                                  | Painel (login + CRUD de produtos + fotografias)                                  |
| `css/style.css`                               | Estilos responsivos                                                              |
| `js/config.js`                                | **NOVO — único sítio de configuração**: WhatsApp, domínio, Supabase              |
| `js/app.js` · `js/produto.js` · `js/admin.js` | Lógica partilhada, produto, administração                                        |
| `api/produto.js`                              | **NOVO** — função da Vercel que gera a pré-visualização do Facebook em `/p/<id>` |
| `vercel.json`                                 | **NOVO** — rota `/p/:id`, cabeçalhos de segurança, `admin.html` fora do Google   |
| `supabase/schema.sql`                         | **NOVO** — tabelas e regras de segurança (RLS)                                   |
| `supabase/testimonials.sql`                    | Publicações públicas de vídeos e capturas de clientes                             |
| `img/` · `robots.txt`                         | **NOVO** — imagem de partilha, favicon, regras para motores de pesquisa          |

## 1. Testar localmente

Abre a pasta no VS Code com **Live Server**. Sem Supabase, a loja mostra produtos de demonstração, mas o painel administrativo fica bloqueado até configurares o login seguro.

## 2. Antes de publicar

1. `js/config.js` → `WHATSAPP_NUMBER`: o teu número, só dígitos, com 244 (ex.: `244923456789`).
2. Em `index.html` e `produto.html`, substitui `SEU-DOMINIO.vercel.app` pelo teu domínio real (a imagem de partilha tem de ter URL absoluto).
3. Em `js/config.js` → `SITE_URL`: `https://o-teu-dominio`.

## 3. Supabase (produtos para todos os visitantes + login seguro)

1. Cria um projeto em supabase.com e executa `supabase/schema.sql` no _SQL Editor_.
2. Em _Authentication → Users_ cria a tua conta; desativa o registo público de novos utilizadores.
3. Executa o `insert into public.admins ...` do final do ficheiro SQL com o teu email.
4. Em `js/config.js` preenche `SUPABASE_URL` e `SUPABASE_ANON_KEY` (_Project Settings → API_). Usa **só** a chave `anon`/`publishable`. **Nunca** a `service_role`. Como o site é estático, estes valores têm de estar nesse ficheiro; variáveis de ambiente da Vercel, por si só, não são lidas pelo navegador.

Acede a `admin.html` e entra com o email e a palavra-passe que criaste em Supabase. A segurança está no servidor: mesmo que alguém abra `admin.html`, sem login de administrador a base de dados recusa gravações.

### Vídeos e clientes satisfeitos

Depois de executar `schema.sql`, executa também `supabase/testimonials.sql` no SQL Editor. No painel, adiciona links HTTPS de vídeos do YouTube ou capturas de conversas; as imagens ficam no Storage, dentro da pasta `clientes/`, e são apresentadas na secção “Clientes satisfeitos” da página inicial. Publica capturas apenas com autorização dos clientes e oculta nomes, números e outros dados pessoais.

## 4. Vercel e pré-visualização no Facebook

1. Importa a pasta na Vercel (projeto estático, sem build, raiz do projeto).
2. Se alterares a configuração no `js/config.js`, publica novamente o site.
3. Em `js/config.js` põe `SHARE_PAGES: true`. A partir daí, o link partilhado de cada produto é `https://dominio/p/<id>`: o Facebook lê o título, preço e fotografia gerados no servidor e as pessoas são levadas a `produto.html`.
4. Se o Facebook mostrar uma pré-visualização antiga, usa o _Sharing Debugger_ (developers.facebook.com/tools/debug) e clica em "Scrape Again".

## Notas

- O botão do WhatsApp só abre a conversa com a mensagem escrita. Não confirma nenhuma encomenda.
- Fotografias de produtos: seleciona até 5 ficheiros JPG, PNG, WebP ou GIF no painel (máximo 10 MB cada). São reduzidos para 900 px e, com Supabase, enviados para o bucket `produtos`.
- Confirma os direitos das imagens de demonstração (Unsplash) antes de usar comercialmente.
