<div>
	<span>
        <img src="https://www.countryflags.io/br/flat/16.png" style="vertical-align:middle">
        <span>Português</span>
    </span>
    |
	<a href="README.en.md">
        <img src="https://www.countryflags.io/us/flat/16.png" style="vertical-align:middle">
        <span>English</span>
    </a>
</div>

<h1 align="center">PixelSpace</h1>
<p align="center">
    <a href="https://discord.gg/AVASQ78">
        <img src="https://img.shields.io/discord/696559475204554752.svg?label=Discord&logo=discord" alt="Discord"/>
    </a>
    <a href="https://pixelspace.glitch.me/">
        <img src="https://img.shields.io/badge/dynamic/json.svg?label=PixelSpace&url=https://pxspace.herokuapp.com/online&query=online&suffix=%20online" alt="Game"/>
    </a>
</p>

## Setup
*Precisa de [NodeJS 12+](https://nodejs.org/)*

- Clone o repositório
  - `git clone https://github.com/TheFireBlast/pixelspace && cd pixelspace`
  - ou baixe através do site
- `npm install` dentro da pasta para instalar todos os módulos necessários
- Crie um arquivo com o nome `.env` e coloque estas variáveis de ambiente dentro:
    ```py
    admin=minhasenhasecreta #chave da api do jogo
    discord_id=#id do aplicativo di discord (para login)
    discord_secret=#chave secreta do aplicativo do discord (para login)
    discord_webhook=#webhook do discord para logs
    # a base de dados usa o google spreadsheets para guardar os dados
    # se for usar json precisará mudar o codigo do Database.js
    sheet_key=#id da planilha
    sheet_client_email=#email da conta de serviço do goole
    sheet_private_key=#chave da conta de serviço do goole
    dev=local
    PORT=80
    ```
- Execute com o NodeJS: `node src/server`
- Abra o site pelo navegador: `http://localhost/`
