import { svedata } from '@svedata/data';

export { svedata };

export const tools = [
  {
    name: 'smhi_current',
    description: 'Hämta aktuellt väder för en svensk stad via SMHI.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Stadsnamn, t.ex. "Stockholm".' },
      },
      required: ['city'],
    },
  },
] as const;
