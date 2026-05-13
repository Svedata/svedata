export type PolisenEvent = {
  id: number;
  datetime: string;
  name: string;
  summary: string;
  type: string;
  url: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
};

export type PolisenEventsResult = {
  total: number;
  events: PolisenEvent[];
};
