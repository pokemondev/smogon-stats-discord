import assert = require('assert');
import { FormatHelper } from './formatHelper';
import { SmogonFormat } from './usageModels';

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
    expected: { generation: 'gen9', meta: 'ou' }
  },
  {
    args: [ 'pikachu' ],
    expected: { generation: 'gen9', meta: 'ou' }
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
    args: [ 'gen8', 'vgc' ],
    expected: { generation: 'gen8', meta: 'vgc2021' }
  },
  {
    args: [ 'vgc', '2021' ],
    expected: { generation: 'gen8', meta: 'vgc2021' }
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