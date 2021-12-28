const winston = require('winston')

const express = require('express');
const querystring = require('querystring');
const discord = require('discord.js');
const e = require('express');
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

let info = {}
let stocks = {}
let indicies = {}
let currencies = {}
let etfs = []
let extra = {}


const app = express();
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());
app.post("/stocks", (req, res) => {
    logger.info('New stocks info arrived.')
    info = req.body;
    stocks = info["stocks"]
    indicies = info["indicies"]
    currencies = info["currencies"]
    etfs = info["etfs"]
    utime = Date();

    res.send("OK")
});
app.post("/stocks/extra", (req, res) => {
    logger.info('New stocks(extra) info arrived.')
    extra = req.body["extra"]
    utime = Date();

    res.send("OK")
});
app.post("/report", (req, res) => {
    logger.info('Report request arrived.')
    var r = req.body
    var tradeTime = info["utime"]
    var now = Date.now()
    if( r["force"] || (now-tradeTime)/1000/60/60 < 24 ) {
        handleReportRequest();
        logger.info('Report request handled [now='+now+' utime='+tradeTime+']')
    } else {
        logger.info('Report request ignored [now='+now+' utime='+tradeTime+']')
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
    s+=""
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
    s+=""
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

function sortItems(d, key, asce) {
    var list = []

    for(var ticker in d) {
        var item = {}
        item["ticker"]= ticker.toUpperCase();
        if( key == "ticker" ) {
            item["value"] = ticker;
        } else {
            item["value"] = d[ticker][key];
        }
        list.push(item);
    }

    if( asce ) {
        list = list.sort( (a,b) => {
            if( a["value"] < b["value"] ) {
                return 1
            } else {
                return -1
            }    
        });    
    } else {
        list = list.sort( (a,b) => {
            if( a["value"] > b["value"] ) {
                return 1
            } else {
                return -1
            }    
        });    
    }

    return list;
}

function getIndexSummary() {
    var summary = "";
    var list = sortItems(indicies, "order", false);
    for(var i = 0; i < list.length; i++) {
        var ticker = list[i]["ticker"]
        summary += padSpacesToRight(indicies[ticker.toLowerCase()]["name"], 12)
        summary += padSpacesToRight(indicies[ticker.toLowerCase()]["price"], 10)
        summary += padSpacesToRight(indicies[ticker.toLowerCase()]["change_ratio"].toFixed(2)+"%", 6)
        summary += "\n"
    }

    return summary
}

function getCurrencySummary() {
    var summary = "";
    var list = sortItems(currencies, "order", false);
    for(var i = 0; i < list.length; i++) {
        var ticker = list[i]["ticker"]
        summary += padSpacesToRight(currencies[ticker.toLowerCase()]["name"], 12)
        summary += padSpacesToRight(currencies[ticker.toLowerCase()]["price"], 8)
        summary += "\n"
    }

    return summary
}

function getETFSummary() {
    var summary = "";
    var list = sortItems(etfs, "order", false);
    for(var i = 0; i < list.length; i++) {
        var ticker = list[i]["ticker"]
        summary += padSpacesToRight(ticker, 6)
        summary += padSpacesToRight(etfs[ticker.toLowerCase()]["change_ratio"].toFixed(2)+"%", 8)
        summary += "\n"
    }

    return summary
}

function getTop3Stocks(key, top) {
    var list = sortItems(stocks, key, top);
    return list.slice(0, 3);
}

function getTop3Summary(list) {
    var summary = ""
    summary += padSpacesToRight("Ticker", 8)
    summary += padSpacesToRight("Ratio", 12)
    summary += "\n"
    for(var i = 0; i < list.length; i++) {
        summary += padSpacesToRight(list[i]["ticker"].toUpperCase(), 8)
        summary += padSpacesToRight(""+list[i]["value"].toFixed(2)+"%", 12)
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
        top3Expected[i]["value"] = Math.round(top3Expected[i]["value"]*10000)/100;
        worst3Expected[i]["value"] = Math.round(worst3Expected[i]["value"]*10000)/100;
    }

    var msg = "主要指数\n"
    msg +=  "```\n"
    msg +=  getIndexSummary();
    msg +=  "```\n"

    msg += "通貨など\n"
    msg +=  "```\n"
    msg +=  getCurrencySummary();
    msg +=  "```\n"

    msg +=  "注目ETF\n"
    msg +=  "```\n"
    msg +=  getETFSummary();
    msg +=  "```\n"
    msg +=  "\n"

    sendMsg(process.env.TAPABOT_ALT_CHANNEL, msg)

    msg = "昨日の語る会銘柄の前日比（Change Ratio）と見込み値からの乖離率（Estimated Ratio）です\n"
    msg +=  "```\n"
    msg += "Change Ratio Top 3\n"
    msg += getTop3Summary(top3Change);
    msg += "\n"
    msg += "Change Ratio Worst 3\n"
    msg += getTop3Summary(worst3Change);
    msg += "\n"
    msg += "Estimated Ratio Top 3\n"
    msg += getTop3Summary(top3Expected);
    msg += "\n"
    msg += "Estimated Ratio Worst 3\n"
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
    } else if(command.substr(0,2) == "$$") {
        ret = handleSummaryCommand(command, process.env.TAPABOT_CMD_CHANNEL)
    } else if(command.substr(0,2) == ">>") {
        ret = handleSummaryCommand(command, process.env.TAPABOT_ALT_CHANNEL)
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
    msg += "5. $$や>>の後ろにカラム名と昇順・逆順を指定するとソートして表示します。\n"
    msg += "カラム名： ticker/price/est/ratio\n"
    msg += "昇順・逆順： asce/desce\n"
    msg += "例）ratioを昇順で表示する\n"
    msg += "@tapabot $$:ratio:asce\n"
    msg += "\n"
    msg += "6. $amzn $googというように二つ以上の銘柄について語ることもできます。\n"
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

function getKeyFromCommandArg(arg) {
    d = {
        "ticker" : "ticker",
        "price" : "price",
        "est" : "expected",
        "ratio" : "expected_ratio",
    };

    if( arg in d ) {
        return d[arg];
    } else {
        return "";
    }
}

function showSummary(c, h, s, key, asce) {
    var list = [];

    if( key !== "" ) {
        list = sortItems(s, key, asce);
    } else {
        for(var ticker in s) {
            var item = {};
            item.ticker = ticker;
            list.push(item); 
        }
    }

    var msg = ""
    msg += h
    msg += "\n"
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
    for(var i=0; i<list.length; i++) {
	var item = list[i];
        var ticker = item["ticker"];
        var stock = stocks[ticker]
        msg += "\n"
        msg += padSpacesToLeft(ticker.toUpperCase(), 12)
        msg += padSpacesToLeft(""+s["price"], 12)
        msg += padSpacesToLeft(""+s["expected"], 12)
        msg += padSpacesToLeft(""+Math.round(s["expected_ratio"]*10000)/100, 12)
    }
    msg += "```"
    sendMsg(c, msg)

}

function handleSummaryCommand(command, channel) {
    var tokens = command.split(":");
    var asce = true;
    var key = ""
    if( tokens.length == 1 ) {
        // Nothing to do
    } else if( tokens.length == 2 ) {
        key = getKeyFromCommandArg(tokens[1].toLowerCase());
        if(key == "") {
            return false;
        }
    } else if( tokens.length == 3 ) {
        key = getKeyFromCommandArg(tokens[1].toLowerCase());
        if(key == "") {
            return false;
        }
        if( tokens[2].toLowerCase() == "asce" ) {
            asce = true;
        } else if( tokens[2].toLowerCase() == "desce" ) {
            asce = false
        } else {
            return false;
        }
    }

    showSummary(channel, "語る会銘柄一覧", stocks, key, asce);
    showSummary(channel, "注目銘柄一覧", extra, key, asce);

    return true;
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
