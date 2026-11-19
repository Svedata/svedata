export type VisitSwedenType = 'lodging' | 'food' | 'event' | 'place' | 'store' | 'trip';

export type VisitSwedenItem = {
  /** `<contextId>/<entryId>`, e.g. '210/4613'. Pass to `lookup()`. */
  id: string;
  /** schema.org type without prefix, e.g. 'LodgingBusiness' or 'Event'. */
  type: string;
  name: string;
  description: string;
  url: string | null;
  /** Visit Sweden region slug, e.g. 'skane', or null. */
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  street_address: string | null;
  postal_code: string | null;
  locality: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type VisitSwedenSearchResult = {
  total: number;
  offset: number;
  items: VisitSwedenItem[];
};
