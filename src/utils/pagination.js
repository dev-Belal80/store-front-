const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  const metaSource = payload?.meta || raw?.meta || payload || raw;

  const page = toNumber(metaSource?.current_page ?? metaSource?.page, 1);
  const perPage = toNumber(metaSource?.per_page ?? metaSource?.perPage, items.length || 25);
  const total = toNumber(metaSource?.total, items.length);
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