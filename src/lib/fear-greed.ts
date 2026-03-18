export type FearGreedItem = {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
};

export type FearGreedResponse = {
  name: string;
  data: FearGreedItem[];
  metadata?: { error: string | null } | null;
};

export type FearGreedHistoricalPoint = {
  label: "Now" | "Yesterday" | "Last week" | "Last month";
  value: string;
  classification: string;
};

export type FearGreedSnapshot = {
  historical: FearGreedHistoricalPoint[];
  nextUpdateSeconds: number | null;
};

export async function fetchFearGreedSnapshot(): Promise<FearGreedSnapshot> {
  const res = await fetch("https://api.alternative.me/fng/?limit=31", { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao buscar Fear & Greed Index: ${res.status} ${body}`);
  }

  const payload = (await res.json()) as FearGreedResponse;
  const data = Array.isArray(payload?.data) ? payload.data : [];

  const pick = (idx: number) => data[idx];
  const points: Array<{ label: FearGreedHistoricalPoint["label"]; item: FearGreedItem | undefined }> = [
    { label: "Now", item: pick(0) },
    { label: "Yesterday", item: pick(1) },
    { label: "Last week", item: pick(7) },
    { label: "Last month", item: pick(30) },
  ];

  const historical = points
    .filter((p) => p.item?.value && p.item?.value_classification)
    .map((p) => ({
      label: p.label,
      value: String(p.item!.value),
      classification: String(p.item!.value_classification),
    }));

  const secondsRaw = data?.[0]?.time_until_update;
  const seconds = secondsRaw ? Number(secondsRaw) : null;
  const nextUpdateSeconds = Number.isFinite(seconds) ? Math.max(0, seconds as number) : null;

  return { historical, nextUpdateSeconds };
}

