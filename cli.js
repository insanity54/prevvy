import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Prevvy from './src/index.js';

const MAX_RETRIES = 3;

const generateTimestamp = () => {
  // Generate a timestamp as a string
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
};

const runGenerateCommand = async (argv, retryCount = 0) => {
  const timestamp = generateTimestamp(); // Get the timestamp

  console.info(argv);
  console.log('hello generation');

  try {
    console.log('beginning Prevvy');

    // Prefix the timestamp to temporary file names
    const opts = {
      input: argv.input,
      output: argv.output,
      throttleTimeout: 2000,
      width: 128,
      cols: 5,
      rows: 5,
    };

    const thumb = new Prevvy(opts);
    await thumb.generate();
  } catch (error) {
    console.error(`Error during generation: ${error.message}`);
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying (attempt ${retryCount + 1})...`);
      await runGenerateCommand(argv, retryCount + 1);
    } else {
      console.error('Max retries reached. Exiting.');
      process.exit(1);
    }
  }
};

yargs(hideBin(process.argv))
  .command({
    command: 'generate',
    alias: 'g',
    desc: 'Generate a storyboard image',
    builder: (yargs) => {
      return yargs
        .option('input', {
          alias: 'i',
          describe: 'input file or html or whatever',
          required: true,
        })
        .option('output', {
          alias: 'o',
          describe: 'output file',
          required: true,
        })
        .option('max-retries', {
          describe: 'Maximum number of retries',
          default: MAX_RETRIES,
          type: 'number',
        });
    },
    handler: async (argv) => {
      await runGenerateCommand(argv);
    },
  })
  .demandCommand(1)
  .help()
  .parse();
