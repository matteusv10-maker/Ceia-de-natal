# Santa Ceia com a Família · elloeterno.com.br

Site de uma página para as famílias agendarem a **Santa Ceia com a Família** na AD Brás (Ello Eterno).

A página tem a barra preta com o logo Ello | AD Brás, o banner da campanha (horizontal no computador, vertical no celular) e o cartão da agenda. Depois de agendar, a pessoa vê o dia e o horário marcados e o aviso de que a equipe entra em contato em breve.

No computador tudo cabe numa dobra só:
- O fundo da campanha ocupa a tela. Por cima, o recorte do pastor com o título e a agenda ficam lado a lado, centralizados.
- O pastor ocupa a altura disponível e encolhe se a tela for estreita.
- Em telas baixas (notebook, abaixo de ~785px de altura), a agenda mantém o mesmo desenho e espaçamento e diminui por inteiro (zoom), o quanto precisar para caber.

No tablet e no celular continua o banner inteiro em cima, com a agenda embaixo.

- **Datas:** 1 a 5 de dezembro de 2026.
- **Horários liberados na planilha:** de 20 em 20 minutos.
  - Terça a sexta: 19h às 22h. O das 22h só existe nas salas 03 a 11.
  - Sábado: 8h às 11h20.
- **Formulário:** a pessoa informa nome, WhatsApp e quantas pessoas vêm e escolhe o dia num calendário de dezembro (1 a 5 em destaque).
  - Os horários daquele dia aparecem ao lado do calendário.
  - Até 11 famílias por horário (uma por sala da agenda).
  - O site não mostra contagem de vagas. Um horário lotado aparece riscado e não pode ser escolhido.

**Horários:** a lista `horarios` do `index.html` (e a lista `HORARIOS` do Apps Script, que confere o envio). Cada horário aceita até 11 famílias (`LIMITE` no Apps Script, uma por sala); quando lota, aparece riscado no site.

## 1. Configuração

Tudo fica no bloco `window.CEIA`, no topo do `index.html`:

| Campo | O que é |
|---|---|
| `planilhaEndpoint` | URL `/exec` do Apps Script da planilha **Ceia - Natal 2026** (já preenchida). Vazio: o formulário não envia e avisa que o agendamento abre em instantes |
| `dias` | Um item por dia, com data, nome do dia e os horários liberados (iguais aos da planilha) |

## 2. Planilha dos resultados (Apps Script)

Os agendamentos vão para a planilha **Ceia - Natal 2026**: https://docs.google.com/spreadsheets/d/1hIeWo5zZPacSsMYuxGCj9LpRy6RbJsFIrjsrriclG1c

A planilha tem uma aba só, **Agendamentos**, no visual do Ello e em ordem de dia e horário. Colunas:

- **Na agenda?:** caixa para marcar quando a família já foi passada para a agenda oficial; a linha fica verde.
- **Dia, Horário, Nome, Pessoas, WhatsApp** e **Conversar**, este último com o link "Abrir conversa".
- **Texto para colar na agenda:** no formato das células da agenda ("Nome  - 2 Pessoas … Tel: 11 91234-5678").
- **Agendado em**, **Chave** e **ID**: colunas ocultas. Servem para ordenar a lista, contar as famílias de cada horário e barrar agendamento repetido (mesmo WhatsApp no mesmo horário).

**Para passar para a agenda oficial:** copie o "Texto para colar na agenda", cole na sala livre daquele dia e horário e marque **Na agenda?**.

O script já está ligado: projeto **Santa Ceia - agendamentos do site** (Extensões → Apps Script na planilha), implantado como App da Web, executando como a conta dona da planilha e aberto a qualquer pessoa.

Para ligar de novo do zero (outra planilha, por exemplo):

1. Abra a planilha **Ceia - Natal 2026** → **Extensões → Apps Script**.
2. Apague o código de exemplo, cole o conteúdo de `integracoes/santa-ceia.gs` e salve.
3. **Implantar → Nova implantação →** engrenagem → **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e autorize com a sua conta Google.
4. Copie a URL que termina em `/exec` e cole em `planilhaEndpoint`, no `index.html`.
5. Teste: abra a URL `/exec` no navegador. Deve aparecer `{"ok":true,"limite":11,"ocupados":{...}}`.

Se alterar o script: **Implantar → Gerenciar implantações →** lápis → **Versão: Nova versão → Implantar**. A URL continua a mesma.

## 3. SEO e compartilhamento

O topo do `index.html` tem:
- título e descrição;
- tags de compartilhamento para WhatsApp, Instagram, Facebook e X, com a imagem `og-santa-ceia.jpg`;
- dados estruturados do evento (JSON-LD: nome, datas de 1 a 5 de dezembro e local).

Na raiz do site ficam o `robots.txt` e o `sitemap.xml`.

O local do evento está só com a cidade (São Paulo, SP). Para o Google mostrar o endereço completo, coloque a rua, o número e o CEP da sede em `location.address`, no bloco JSON-LD.

## 4. Publicação

Cada `git push` na `main` atualiza o site (GitHub Pages: *Deploy from a branch* → `main` / raiz).

O domínio **elloeterno.com.br** está no arquivo `CNAME` e em *Settings → Pages → Custom domain*. O DNS já aponta para o GitHub Pages:

- domínio raiz: registros A 185.199.108.153 a 185.199.111.153;
- `www`: CNAME para `matteusv10-maker.github.io`.

Antes, o domínio servia a página do EPOWER (repositório `Epower`), que continua em https://matteusv10-maker.github.io/Epower/.

Para rodar localmente:

```bash
python -m http.server 5173
```

## Créditos

- **Banners:** arte da campanha (`banner-desktop.webp` 1920×1080, usado no tablet, e `banner-mobile.webp` 840×2000). A imagem de compartilhamento (`og-santa-ceia.jpg`, 1200×630) junta:
  - o fundo e o recorte do pastor;
  - um cartão igual ao do site, com o logo, "Agende a ceia da sua família" (Tusker Grotesk) e o botão elloeterno.com.br.
  
  Ao trocar essa imagem, mude o `?v=` dela nas tags do `index.html`, para o WhatsApp e as redes buscarem a nova.
- **Camadas do computador**, enviadas separadas pela equipe:
  - `fundo-desktop.webp` (1920×1080): só o fundo, sem texto.
  - `heroi-santa-ceia.webp` (876×1159, com transparência): pastor, título, subtítulo e "1 a 5 de dezembro".
  - Existe também um fundo vertical para o celular; ele ainda não é usado, porque o celular continua com o banner inteiro.
- **Versão anterior:** o banner horizontal foi estendido para a direita no Gemini e depois substituído pelas camadas.
  - Conversa "Expansão horizontal de banner" (https://gemini.google.com/app/5c4eef646eeb6c64), versão 1, de 19/11/2026.
  - O arquivo bruto continua em `geradas/banner-santa-ceia-extensao-direita-gemini-v1.jpg`, fora do repositório.
- **Fontes:** Anton e Raleway, licença SIL OFL 1.1 (`assets/fonts/LICENSE-OFL.txt`).
  - A ID visual usa **Tusker Grotesk** nos títulos, mas ela é paga e não tem licença para web; a Anton é a substituta.
