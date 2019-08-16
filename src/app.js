var smogonStats = require('./smogonStats.ts');
var smogon = new smogonStats();
var Discord = require('discord.js');
var client = new Discord.Client();
var token = 'NjEwOTQ1ODUwNTU3OTg4ODk0.XVMp4g.j01Mvi5btK8gdkOmKHkXUKIpa0Y';
client.on('ready', function () {
    console.log("Logged in as " + client.user.tag + "!");
});
client.on('message', function (msg) {
    if (msg.content === 'ping') {
        msg.reply('Pong!');
    }
    if (msg.content === '!leads') {
        var leads = smogon.leads();
        console.log(leads);
        var embed_1 = new Discord.RichEmbed()
            .setTitle('Leads')
            .setDescription('This is a Gen 7 OU top 10 leads')
            //.setAuthor('tmenezes', 'https://cdn.bulbagarden.net/upload/7/7e/006Charizard.png')
            .setColor('#f50057')
            .setThumbnail("https://play.pokemonshowdown.com/sprites/bw/" + leads[0].name.toLowerCase() + ".png");
        //.setImage(`https://play.pokemonshowdown.com/sprites/xyani/${leads[0].name.toLowerCase()}.gif`)
        //.setFooter('Footer')
        leads.forEach(function (mon, i) {
            //embed.addField('Pokémon', mon, true)
            embed_1.addField("Lead " + (i + 1) + "\u00BA " + mon.name, "Usage: " + mon.usage.toFixed(2) + "%", true);
        });
        msg.channel.send(embed_1);
        //msg.reply(leads);
        //msg.channel.send(leads);
    }
    console.log(msg.author.username);
});
client.login(token);
