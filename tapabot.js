const winston = require('winston')
const express = require('express');
const querystring = require('querystring');
const discord = require('discord.js');
const client = new discord.Client();

var utime = Date();

const format = winston.format

const timezoned = () => {
    return new Date().toLocaleString();
}

const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: timezoned }),
        format.simple(),
        format.printf(info => `${info.timestamp} ${info.level} ${info.message}`)
    ),
    transports: [
        new winston.transports.Console({level: 'info'}),
        new winston.transports.File({filename: '/var/log/tapabot.log', level: 'info'})
    ]
});

let stocks = {}

const app = express();
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());
app.post("/stocks", (req, res) => {
    logger.info('New stocks info arrived.')
    stocks = req.body;
    utime = Date();

    res.send("OK")
});
app.listen(8080)

if(process.env.DISCORD_BOT_TOKEN == undefined){
    console.log('DISCORD_BOT_TOKEN not defined');
    process.exit(0);
}

if(process.env.TAPABOT_CMD_CHANNEL == undefined){
    console.log('TAPABOT_CMD_CHANNEL not defined');
    process.exit(0);
}

if(process.env.TAPABOT_ALT_CHANNEL == undefined){
    console.log('TAPABOT_ALT_CHANNEL not defined');
    process.exit(0);
}

client.on('ready', message =>{
    logger.info('Bot ready!')
    client.user.setPresence({ activity: { name: '語る会銘柄' } });
});

client.on('message', message =>{
    if (message.author.id == client.user.id){
        return;
    }
    if(!message.mentions.users.has(client.user.id)) {
        return;       
    }
    if(message.channel.id == process.env.TAPABOT_CMD_CHANNEL) {
        var commands =  message.content.split(" ")
        for( var i = 1, len=commands.length; i < len; i++ ) {
            if(commands[i] == "") {
                continue
            }
            handleCommand(commands[i])
        }
    }

    return
});

function handleCommand(command) {
    var ret = false
    command = command.toLowerCase()
    if( command == "help" ) {
        ret = true
        handleHelpCommand()
    } else if(command == "debug" ) {
        ret = true
        handleDebugCommand()
    } else if(command == "$$") {
        ret = true
        handleSummaryCommand(process.env.TAPABOT_CMD_CHANNEL)
    } else if(command == ">>") {
        ret = true
        handleSummaryCommand(process.env.TAPABOT_ALT_CHANNEL)
    } else if(command.substr(0,1) == "$") {
        ret = handleTickerCommand(process.env.TAPABOT_CMD_CHANNEL, command.substr(1))
    } else if(command.substr(0,1) == ">") {
        ret = handleTickerCommand(process.env.TAPABOT_ALT_CHANNEL, command.substr(1))
    } 

    if(! ret) {
        handleUnknownCommand(command)
    }
}

function handleHelpCommand() {
    var msg = ""
    msg += "語る会のtapabotです。\n"
    msg += "\n"
    msg += "このチャンネル内でtapabotに以下のコマンドを送ることで語る会銘柄を語らせることができます。\n"
    msg += "tapabotへコマンドを送る場合は必ず@tapabotと宛先にtapabotを指定してください。\n"
    msg += "\n"
    msg += "1. このチャネルに$<ticker>と語る会銘柄のtickerを送るとその銘柄について語ります。\n"
    msg += "例）アマゾンについて語る\n"
    msg += "@tapabot $amzn\n"
    msg += "\n"
    msg += "2. $の代わりに>をtickerコードにつけると本丸で語ります。\n"
    msg += "例）アマゾンについて本丸で語る\n"
    msg += "@tapabot >amzn\n"
    msg += "\n"
    msg += "3. $$と送ると全ての語る会銘柄について簡単に語ります。\n"
    msg += "例）全ての語る会銘柄について簡単に語る\n"
    msg += "@tapabot $$ \n"
    msg += "\n"
    msg += "4. >>と送ると全ての語る会銘柄について本丸で簡単に語ります。\n"
    msg += "例）全ての語る会銘柄について本丸で簡単に語る\n"
    msg += "@tapabot >>\n"
    msg += "\n"
    msg += "5. $amzn $googというように二つ以上の銘柄について語ることもできます。\n"
    msg += "例）アマゾンとグーグルについて語る\n"
    msg += "@tapabot $amzn $goog\n"
    msg += "\n"
    msg += "[注意]\n"
    msg += "現在値などはGoogle Financeから引いて来ていますがタイムラグがあります。\n"
    msg += "またシステムに不具合もあり得ますので売買する前に必ず証券会社などで確認してください。\n"
    msg += "\n"
    msg += "©︎ちゃちゃまる 2021"
    sendMsg(process.env.TAPABOT_CMD_CHANNEL, msg)
}

function handleDebugCommand() {
    var msg = ""
    msg += "Last update from Google spread sheet on " + utime.toLocaleString();
    sendMsg(process.env.TAPABOT_CMD_CHANNEL, msg)
}

function padSpacesToLeft(s, l) {
    var len = 0
    for (var i = 0; i < s.length; i++) {
        if(s[i].match(/[ -~]/) ) {
            len += 1;
        } else {
            len += 2;
        }            
    }

    if( len > l ) {
        return s.split(0, l)
    } else {
        var ret = ""
        for(var i = 0; i < l-len; i++) {
            ret += " "
        }
        return ret+s
    }
}

function handleSummaryCommand(channel) {
    var msg = ""
    msg += "```"
    msg += "\n"
    msg += padSpacesToLeft("Ticker", 12)
    msg += padSpacesToLeft("Price[$]", 12)
    msg += padSpacesToLeft("Est[$]", 12)
    msg += padSpacesToLeft("Ratio[%]", 12)
    msg += "\n"
    msg += padSpacesToLeft("------", 12)
    msg += padSpacesToLeft("--------", 12)
    msg += padSpacesToLeft("------", 12)
    msg += padSpacesToLeft("--------", 12)
    for(var key in stocks) {
        var stock = stocks[key]
        msg += "\n"
        msg += padSpacesToLeft(key.toUpperCase(), 12)
        msg += padSpacesToLeft(""+stock["price"], 12)
        msg += padSpacesToLeft(""+stock["expected"], 12)
        msg += padSpacesToLeft(""+Math.round(stock["expected_ratio"]*10000)/100, 12)
    }
    msg += "```"
    sendMsg(channel, msg)
}

function handleTickerCommand(channel, ticker) {
    var msg = ""
    if(ticker in stocks) {
        var stock = stocks[ticker]
        msg += "**"+stock["name"]+"**\n"
        msg += stock["comment"]+"\n"
        msg += "```\n"
        msg += "現在値[$]: 　"+stock["price"]+"\n"
        msg += "前日比[$]: 　"+stock["change"]+"\n"
        msg += "前日比[%]: 　"+stock["change_ratio"]+"\n"
        msg += "見込み値[$]: "+stock["expected"]+"\n"
        msg += "乖離率[%]: 　"+Math.round(stock["expected_ratio"]*10000)/100+"\n"
        msg += "```\n"
        msg += "[Yahoo!Financeチャート]https://finance.yahoo.com/quote/"+ticker.toUpperCase()+"/chart"
    } else {
        msg += "["+ticker+"]は語る会銘柄ではありません。もう一度tickerを確認してください。"
    }
    sendMsg(channel, msg)

    return true
}

function handleUnknownCommand(command) {
    var msg = command + "： tapabotへの指示としては無効です"
    sendMsg(process.env.TAPABOT_CMD_CHANNEL, msg)
}

client.login( process.env.DISCORD_BOT_TOKEN );

function sendReply(message, text){
    message.reply(text)
        .then(console.log("Reply: " + text))
        .catch(console.error);
}

function sendMsg(channelId, text, option={}){
    client.channels.get(channelId).send(text, option)
        .then(console.log("Reply: " + text + JSON.stringify(option)))
        .catch(console.error);
}
