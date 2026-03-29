import { SmogonFormat } from './usageModels';

interface VgcSeason {
  gen: string;
  year: string;
  meta: string;
  aliases: string[];
  regulation?: string;
  isDefault?: boolean;
}

export class FormatCatalog {
  public static readonly Generations = [ 'gen9', 'gen8', 'gen7', 'gen6' ] as const;
  public static readonly StandardMetaValues = [ 'ubers', 'ou', 'uu', 'ru', 'nu' ] as const;
  private static readonly SmogonAnalysisUrls: Readonly<Record<string, string>> = {
    ou: 'https://www.smogon.com/dex/sv/formats/ou',
    uu: 'https://www.smogon.com/dex/sv/formats/uu',
    ru: 'https://www.smogon.com/dex/sv/formats/ru',
    nu: 'https://www.smogon.com/dex/sv/formats/nu',
    ubers: 'https://www.smogon.com/dex/sv/formats/ubers',
    vgc2026regf: 'https://www.smogon.com/dex/sv/formats/vgc24-regulation-f/',
    vgc2026regi: 'https://www.smogon.com/dex/sv/formats/vgc25-regulation-i/',
  };
  public static readonly VgcSeasons: readonly VgcSeason[] = [
    { gen: 'gen9', year: '2026', regulation: 'regf', meta: 'vgc2026regf', aliases: [ 'vgc2026', 'vgc2026regf' ], isDefault: true },
    { gen: 'gen9', year: '2026', regulation: 'regi', meta: 'vgc2026regi', aliases: [ 'vgc2026regi' ] },
    { gen: 'gen8', year: '2022', meta: 'vgc2022', aliases: [ 'vgc2022' ], isDefault: true },
    { gen: 'gen7', year: '2019', meta: 'vgc2019', aliases: [ 'vgc2019' ], isDefault: true },
  ];
  public static readonly MetaValues = [ ...FormatCatalog.StandardMetaValues, ...FormatCatalog.VgcSeasons.map(season => season.meta) ];
  public static readonly MetaAliases = [ ...FormatCatalog.StandardMetaValues, 'uber', 'vgc', ...FormatCatalog.VgcSeasons.map(season => season.meta) ];

  public static normalizeGeneration(gen?: string): string {
    if (!gen) {
      return '';
    }

    const normalizedGen = gen.toLowerCase();
    if (/^\d{1,2}$/.test(normalizedGen)) {
      return `gen${normalizedGen}`;
    }

    return normalizedGen.startsWith('gen')
      ? normalizedGen
      : `gen${normalizedGen}`;
  }

  public static normalizeValue(value?: string): string {
    if (!value) {
      return '';
    }

    const normalizedValue = value.toLowerCase();
    return /^\d{1,2}$/.test(normalizedValue)
      ? FormatCatalog.normalizeGeneration(normalizedValue)
      : normalizedValue;
  }

  public static normalizeMeta(meta?: string): string {
    if (!meta) {
      return '';
    }

    const normalizedMeta = meta.toLowerCase();
    return normalizedMeta === 'uber'
      ? 'ubers'
      : normalizedMeta;
  }

  public static tryResolveSupportedSetMeta(generation: string, setName: string): string | undefined {
    const normalizedGeneration = FormatCatalog.normalizeGeneration(generation);
    const standardMeta = FormatCatalog.tryResolveSupportedStandardSetMeta(setName);
    if (standardMeta) {
      return standardMeta;
    }

    return FormatCatalog.tryResolveSupportedVgcSetMeta(normalizedGeneration, setName);
  }

  public static getSmogonAnalysisUrl(format: SmogonFormat): string {
    const normalizedMeta = FormatCatalog.normalizeMeta(format.meta);
    return FormatCatalog.SmogonAnalysisUrls[normalizedMeta] || 'https://www.smogon.com/';
  }

  public static isValidGeneration(gen: string): boolean {
    const normalizedGen = FormatCatalog.normalizeGeneration(gen);
    return FormatCatalog.Generations.some(value => value === normalizedGen);
  }

  public static isKnownVgcAlias(meta: string): boolean {
    const normalizedMeta = FormatCatalog.normalizeMeta(meta);
    return FormatCatalog.VgcSeasons.some(season => season.meta === normalizedMeta || season.aliases.some(alias => alias === normalizedMeta));
  }

  public static isVgcMeta(meta?: string): boolean {
    return !!meta && meta.toLowerCase().startsWith('vgc');
  }

  public static isValidMeta(meta: string): boolean {
    const normalizedMeta = FormatCatalog.normalizeMeta(meta);
    return FormatCatalog.MetaAliases.some(value => value === normalizedMeta) || FormatCatalog.isKnownVgcAlias(normalizedMeta);
  }

  public static isConcreteMetaValue(meta: string): boolean {
    const normalizedMeta = FormatCatalog.normalizeMeta(meta);
    return FormatCatalog.MetaValues.some(value => value === normalizedMeta);
  }

  public static getMetaDisplayName(meta: string): string {
    const normalizedMeta = FormatCatalog.normalizeMeta(meta);
    const vgcSeason = FormatCatalog.VgcSeasons.find(season => season.meta === normalizedMeta);
    if (vgcSeason) {
      const regulation = vgcSeason.regulation
        ? ` Reg. ${vgcSeason.regulation.replace(/^reg/i, '').toUpperCase()}`
        : '';
      return `VGC ${vgcSeason.year}${regulation}`;
    }

    return normalizedMeta.toUpperCase();
  }

  public static getVgcYearFromMeta(meta?: string): string {
    const normalizedMeta = meta ? meta.toLowerCase() : '';
    if (!normalizedMeta || normalizedMeta === 'vgc') {
      return '';
    }

    const match = /^vgc(\d{4})/.exec(normalizedMeta);
    return match ? match[1] : '';
  }

  public static getVgcRegulationFromMeta(meta?: string): string {
    const normalizedMeta = meta ? meta.toLowerCase() : '';
    if (!normalizedMeta || normalizedMeta === 'vgc') {
      return '';
    }

    const match = /^vgc\d{4}(reg[a-z0-9]+)$/.exec(normalizedMeta);
    return match ? match[1] : '';
  }

  public static getDefaultVgcSeason(predicate: (season: VgcSeason) => boolean = () => true): VgcSeason {
    return FormatCatalog.VgcSeasons.find(season => season.isDefault && predicate(season))
      || FormatCatalog.VgcSeasons.find(predicate)
      || FormatCatalog.VgcSeasons[0];
  }

  public static getGenerationDefaultVgcFormat(generation: string): SmogonFormat {
    const season = FormatCatalog.getDefaultVgcSeason(candidate => candidate.gen === FormatCatalog.normalizeGeneration(generation));
    return { generation: season.gen, meta: season.meta };
  }

  public static resolveVgcSeason(meta?: string, gen?: string, year?: string, regulation?: string): VgcSeason {
    const normalizedMeta = meta ? meta.toLowerCase() : '';
    const normalizedGen = gen ? FormatCatalog.normalizeGeneration(gen) : '';
    const normalizedYear = year ? year.toLowerCase() : FormatCatalog.getVgcYearFromMeta(normalizedMeta);
    const normalizedRegulation = regulation ? regulation.toLowerCase() : FormatCatalog.getVgcRegulationFromMeta(normalizedMeta);

    const seasonByMeta = normalizedMeta
      ? FormatCatalog.VgcSeasons.find(season => season.meta === normalizedMeta || season.aliases.some(alias => alias === normalizedMeta))
      : undefined;
    if (seasonByMeta) {
      return seasonByMeta;
    }

    const seasonByYearAndRegulation = normalizedYear && normalizedRegulation
      ? FormatCatalog.VgcSeasons.find(season => season.year === normalizedYear && season.regulation === normalizedRegulation)
      : undefined;
    if (seasonByYearAndRegulation) {
      return seasonByYearAndRegulation;
    }

    const seasonByRegulation = normalizedRegulation
      ? FormatCatalog.getDefaultVgcSeason(season => season.regulation === normalizedRegulation)
      : undefined;
    if (seasonByRegulation) {
      return seasonByRegulation;
    }

    const seasonByGenAndRegulation = normalizedGen && normalizedRegulation
      ? FormatCatalog.VgcSeasons.find(season => season.gen === normalizedGen && season.regulation === normalizedRegulation)
      : undefined;
    if (seasonByGenAndRegulation) {
      return seasonByGenAndRegulation;
    }

    const seasonByYear = normalizedYear
      ? FormatCatalog.getDefaultVgcSeason(season => season.year === normalizedYear)
      : undefined;
    if (seasonByYear) {
      return seasonByYear;
    }

    const seasonByGen = normalizedGen
      ? FormatCatalog.getDefaultVgcSeason(season => season.gen === normalizedGen)
      : undefined;
    return seasonByGen || FormatCatalog.getDefaultVgcSeason();
  }

  public static isSupportedFormat(format: SmogonFormat): boolean {
    const generation = FormatCatalog.normalizeGeneration(format.generation);
    const meta = FormatCatalog.normalizeMeta(format.meta);

    if (!generation || !meta || !FormatCatalog.isValidGeneration(generation)) {
      return false;
    }

    if (FormatCatalog.StandardMetaValues.some(value => value === meta)) {
      return true;
    }

    return FormatCatalog.VgcSeasons.some(season => season.gen === generation && season.meta === meta);
  }

  private static tryResolveSupportedStandardSetMeta(setName: string): string | undefined {
    const normalizedSetName = setName.trim().toLowerCase();
    return FormatCatalog.StandardMetaValues.find(meta => new RegExp(`^${meta}\\b`, 'i').test(normalizedSetName));
  }

  private static tryResolveSupportedVgcSetMeta(generation: string, setName: string): string | undefined {
    const match = /^vgc\s+(\d{4})(?:\s+reg(?:ulation)?\s*([a-z0-9]+))?\b/i.exec(setName.trim());
    if (!match) {
      return undefined;
    }

    const year = match[1].toLowerCase();
    const regulation = match[2] ? `reg${match[2].toLowerCase()}` : '';
    const generationSeasons = FormatCatalog.VgcSeasons.filter(season => season.gen === generation);

    if (regulation) {
      return generationSeasons.find(season => season.regulation === regulation)?.meta;
    }

    return generationSeasons.find(season => season.year === year)?.meta;
  }
}