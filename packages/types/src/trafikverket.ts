export type TrafikverketTrainAnnouncement = {
  activity_id: string;
  activity_type: string;
  advertised_train_ident: string;
  from_location: string[];
  to_location: string[];
  advertised_time_at_location: string | null;
  estimated_time_at_location: string | null;
  time_at_location: string | null;
  canceled: boolean;
  deviation: string[];
};

export type TrafikverketTrainsResult = {
  total: number;
  trains: TrafikverketTrainAnnouncement[];
};

export type TrafikverketSituation = {
  id: string;
  modified_time: string;
  county_no: number[];
  message: string | null;
  road_number: string | null;
  severity_text: string | null;
};

export type TrafikverketSituationsResult = {
  total: number;
  situations: TrafikverketSituation[];
};
