# Painel de Performance — App instalável (iPhone e Android)

Este pacote é um **PWA (Progressive Web App)**: um site que se instala como app,
com ícone na tela inicial, tela cheia (sem barra do navegador) e funciona offline
depois do primeiro acesso. Não depende do Claude para funcionar.

## 1. Colocar o app no ar (escolha uma opção gratuita)

Você precisa hospedar esses arquivos em algum lugar com HTTPS (obrigatório para instalar como app):

- **Netlify Drop** (mais simples): acesse https://app.netlify.com/drop e arraste esta
  pasta inteira. Em segundos você recebe um link (ex: `seunome.netlify.app`).
- **Vercel**: `vercel.com` → "Add New Project" → importar esta pasta.
- **GitHub Pages**: subir os arquivos para um repositório e ativar Pages nas configurações.

Qualquer uma dessas opções é gratuita e não exige conhecimento técnico avançado.

## 2. Instalar no iPhone

1. Abra o link no **Safari** (precisa ser o Safari, não funciona pelo Chrome no iOS).
2. Toque no ícone de compartilhar (quadrado com seta para cima).
3. Toque em **"Adicionar à Tela de Início"**.
4. Pronto — o ícone aparece na tela inicial como um app normal.

## 3. Instalar no Android

1. Abra o link no **Chrome**.
2. Toque no menu (⋮) no canto superior direito.
3. Toque em **"Instalar aplicativo"** (ou "Adicionar à tela inicial").
4. Pronto — o ícone aparece na tela inicial e abre em tela cheia.

## Sobre os dados

Os dados (refeições, água, peso, corridas) ficam salvos **no armazenamento local do
navegador/dispositivo** onde o app foi instalado. Isso significa:
- Funciona offline depois do primeiro carregamento.
- Os dados **não sincronizam automaticamente entre celular e computador** — cada
  instalação guarda os seus próprios dados.
- Se limpar os dados do navegador/app, o histórico é perdido.

## Importante sobre "app para iPhone e Android"

Este PWA cobre praticamente toda a experiência de um app nativo (ícone, tela cheia,
funciona offline, sem precisar de loja). Só não é literalmente um app publicado na
App Store / Google Play — isso exigiria conta de desenvolvedor paga, Xcode/Android
Studio, processo de revisão da Apple/Google, e não é algo que dá pra concluir dentro
de uma conversa. Se um dia quiser ir por esse caminho, o próximo passo natural seria
usar uma ferramenta como o Capacitor para empacotar esse mesmo código como app nativo.
