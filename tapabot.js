const express = require('express');
const querystring = require('querystring');
const discord = require('discord.js');
const client = new discord.Client();

const app = express();

app.post("/data", (req, res) => {
    const data = JSON.parse(req.body);
    console.log(data);
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
    if(message.isMemberMentioned(client.user)){
        sendReply(message, "tapabotたぱ");
        return;
    }
    let tok = message.content.split("$")
    if(tok.length == 2) {
        let ticker = tok[1].toUpperCase()
        sendMsg(message.channel.id, "語る会銘柄["+ticker+"]たぱ");
        sendMsg(message.channel.id, "ティッカー: "+ticker);
        sendMsg(message.channel.id, "現在値($): 3401.46");
        sendMsg(message.channel.id, "見込み値($): 5312.50");
        sendMsg(message.channel.id, "乖離率(%): 64.0");
        sendMsg(message.channel.id, "AWS プライム 通販 起業家オーナー◎ 売り上げ9倍 営利 5%");
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