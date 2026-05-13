import { svedata } from '@svedata/data';

export async function run(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(
      [
        'svedata — CLI för svenska myndighets-API:er',
        '',
        'Användning:',
        '  svedata smhi current <stad>',
        '',
      ].join('\n'),
    );
    return 0;
  }

  if (cmd === 'smhi' && rest[0] === 'current' && rest[1]) {
    const result = await svedata.smhi.current(rest[1]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  process.stderr.write(`Okänt kommando: ${cmd}\n`);
  return 1;
}
