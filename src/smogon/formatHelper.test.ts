import assert = require('assert');
import { FormatHelper } from './formatHelper';
import { SmogonFormat } from './usageModels';

process.env.DEFAULT_GENERATION = 'gen9';
process.env.DEFAULT_META = 'vgc2026regf';

interface TestCase {
  name: string;
  run: () => void;
}

interface FormatCase {
  args: string[];
  expected: SmogonFormat;
}

const formatCases: FormatCase[] = [
  {
    args: [],
    expected: { generation: 'gen9', meta: 'vgc2026regf' }
  },
  {
    args: [ 'pikachu' ],
    expected: { generation: 'gen9', meta: 'vgc2026regf' }
  },
  {
    args: [ 'gen8' ],
    expected: { generation: 'gen8', meta: 'vgc2022' }
  },
  {
    args: [ 'gen8', 'uu' ],
    expected: { generation: 'gen8', meta: 'uu' }
  },
  {
    args: [ 'uu', 'gen6' ],
    expected: { generation: 'gen6', meta: 'uu' }
  },
  {
    args: [ 'charizard', 'gen7', 'uber' ],
    expected: { generation: 'gen7', meta: 'ubers' }
  },
  {
    args: [ 'vgc' ],
    expected: { generation: 'gen9', meta: 'vgc2026regf' }
  },
  {
    args: [ 'gen8', 'vgc' ], // ensures vgc meta always return correct generation (from VgcSeasons def.)
    expected: { generation: 'gen9', meta: 'vgc2026regf' }
  },
  {
    args: [ 'vgc', '2022' ],
    expected: { generation: 'gen8', meta: 'vgc2022' }
  },
  {
    args: [ 'charizard', 'vgc2026' ],
    expected: { generation: 'gen9', meta: 'vgc2026regf' }
  },
  {
    args: [ 'vgc', '2026' ],
    expected: { generation: 'gen9', meta: 'vgc2026regf' }
  },
  {
    args: [ 'charizard', 'vgc2026regi' ],
    expected: { generation: 'gen9', meta: 'vgc2026regi' }
  },
  {
    args: [ 'gen6', 'vgc2026regi' ], // ensures vgc meta always return correct generation (from VgcSeasons def.)
    expected: { generation: 'gen9', meta: 'vgc2026regi' }
  },
  {
    args: [ 'vgc', '2026', 'regi' ],
    expected: { generation: 'gen9', meta: 'vgc2026regi' }
  },
  {
    args: [ 'gen9', 'vgc', 'regi' ],
    expected: { generation: 'gen9', meta: 'vgc2026regi' }
  }
];

const tests: TestCase[] = [
  {
    name: 'parses command format arguments across supported scenarios',
    run: () => {
      formatCases.forEach(testCase => {
        const actual = FormatHelper.getFormat(testCase.args);
        assert.deepStrictEqual(actual, testCase.expected, `Failed for args: ${testCase.args.join(' ') || '<empty>'}`);
      });
    }
  },
  {
    name: 'uses configured defaults for empty and meta-only inputs',
    run: () => {
      process.env.DEFAULT_GENERATION = 'gen8';
      process.env.DEFAULT_META = 'ou';

      assert.deepStrictEqual(FormatHelper.getFormat([]), { generation: 'gen8', meta: 'ou' });
      assert.deepStrictEqual(FormatHelper.getFormat([ 'uu' ]), { generation: 'gen8', meta: 'uu' });
      assert.deepStrictEqual(FormatHelper.getFormat([ 'gen9' ]), { generation: 'gen9', meta: 'vgc2026regf' });

      process.env.DEFAULT_GENERATION = 'gen9';
      process.env.DEFAULT_META = 'vgc2026regf';
    }
  },
  {
    name: 'formats user-facing labels with friendly meta names',
    run: () => {
      assert.strictEqual(FormatHelper.getMetaDisplayName('ou'), 'OU');
      assert.strictEqual(FormatHelper.getMetaDisplayName('vgc2026regi'), 'VGC 2026 Reg. I');
      assert.strictEqual(FormatHelper.toUserString({ generation: 'gen8', meta: 'ou' }), 'OU (Gen 8)');
      assert.strictEqual(FormatHelper.toUserString({ generation: 'gen9', meta: 'vgc2026regi' }), 'VGC 2026 Reg. I (Gen 9)');
    }
  },
  {
    name: 'resolves supported set metas and analysis links',
    run: () => {
      assert.strictEqual(FormatHelper.tryResolveSupportedSetMeta('gen9', 'OU Defensive Pivot'), 'ou');
      assert.strictEqual(FormatHelper.tryResolveSupportedSetMeta('gen9', 'VGC 2025 Reg I Bulky Support'), 'vgc2026regi');
      assert.strictEqual(FormatHelper.tryResolveSupportedSetMeta('gen8', 'VGC 2022 Utility'), 'vgc2022');
      assert.strictEqual(FormatHelper.tryResolveSupportedSetMeta('gen8', 'VGC 2023 Support'), undefined);
      assert.strictEqual(FormatHelper.tryResolveSupportedSetMeta('gen8', 'National Dex RU Showdown Usage'), undefined);

      assert.strictEqual(FormatHelper.getSmogonAnalysisUrl({ generation: 'gen9', meta: 'ou' }), 'https://www.smogon.com/dex/sv/formats/ou');
      assert.strictEqual(FormatHelper.getSmogonAnalysisUrl({ generation: 'gen9', meta: 'vgc2026regf' }), 'https://www.smogon.com/dex/sv/formats/vgc24-regulation-f/');
      assert.strictEqual(FormatHelper.getSmogonAnalysisUrl({ generation: 'gen9', meta: 'vgc2026regi' }), 'https://www.smogon.com/dex/sv/formats/vgc25-regulation-i/');
      assert.strictEqual(FormatHelper.getSmogonAnalysisUrl({ generation: 'gen8', meta: 'vgc2022' }), 'https://www.smogon.com/');
    }
  }
];

function run(): void {
  tests.forEach(test => {
    test.run();
    console.log(`PASS ${test.name}`);
  });
}

try {
  run();
}
catch (error) {
  console.error(error);
  process.exit(1);
}