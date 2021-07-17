const winston = require('winston')
const express = require('express');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const discord = require('discord.js');
const client = new discord.Client();

var utime = Date();

const format = winston.format
const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.cli(),
        format.printf(info => `${info.timestamp} ${info.level} ${info.message}`)
    ),
    transports: [
        new winston.transports.File({filename: '/var/log/tapabot.log', level: 'info'})
    ]
});

const app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.post("/stocks", (req, res) => {
    logger.info('New stocks info arrived.')
    stocks = req.body;

    res.send("OK")
});
app.listen(8080)

client.on('ready', message =>{
    console.log('Bot Ready!!');
    client.user.setPresence({ activity: { name: '語る会銘柄' } });
});

client.on('message', message =>{
    if (message.author.id == client.user.id){
        return;
    }
    if (message.mentions.members.has(client.user.id)) {
        console.log("Yes")
    } else {
        console.log("No")
    }
    console.log(message.member)
    let tok = message.content.split("$")
    console.log(client.user.id)
    console.log(tok[0])
    if(tok.length == 2) {
        let ticker = tok[1].toUpperCase()
        let msg = "語る会銘柄["+ticker+"]について語るたぱ\n"
        msg += "ティッカー:\t"+ticker+"\n"
        msg += "現在値($):\t3401.46\n"
        msg += "見込み値($):\t5312.50\n"
        msg += "乖離率(%):\t64.0\n"
        msg += "AWS プライム 通販 起業家オーナー◎ 売り上げ9倍 営利 5%\n"
        msg += "[Chart]https://finance.yahoo.com/quote/"+ticker+"/chart"
        sendMsg(message.channel.id, msg);
        return;
    }
    sendMsg(message.channel.id, "よく分からないたぱ")
    return
});

if(process.env.DISCORD_BOT_TOKEN == undefined){
    console.log('DISCORD_BOT_TOKEN not defined');
    process.exit(0);
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
