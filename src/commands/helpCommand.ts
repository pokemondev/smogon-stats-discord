import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CommandHelpTopic, SlashCommandData, SlashCommandHandler } from './command';
import { FormatConfig } from '../config/formatConfig';
import { FormatHelper } from '../smogon/formatHelper';

export const helpHelpTopic: CommandHelpTopic = {
  command: 'help',
  description: 'Show a quick guide for the bot commands and arguments.',
  examples: [
    '/help',
    '/help command:pokemon',
  ],
};

export function createHelpCommandData(helpTopics: CommandHelpTopic[]): SlashCommandData {
  return new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show command help and usage examples')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Command to explain in more detail')
        .addChoices(...helpTopics.map(topic => ({ name: topic.command, value: topic.command })))
    );
}

export class HelpCommand implements SlashCommandHandler {
  public readonly data: SlashCommandData;
  public readonly helpTopic = helpHelpTopic;

  constructor(
    private readonly helpTopics: CommandHelpTopic[],
    private readonly botName: string,
  ) {
    this.data = createHelpCommandData(helpTopics);
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const requestedCommand = interaction.options.getString('command');
    const topic = requestedCommand
      ? this.helpTopics.find(helpTopic => helpTopic.command === requestedCommand)
      : undefined;

    const embed = topic
      ? this.buildTopicEmbed(topic)
      : this.buildOverviewEmbed();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private buildOverviewEmbed(): EmbedBuilder {
    const defaultFormat = FormatConfig.getDefaultFormat();
    const embed = new EmbedBuilder()
      .setTitle(`${this.botName} Help`)
      .setDescription(`Start with \`/pokemon\` for a specific Pokemon or \`/stats\` for format-wide rankings. Current configured default format: ${FormatHelper.toUserString(defaultFormat)}. If only generation is provided, that generation uses its default VGC format.`);

    for (const topic of this.helpTopics) {
      embed.addFields({ name: `/${topic.command}`, value: topic.description, inline: false });
    }

    embed.addFields({
      name: 'Quick Examples',
      value: [
        '/pokemon summary name:dragonite',
        '/pokemon items name:gholdengo meta:OU',
        '/stats usage',
        '/stats leads meta:OU generation:"Gen 8"',
      ].join('\n'),
      inline: false,
    });

    return embed;
  }

  private buildTopicEmbed(topic: CommandHelpTopic): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`/${topic.command}`)
      .setDescription(topic.description);

    if (topic.arguments && topic.arguments.length) {
      embed.addFields({
        name: 'Arguments',
        value: topic.arguments.join('\n'),
        inline: false,
      });
    }

    embed.addFields({
      name: 'Examples',
      value: topic.examples.join('\n'),
      inline: false,
    });

    return embed;
  }
}
