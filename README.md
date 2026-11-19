# Santa Ceia com a Família · elloeterno.com.br

Site de uma página para as famílias agendarem a **Santa Ceia com a Família** na AD Brás (Ello Eterno).

A página tem a barra preta com o logo Ello | AD Brás, o banner da campanha (horizontal no computador, vertical no celular) e o cartão da agenda. Depois de agendar, a pessoa vê o dia e o horário marcados e o aviso de que a equipe entra em contato em breve.

- **Datas:** 1 a 5 de dezembro de 2026.
- **Horários liberados na planilha:** de 20 em 20 minutos.
  - Terça a sexta: 19h às 22h. O das 22h só existe nas salas 03 a 11.
  - Sábado: 8h às 11h20.
- **Formulário:** a pessoa informa nome, WhatsApp e quantas pessoas vêm e escolhe o dia num calendário de dezembro (1 a 5 em destaque).
  - Os horários daquele dia aparecem ao lado do calendário.
  - Uma família por sala em cada horário, com 11 salas (SALA 01 a SALA 11).
  - O site não mostra contagem de vagas. Um horário lotado aparece riscado e não pode ser escolhido.

**Regra dos horários (segue a planilha):**

- Célula com o modelo "Nome Tel:" = horário liberado naquela sala.
- Célula vazia = horário fechado naquela sala.
- O site mostra, em cada dia, só os horários liberados em pelo menos uma sala. Para abrir ou fechar um horário, basta mexer na planilha.
- A lista `horarios` do `index.html` só vale enquanto a planilha não responde.

O site é estático (HTML, CSS e JS, sem build) e é publicado pelo GitHub Pages a partir da raiz da branch `main`.

```
index.html                  página + CONFIGURAÇÃO (window.CEIA, no topo do arquivo)
assets/css/style.css        visual (barra preta, banner e cartão da agenda)
assets/js/main.js           calendário, horários, envio e confirmação
assets/img/                 banners (computador e celular), logo, ícones e imagem de compartilhamento
assets/fonts/               Anton e Raleway (licença OFL)
integracoes/santa-ceia.gs   Apps Script da planilha dos resultados (recebe os agendamentos)
CNAME                       domínio elloeterno.com.br
```

## 1. Configuração

Tudo fica no bloco `window.CEIA`, no topo do `index.html`:

| Campo | O que é |
|---|---|
| `planilhaEndpoint` | URL `/exec` do Apps Script da planilha da agenda. Vazio: o formulário não envia e avisa que o agendamento abre em instantes |
| `dias` | Um item por dia, com data, nome do dia e os horários liberados (iguais aos da planilha) |

## 2. Planilha dos resultados (Apps Script)

Os agendamentos vão para a planilha **Ceia - Natal 2026**: https://docs.google.com/spreadsheets/d/1hIeWo5zZPacSsMYuxGCj9LpRy6RbJsFIrjsrriclG1c

Ela espelha a agenda oficial (**ADBRÁS SEDE - AGENDA - SANTA CEIA DA FAMÍLIA**), no visual do Ello:

- **Agendamentos:** a lista de tudo, em ordem de dia e horário, com sala, nome, pessoas, WhatsApp (link "Abrir conversa") e o **texto pronto para colar na agenda**.
- **SALA 01 a SALA 11:** as mesmas linhas e colunas da agenda.
  - O site grava cada família na primeira sala livre do dia e horário, no formato da agenda ("Nome  - 2 Pessoas … Tel: 11 91234-5678").
  - A célula preenchida pelo site fica laranja clara e ganha a nota "Agendado pelo site em ...".
  - As 9 reservas que já estavam na agenda foram copiadas para cá.

**Para passar para a agenda oficial:** copie o intervalo `C5:H16` de uma sala e cole no mesmo lugar da sala correspondente na agenda com **Ctrl+Shift+V** (só os valores, sem trazer as cores).

- Como as reservas antigas também estão aqui, colar o intervalo não apaga nenhuma delas.
- Reserva feita à mão daqui para frente: faça também nesta planilha, senão a próxima colagem apaga.

Para ligar o script, uma vez só:

1. Abra a planilha **Ceia - Natal 2026** → **Extensões → Apps Script**.
2. Apague o código de exemplo, cole o conteúdo de `integracoes/santa-ceia.gs` e salve.
3. **Implantar → Nova implantação →** engrenagem → **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e autorize com a sua conta Google.
4. Copie a URL que termina em `/exec` e cole em `planilhaEndpoint`, no `index.html`.
5. Teste: abra a URL `/exec` no navegador. Deve aparecer `{"ok":true,"salas":11,"vagas":{...}}`.

Para conferir o que o script enxerga, rode a função `testarLeitura` no editor (Executar) e veja o registro.

Se alterar o script: **Implantar → Gerenciar implantações →** lápis → **Versão: Nova versão → Implantar**. A URL continua a mesma.

## 3. Publicação

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

- **Banners:** arte da campanha (`banner-desktop.webp` 1920×1080 e `banner-mobile.webp` 840×2000). A imagem de compartilhamento (`og-santa-ceia.jpg`) é o banner horizontal recortado em 1200×630.
- **Fontes:** Anton e Raleway, licença SIL OFL 1.1 (`assets/fonts/LICENSE-OFL.txt`).
  - A ID visual usa **Tusker Grotesk** nos títulos, mas ela é paga e não tem licença para web; a Anton é a substituta.
