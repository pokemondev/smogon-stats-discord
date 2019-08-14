const smogonStats = require('./smogon-stats.js');
const smogon = new smogonStats();

const Discord = require('discord.js');
const client = new Discord.Client();
const token = 'NjEwOTQ1ODUwNTU3OTg4ODk0.XVMp4g.j01Mvi5btK8gdkOmKHkXUKIpa0Y';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('Pong!');
  }

  if (msg.content === '!leads') {
    let leads = smogon.leads();
    console.log(leads);

    const embed = new Discord.RichEmbed()
        .setTitle('Leads')
        .setDescription('This is a Gen 7 OU top 10 leads')
        //.setAuthor('tmenezes', 'https://cdn.bulbagarden.net/upload/7/7e/006Charizard.png')
        .setColor('#f50057')
        .setThumbnail('https://cdn.bulbagarden.net/upload/7/7e/006Charizard.png')
        .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${leads[0].name.toLowerCase()}.png`)
        //.setImage(`https://play.pokemonshowdown.com/sprites/xyani/${leads[0].name.toLowerCase()}.gif`)
        //.setFooter('Footer')
    
    leads.forEach((mon, i) => {
        //embed.addField('Pokémon', mon, true)
        embed.addField( `Lead ${i+1}º ${mon.name}`, `Usage: ${mon.usage.toFixed(2)}%`, true)
    });

    msg.channel.send(embed);

    //msg.reply(leads);
    //msg.channel.send(leads);
  }

  console.log(msg.author.username);
});

client.login(token);