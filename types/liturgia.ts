export type IsoDate = `${number}-${number}-${number}`;

export interface LiturgicalCalendar {
  year: number;
  scraped_at: string;
  total_days: number;
  days: LiturgicalDay[];
}

export interface LiturgicalDay {
  date: IsoDate;
  date_display: string;
  title: string;
  color: string;
  reading_sets: ReadingSet[];
  url?: string;
}

export interface ReadingSet {
  readings: Reading[];
}

export interface Reading {
  type: string;
  reference: string;
  verses: Verse[];
}

export interface Verse {
  number?: string;
  text: string;
}

// Ejemplo de uso (tipado, sin pantallas)
export const ejemploDia: LiturgicalDay = {
  date: '2026-01-01',
  date_display: 'enero 1, 2026',
  title: 'Octava de la Natividad: Solemnidad de la Santisima Virgen Maria, Madre de Dios',
  color: 'Blanco',
  reading_sets: [
    {
      readings: [
        {
          type: 'Evangelio',
          reference: 'Lucas 2:16-21',
          verses: [{ number: '16', text: 'Y fueron presurosos y encontraron a Maria y a Jose...' }],
        },
      ],
    },
  ],
};
