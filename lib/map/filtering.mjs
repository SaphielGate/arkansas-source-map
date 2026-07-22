export const emptyMapFilters = Object.freeze({
  county: "",
  city: "",
  zipCode: "",
  recordStatus: "",
  humanReviewStatus: "",
  firstSeenFrom: "",
  lastSeenThrough: "",
});

export function isOrdinaryVisible(record) {
  return record.review_layer === false && record.human_review_status === "approved";
}

export function filterMapRecords(records, filters, includePending = false) {
  return records.filter((record) => {
    const visibilityAllowed = isOrdinaryVisible(record) || (includePending && record.review_layer === true);
    if (!visibilityAllowed) return false;
    if (filters.county && record.county !== filters.county) return false;
    if (filters.city && record.city !== filters.city) return false;
    if (filters.zipCode && record.zip_code !== filters.zipCode) return false;
    if (filters.recordStatus && record.record_status !== filters.recordStatus) return false;
    if (filters.humanReviewStatus && record.human_review_status !== filters.humanReviewStatus) return false;
    if (filters.firstSeenFrom && record.first_seen < filters.firstSeenFrom) return false;
    if (filters.lastSeenThrough && record.last_seen > filters.lastSeenThrough) return false;
    return true;
  });
}
