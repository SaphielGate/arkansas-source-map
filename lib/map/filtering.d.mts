export type MapFilters = {
  county: string;
  city: string;
  zipCode: string;
  recordStatus: string;
  humanReviewStatus: string;
  firstSeenFrom: string;
  lastSeenThrough: string;
};

export type FilterableMapRecord = {
  county: string;
  city: string;
  zip_code: string;
  record_status: string;
  human_review_status: string;
  first_seen: string;
  last_seen: string;
  review_layer: boolean;
};

export const emptyMapFilters: Readonly<MapFilters>;
export function isOrdinaryVisible(record: FilterableMapRecord): boolean;
export function filterMapRecords<T extends FilterableMapRecord>(records: T[], filters: MapFilters, includePending?: boolean): T[];
