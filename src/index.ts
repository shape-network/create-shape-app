import { pathToFileURL } from 'node:url';
import { parseArgs } from './cli/args.js';
import { HELP_TEXT } from './cli/help.js';

export const CLI_VERSION = '0.0.0-development';

export async function runCLI(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);

    if (options.help) {
      console.log(HELP_TEXT);
      return 0;
    }

    if (options.version) {
      console.log(CLI_VERSION);
      return 0;
    }

    if (!options.projectName) {
      console.error('Missing required project name.');
      console.error('');
      console.error(HELP_TEXT);
      return 1;
    }

    console.error('Core scaffolder not implemented yet.');
    console.error(`Planned project target: ${options.projectName}`);
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error(message);
    console.error('');
    console.error(HELP_TEXT);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await runCLI(process.argv.slice(2));
  process.exit(code);
}
