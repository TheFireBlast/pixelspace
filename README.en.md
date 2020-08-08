<div>
	<a href="README.md">
        <img src="https://www.countryflags.io/br/flat/16.png" style="vertical-align:middle">
        <span>Português</span>
    </a>
    |
	<span>
        <img src="https://www.countryflags.io/us/flat/16.png" style="vertical-align:middle">
        <span>English</span>
    </span>
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
*Requires [NodeJS 12+](https://nodejs.org/)*

- Clone the repository
  - `git clone https://github.com/TheFireBlast/pixelspace && cd pixelspace`
  - or download through the site
- `npm install` inside the folder to install the required modules
- Make a file named `.env` and put these environment variables inside:
    ```py
    admin=mysecretkey#access key for the game's api
    discord_id=#discord's application id (for logging in)
    discord_secret=#discord's application secret key (for logging in)
    discord_webhook=#discord webhook for logs
    # the database uses google spreadsheets to store data
    # if you want to use json instead, you'll have to edit Database.js
    sheet_key=#spreadsheet id
    sheet_client_email=#google service account's email
    sheet_private_key=#google service account's private key
    dev=local
    PORT=80
    ```
- Execute with NodeJS: `node src/server`
- Open the website through a browser: `http://localhost:80`
