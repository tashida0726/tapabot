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

if(process.env.REST_PORT == undefined){
    console.log('REST_PORT not defined');
    process.exit(0);
}

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
app.post("/report", (req, res) => {
    logger.info('Report request arrived.')
    var r = req.body
    var tradeTime = stocks["sp500"]["tradeTime"]
    var now = Date.now()
    if( r["force"] || (now-tradeTime)/1000/60/60 < 24 ) {
        handleReportRequest();
    } else {
        logger.info('Report request ignored.')
    }
    res.send("OK");
});

app.listen(process.env.REST_PORT)

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

function padSpacesToRight(s, l) {
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
        var ret = s
        for(var i = 0; i < l-len; i++) {
            ret += " "
        }
        return ret
    }
}

function getTop3Stocks(key, top) {
    var list = []

    for(var ticker in stocks) {
        var item = {}
        if( ticker == "sp500" ) {
            continue;
        }
        item["ticker"]= ticker.toUpperCase();
        item["value"] = stocks[ticker][key];
        list.push(item);
    }

    if( top ) {
        list = list.sort( (a,b) => {
            if( a["value"] < b["value"] ) {
                return 1
            } else {
                return -1
            }    
        }).slice(0,3);    
    } else {
        list = list.sort( (a,b) => {
            if( a["value"] > b["value"] ) {
                return 1
            } else {
                return -1
            }    
        }).slice(0,3);    
    }
    return list;
}

function getTop3Summary(list) {
    var summary = ""
    summary += padSpacesToRight("Ticker", 8)
    summary += padSpacesToRight("Ratio[%]", 12)
    summary += "\n"
    for(var i = 0; i < list.length; i++) {
        summary += padSpacesToRight(list[i]["ticker"], 8)
        summary += padSpacesToRight(""+list[i]["value"], 12)
        summary += "\n"
    }
    return summary;
}

function handleReportRequest() {
    var top3Change = getTop3Stocks("change_ratio", true);
    var worst3Change = getTop3Stocks("change_ratio", false);
    var top3Expected = getTop3Stocks("expected_ratio", true);
    var worst3Expected = getTop3Stocks("expected_ratio", false);

    for( var i = 0; i< 3; i++) {
        top3Expected[i]["value"] = Math.round(top3Expected[i]["value"]*10000/100);
        worst3Expected[i]["value"] = Math.round(worst3Expected[i]["value"]*10000/100);
    }

    var msg = "昨日の語る会銘柄の前日比（Change Ratio）と見込み値からの乖離率（Expected Ratio）です"
    msg +=  "```\n"
    msg += "Change Ratio Top 3\n"
    msg += getTop3Summary(top3Change);
    msg += "\n"
    msg += "Change Ratio Worst 3\n"
    msg += getTop3Summary(worst3Change);
    msg += "\n"
    msg += "Expected Ratio Top 3\n"
    msg += getTop3Summary(top3Expected);
    msg += "\n"
    msg += "Expected Ratio Worst 3\n"
    msg += getTop3Summary(worst3Expected);
    msg += "```"

    sendMsg(process.env.TAPABOT_ALT_CHANNEL, msg)
}

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
        if( key == "sp500" ) {
            continue;
        }
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
    if(ticker in stocks && ticker !== "sp500") {
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
