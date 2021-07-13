const querystring = require('querystring');
const discord = require('discord.js');
const client = new discord.Client();

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
        console.log(message.content)
        let text = "たぱ";
        sendMsg(message.channel.id, tok[1]+"の情報たぱ");
        sendMsg(message.channel.id, "Ticker: "+tok[1]);
        sendMsg(message.channel.id, "Price: xx.xx $");
        sendMsg(message.channel.id, "Estimation: xx.xx $");
        sendMsg(message.channel.id, "Price/Estimation Ratio: xx %");
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