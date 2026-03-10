const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractTotalFromMeta = (metaSource, itemsLength) => {
  const directTotal = toNumber(metaSource?.total, NaN);
  if (Number.isFinite(directTotal)) return directTotal;

  const knownCountKeys = ['products_count', 'customers_count', 'suppliers_count', 'invoices_count', 'items_count', 'count'];
  for (const key of knownCountKeys) {
    const value = toNumber(metaSource?.[key], NaN);
    if (Number.isFinite(value)) return value;
  }

  const countLikeEntry = Object.entries(metaSource || {}).find(([key, value]) =>
    /_count$/i.test(key) && Number.isFinite(Number(value))
  );
  if (countLikeEntry) return Number(countLikeEntry[1]);

  return itemsLength;
};

export const normalizePaginatedResponse = (response) => {
  const raw = response?.data ?? {};
  const payload = raw?.data ?? raw;

  let items = [];
  if (Array.isArray(payload)) {
    items = payload;
  } else if (Array.isArray(payload?.data)) {
    items = payload.data;
  } else if (Array.isArray(payload?.items)) {
    items = payload.items;
  } else if (Array.isArray(raw?.data) && !Array.isArray(payload)) {
    items = raw.data;
  }

  const hasTopLevelPagination =
    typeof raw === 'object' &&
    raw !== null &&
    (
      Object.prototype.hasOwnProperty.call(raw, 'current_page') ||
      Object.prototype.hasOwnProperty.call(raw, 'last_page') ||
      Object.prototype.hasOwnProperty.call(raw, 'total') ||
      Object.prototype.hasOwnProperty.call(raw, 'per_page')
    );

  const metaSource = hasTopLevelPagination ? raw : payload?.meta || raw?.meta || payload || raw;

  const page = toNumber(metaSource?.current_page ?? metaSource?.page, 1);
  const perPage = toNumber(metaSource?.per_page ?? metaSource?.perPage, items.length || 25);
  const total = extractTotalFromMeta(metaSource, items.length);
  const lastPage = toNumber(
    metaSource?.last_page ?? metaSource?.lastPage,
    Math.max(1, Math.ceil((total || items.length) / (perPage || 1)))
  );

  return {
    items,
    meta: {
      page: Math.max(1, page),
      perPage: Math.max(1, perPage),
      total: Math.max(0, total),
      lastPage: Math.max(1, lastPage),
    },
    payload,
  };
};