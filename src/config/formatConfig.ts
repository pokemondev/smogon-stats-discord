import { SmogonFormat } from '../smogon/usageModels';
import { FormatCatalog } from '../smogon/formatCatalog';

export class FormatConfig {
  public static readonly EnvironmentVariables = {
    generation: 'DEFAULT_GENERATION',
    meta: 'DEFAULT_META',
  } as const;

  public static getDefaultFormat(): SmogonFormat {
    const rawGeneration = process.env[FormatConfig.EnvironmentVariables.generation];
    const rawMeta = process.env[FormatConfig.EnvironmentVariables.meta];

    if (!rawGeneration) {
      throw new Error(`${FormatConfig.EnvironmentVariables.generation} environment variable is required.`);
    }

    if (!rawMeta) {
      throw new Error(`${FormatConfig.EnvironmentVariables.meta} environment variable is required.`);
    }

    const generation = FormatCatalog.normalizeGeneration(rawGeneration);
    if (!generation || !FormatCatalog.isValidGeneration(generation)) {
      throw new Error(`${FormatConfig.EnvironmentVariables.generation} value '${rawGeneration}' is not a supported generation.`);
    }

    const meta = FormatCatalog.normalizeMeta(rawMeta);
    if (!meta || !FormatCatalog.isConcreteMetaValue(meta)) {
      const suggestion = meta === 'vgc'
        ? " Use a concrete season like 'vgc2026regf'."
        : '';
      throw new Error(`${FormatConfig.EnvironmentVariables.meta} value '${rawMeta}' is not a supported concrete metagame.${suggestion}`);
    }

    const format = { generation, meta };
    if (!FormatCatalog.isSupportedFormat(format)) {
      throw new Error(`${FormatConfig.EnvironmentVariables.generation} '${rawGeneration}' and ${FormatConfig.EnvironmentVariables.meta} '${rawMeta}' do not form a supported format.`);
    }

    return format;
  }
}