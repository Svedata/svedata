export type SmhiCurrentWeather = {
  location: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  air_temperature: number | null;
  wind_speed: number | null;
  wind_from_direction: number | null;
  relative_humidity: number | null;
  air_pressure_at_mean_sea_level: number | null;
  symbol_code: number | null;
  predominant_precipitation_type_at_surface: number | null;
  precipitation_amount_mean: number | null;
};
