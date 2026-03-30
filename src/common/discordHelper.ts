import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

export class DiscordHelper {
  public static async handleCommandFailure(interaction: ChatInputCommandInteraction, error: unknown): Promise<void> {
    const interactionAgeInMilliseconds = Date.now() - interaction.createdTimestamp;
    const interactionState = `age=${interactionAgeInMilliseconds}ms deferred=${interaction.deferred} replied=${interaction.replied}`;
    console.error(`Failed to process command '${interaction.commandName}' from ${interaction.user.tag}. ${interactionState}`, error);

    if (DiscordHelper.getDiscordApiErrorCode(error) === 10062) {
      console.error(`Skipping failure response for expired interaction '${interaction.commandName}'. ${interactionState}`);
      return;
    }

    try {
      const commandFailureMessage = 'There was an error trying to execute that command.';
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: commandFailureMessage, embeds: [] });
        return;
      }

      if (interaction.replied) {
        await interaction.followUp({ content: commandFailureMessage, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: commandFailureMessage, flags: MessageFlags.Ephemeral });
    }
    catch (replyError) {
      console.error(`Failed to send the command failure response. ${interactionState}`, replyError);
    }
  }

  public static getDiscordApiErrorCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return undefined;
    }

    const { code } = error as { code?: unknown };
    return typeof code === 'number'
      ? code
      : undefined;
  }

  public static async deferCommandReply(interaction: ChatInputCommandInteraction): Promise<void> {
    const interactionAgeInMilliseconds = Date.now() - interaction.createdTimestamp;
    if (interactionAgeInMilliseconds >= 2500) {
      console.warn(
        `Late interaction defer for ${DiscordHelper.getInteractionName(interaction)} after ${interactionAgeInMilliseconds}ms.`
      );
    }

    await interaction.deferReply();
  }

  public static getInteractionName(interaction: ChatInputCommandInteraction): string {
    const subcommand = interaction.options.getSubcommand(false);
    return subcommand
      ? `${interaction.commandName}/${subcommand}`
      : interaction.commandName;
  }
}