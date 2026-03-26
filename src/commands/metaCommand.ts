import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AppDataSource } from '../appDataSource';
import { CommandBase, CommandHelpTopic, SlashCommandData, SlashCommandHandler, withFormatOptions } from './command';
import { FormatHelper } from '../smogon/formatHelper';

export const metaHelpTopic: CommandHelpTopic = {
  command: 'meta',
  description: 'Format-wide rankings such as usage, leads, and Mega Stone users.',
  arguments: [
    'generation: Optional generation filter. Defaults to Gen 9.',
    'meta: Optional metagame filter. Defaults to OU.',
  ],
  examples: [
    '/meta usage',
    '/meta leads meta:UU',
    '/meta megas generation:"Gen 6" meta:OU',
  ],
};

export function createMetaCommandData(): SlashCommandData {
  return new SlashCommandBuilder()
    .setName('meta')
    .setDescription('Format-wide rankings and trends')
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('usage')
        .setDescription('Show the most used Pokemon in a metagame')
    ))
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('leads')
        .setDescription('Show the most common leads in a metagame')
    ))
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('megas')
        .setDescription('Show the most common Mega Stone users in a metagame')
    ));
}

export class MetaCommand extends CommandBase implements SlashCommandHandler {
  public readonly data = createMetaCommandData();
  public readonly helpTopic = metaHelpTopic;

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'usage':
        await this.handleUsage(interaction);
        return;
      case 'leads':
        await this.handleLeads(interaction);
        return;
      case 'megas':
        await this.handleMegas(interaction);
        return;
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleUsage(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    await interaction.deferReply();

    const usageData = await this.dataSource.smogonStats.getUsages(format);
    if (!usageData.length) {
      await this.replyNoData(interaction, `No usage data available for ${FormatHelper.toString(format)}.`);
      return;
    }

    const firstMon = this.dataSource.pokemonDb.getPokemon(usageData[0].name);
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    usageData.forEach((pokemon, index) => {
      embed.addFields({
        name: `Rank ${index + 1}º ${pokemon.name}`,
        value: `Usage: ${pokemon.usageRaw.toFixed(2)}%`,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Usage:__** Top ${usageData.length} most used Pokemon of ${FormatHelper.toString(format)}`,
      embeds: [embed],
    });
  }

  private async handleLeads(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    await interaction.deferReply();

    const leads = await this.dataSource.smogonStats.getLeads(format);
    if (!leads.length) {
      await this.replyNoData(interaction, `No leads data available for ${FormatHelper.toString(format)}.`);
      return;
    }

    const firstMon = this.dataSource.pokemonDb.getPokemon(leads[0].name);
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    leads.forEach((pokemon, index) => {
      embed.addFields({
        name: `Lead ${index + 1}º ${pokemon.name}`,
        value: `Usage: ${pokemon.usageRaw.toFixed(2)}%`,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Leads:__** Top ${leads.length} leads of ${FormatHelper.toString(format)}`,
      embeds: [embed],
    });
  }

  private async handleMegas(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    await interaction.deferReply();

    const moveSets = await this.dataSource.smogonStats.getMegasMoveSets(format);
    if (!moveSets.length) {
      await this.replyNoData(interaction, `No Mega usage data available for ${FormatHelper.toString(format)}.`);
      return;
    }

    const firstMon = this.dataSource.pokemonDb.getPokemon(moveSets[0].name);
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    moveSets.forEach(moveSet => {
      embed.addFields({
        name: moveSet.name,
        value: `Usage: ${moveSet.usage.toFixed(2)}%`,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Megas:__** Top ${moveSets.length} Mega Stone users of ${FormatHelper.toString(format)}`,
      embeds: [embed],
    });
  }
}