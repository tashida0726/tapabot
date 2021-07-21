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
    if(message.channel.id == process.env.TAPABOT_CMD_CHANNEL) {
        var commands =  message.content.split(" ")
        for( var i = 0, len=commands.length; i < len; i++ ) {
            handleCommand(commands[i])
        }
    }

    return
});

function handleCommand(command) {
    var ret = false
    command.toLowerCase()
    if( command == "help" ) {
        ret = true
        handleHelpCommand()
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
    msg += "語る会のtapabotたぱ\n"
    msg += "1. このチャネルに$<ticker>と語る会銘柄のtickerを送るとその銘柄について語るたぱ\n"
    msg += "例） $amzn ... アマゾンの銘柄について語る\n"
    msg += "2. $の代わりに>をtickerコードにつけると本丸で語るたぱ\n"
    msg += "例） >amzn ... アマゾンの銘柄について本丸で語る\n"
    msg += "3. $$と送ると全ての語る会銘柄について簡単に語るたぱ\n"
    msg += "4. >>と送ると全ての語る会銘柄について本丸で簡単に語るたぱ\n"
    msg += "5. $amzn $googという風に二つ以上の銘柄について語ることもできるたぱ\n"
    msg += "（注意）\n"
    msg += "現在値などはGoogle Financeから引いて来ているけど\n"
    msg += "タイムラグがあるしシステムに不具合もあるかもしれないので\n"
    msg += "売買する前に必ず証券会社などで確認して欲しいたぱ\n"
    msg += "©︎ちゃちゃまる 2021"
    sendMsg(process.env.TAPABOT_CMD_CHANNEL, msg)
}

function handleSummaryCommand(channel) {
    var msg = ""
    msg += "全ての語る会銘柄について簡単に語るたぱ\n"
    msg += "```\n"
    msg += "ティッカー/現在値[$]/見込み値[$]/乖離率[%]"
    for(var key in stocks) {
        var stock = stocks[key]
        msg += "\n"+key.toUpperCase()+"/"+stock["price"]+"/"+stock["expected"]+"/"+Math.round(stock["ratio"]*10000)/100
    }
    msg += "```"
    sendMsg(channel, msg)
}

function handleTickerCommand(channel, ticker) {
    if(ticker in stocks) {
        var stock = stocks[ticker]
        var msg = "語る会銘柄["+ticker.toUpperCase()+"]について語るたぱ\n"
        msg += "**"+stock["name"]+"**\n"
        msg += stock["comment"]+"\n"
        msg += "```\n"
        msg += "現在値[$]: 　"+stock["price"]+"\n"
        msg += "見込み値[$]: "+stock["expected"]+"\n"
        msg += "乖離率[%]: 　"+Math.round(stock["ratio"]*10000)/100+"\n"
        msg += "```\n"
        msg += "[Yahoo!Financeチャート](https://finance.yahoo.com/quote/"+ticker.toUpperCase()+"/chart)"
        sendMsg(channel, msg)
        return true
    }

    return false
}

function handleUnknownCommand(command) {
    var msg = command + "... よく分からないたぱ"
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
