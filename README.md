# Santa Ceia da Família · elloeterno.com.br

Site de uma página para as famílias agendarem a **Santa Ceia da Família** na AD Brás (Ello Eterno).

- **Datas:** 1 a 5 de dezembro de 2026.
- **Horários:** terça a sexta, das 19h às 22h; sábado, das 8h às 12h.
- **Formulário:** a pessoa informa nome, WhatsApp e quantas pessoas vêm, escolhe o dia e depois o horário.
  - Cada dia mostra só os seus horários, de 20 em 20 minutos, igual à agenda das salas.
  - Cada horário comporta 11 famílias (SALA 01 a SALA 11).
  - O site mostra quantas vagas restam e trava os horários lotados.

O site é estático (HTML, CSS e JS, sem build) e é publicado pelo GitHub Pages a partir da raiz da branch `main`.

```
index.html                  página + CONFIGURAÇÃO (window.CEIA, no topo do arquivo)
assets/css/style.css        visual (ID do Ello, versão laranja)
assets/js/main.js           dias, horários, vagas, envio e confirmação
assets/img/                 fundo (foto da ceia desfocada), logo, ícones e imagem de compartilhamento
assets/fonts/               Anton, Raleway e Playfair Display (licença OFL)
integracoes/santa-ceia.gs   Apps Script da planilha da agenda (recebe os agendamentos)
CNAME                       domínio elloeterno.com.br
```

## 1. Configuração

Tudo fica no bloco `window.CEIA`, no topo do `index.html`:

| Campo | O que é |
|---|---|
| `planilhaEndpoint` | URL `/exec` do Apps Script da planilha da agenda. Vazio: o formulário não envia e avisa que o agendamento abre em instantes |
| `dias` | Um item por dia, com data, nome do dia, início e fim. Os horários saem de 20 em 20 minutos dentro desse intervalo |
| `duracaoMin` | Duração de cada horário (20) |
| `local`, `endereco`, `mapsLink` | Local mostrado na página, na confirmação e na agenda |

## 2. Planilha da agenda (Apps Script)

Os agendamentos vão direto para a planilha **ADBRÁS SEDE - AGENDA - SANTA CEIA DA FAMÍLIA**.

- **Onde grava:** a primeira sala livre daquele dia e horário recebe o nome, as pessoas e o telefone, no mesmo formato da agenda. A célula ganha a nota "Agendado pelo site em ...".
- **Registro:** a aba **Agendamentos do site** guarda tudo, com um link para abrir a conversa no WhatsApp.
- **Duas pessoas ao mesmo tempo no último lugar:** a segunda recebe "esse horário acabou de lotar" e escolhe outro.
- **O que já está na agenda:** as reservas feitas à mão ficam como estão. Uma célula só conta como livre quando está vazia ou só com o modelo "Nome Tel:".

Para ligar, uma vez só:

1. Abra a planilha no Google Planilhas → **Extensões → Apps Script**.
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

- **Foto de fundo:** pão e cálice, por [jhc no Unsplash](https://unsplash.com/photos/_HzRfyw7BuA) (licença Unsplash, uso livre).
- **Fontes:** Anton, Raleway e Playfair Display, licença SIL OFL 1.1 (`assets/fonts/LICENSE-OFL.txt`).
  - A ID visual usa **Tusker Grotesk** nos títulos, mas ela é paga e não tem licença para web; a Anton é a substituta.
  - A imagem de compartilhamento (`og-santa-ceia.jpg`) é uma imagem estática e usa a Tusker original.
