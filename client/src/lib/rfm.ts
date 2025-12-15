import { read, utils } from 'xlsx';

export type RFMData = {
  cliente: string;
  recency: number;
  frequency: number;
  monetary: number;
  score_r: number;
  score_f: number;
  score_m: number;
  score_fm: number;
  category: string;
};

export type CategoryCount = {
  category: string;
  count: number;
  color: string;
};

export type HeatmapCell = {
  r: number;
  fm: number;
  category: string;
  count: number;
  color: string;
};

export type RFMResult = {
  data: RFMData[];
  categoryCounts: CategoryCount[];
  heatmap: HeatmapCell[];
};

export const CATEGORY_COLORS: Record<string, string> = {
  "Campeões": "#264653",
  "Fiel": "#2a9d8f",
  "Atencao": "#e76f51",
  "Quase Domententes": "#f4a261",
  "Promessas": "#e9c46a",
  "Novos Clientes": "#f4d35e",
  "Hibernando": "#8d99ae",
  "Nao Pode Perder": "#d62828",
  "Em Risco": "#bc4749",
  "Perdidos": "#6d597a",
  "Fiel em Potencial": "#ffb703",
  "Sem Categoria": "#e0e0e0"
};

// Order for charts/legends
export const CATEGORY_ORDER = [
  "Campeões", "Fiel", "Fiel em Potencial", "Novos Clientes", "Promessas",
  "Atencao", "Quase Domententes", "Em Risco", "Nao Pode Perder", "Hibernando", "Perdidos"
];

// Helper to calculate Quintiles
function getQuintile(value: number, sortedValues: number[], type: 'asc' | 'desc'): number {
  // Simple quintile calculation based on rank
  // Note: The spec says "quintil(Recency, labels=[5,4,3,2,1])" -> lower recency = higher score (5)
  // "quintil(rank(Frequency), labels=[1,2,3,4,5])" -> higher frequency = higher score (5)
  
  // Find percentile
  const position = sortedValues.indexOf(value);
  const percentile = (position + 1) / sortedValues.length;
  
  if (type === 'desc') {
    // For Recency: Lower is better (5).
    // Bottom 20% (lowest values) -> 5
    // Top 20% (highest values) -> 1
    if (percentile <= 0.2) return 5;
    if (percentile <= 0.4) return 4;
    if (percentile <= 0.6) return 3;
    if (percentile <= 0.8) return 2;
    return 1;
  } else {
    // For F and M: Higher is better (5).
    // Bottom 20% -> 1
    // Top 20% -> 5
    if (percentile <= 0.2) return 1;
    if (percentile <= 0.4) return 2;
    if (percentile <= 0.6) return 3;
    if (percentile <= 0.8) return 4;
    return 5;
  }
}

// Function to classify based on Score_R and Score_FM
function classify(r: number, fm: number): string {
  if (r === 5 && fm === 5) return "Campeões";
  if ((r === 5 && fm === 4) || (r === 4 && (fm === 4 || fm === 5)) || (r === 3 && (fm === 4 || fm === 5))) return "Fiel";
  if (r === 3 && fm === 3) return "Atencao";
  if (r === 3 && (fm === 1 || fm === 2)) return "Quase Domententes"; // Note: Spec typo "Domententes" -> Dormentes usually, but keeping spec
  if (r === 4 && fm === 1) return "Promessas";
  if (r === 5 && fm === 1) return "Novos Clientes";
  if (r === 2 && fm === 2) return "Hibernando";
  if ((r === 1 || r === 2) && fm === 5) return "Nao Pode Perder";
  if ((r === 1 || r === 2) && (fm === 3 || fm === 4)) return "Em Risco";
  if ((r === 1 && (fm === 1 || fm === 2)) || (r === 2 && fm === 1)) return "Perdidos";
  if ((r === 4 || r === 5) && (fm === 2 || fm === 3)) return "Fiel em Potencial";
  
  return "Sem Categoria";
}

export async function processRFM(
  file: File, 
  months: number, 
  segments: string[]
): Promise<RFMResult> {
  
  // 1. Read File
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData: any[] = utils.sheet_to_json(worksheet);

  if (!rawData || rawData.length === 0) {
    throw new Error("Arquivo vazio.");
  }

  // 2. Normalize and Filter
  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setMonth(now.getMonth() - months);

  const cleanData = rawData
    .map((row: any) => {
      // Flexible column mapping
      const cliente = row["Cliente (Nome Fantasia)"] || row["Cliente"] || row["Nome Fantasia"];
      // Handle Excel dates (serial numbers) or string dates
      let dateRaw = row["Data de Emissão (completa)"] || row["Data"] || row["Data de Emissão"];
      let date: Date;
      
      if (typeof dateRaw === 'number') {
        // Excel serial date
        date = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
      } else {
        date = new Date(dateRaw);
      }

      const total = Number(row["Total da Nota Fiscal"] || row["Total"] || row["Valor"] || 0);
      const tags = String(row["Tags"] || "");

      return { cliente, date, total, tags };
    })
    .filter(item => {
      // Required fields check
      if (!item.cliente || isNaN(item.date.getTime()) || isNaN(item.total)) return false;
      
      // Segment filter
      const hasSegment = segments.some(seg => item.tags.includes(seg));
      if (!hasSegment) return false;

      // Date filter
      if (item.date < cutoffDate) return false;

      return true;
    });

  if (cleanData.length === 0) {
    throw new Error("Sem movimentação no período selecionado ou arquivo inválido.");
  }

  // 3. Calculate RFM
  const latestDate = cleanData.reduce((max, item) => item.date > max ? item.date : max, new Date(0));
  
  const clientMap = new Map<string, { latest: Date, count: number, total: number }>();

  cleanData.forEach(item => {
    const current = clientMap.get(item.cliente) || { latest: new Date(0), count: 0, total: 0 };
    if (item.date > current.latest) current.latest = item.date;
    current.count += 1;
    current.total += item.total;
    clientMap.set(item.cliente, current);
  });

  const rfmList: { cliente: string, recency: number, frequency: number, monetary: number }[] = [];
  
  // Calculate raw Recency (days)
  const oneDay = 24 * 60 * 60 * 1000;
  clientMap.forEach((val, key) => {
    const diffDays = Math.round(Math.abs((latestDate.getTime() - val.latest.getTime()) / oneDay));
    rfmList.push({
      cliente: key,
      recency: diffDays,
      frequency: val.count,
      monetary: val.total
    });
  });

  // 4. Scoring (Quintiles)
  // Sort lists for quintile calculation
  const recencyValues = rfmList.map(i => i.recency).sort((a, b) => a - b);
  const frequencyValues = rfmList.map(i => i.frequency).sort((a, b) => a - b);
  const monetaryValues = rfmList.map(i => i.monetary).sort((a, b) => a - b);

  const scoredData: RFMData[] = rfmList.map(item => {
    const score_r = getQuintile(item.recency, recencyValues, 'desc');
    const score_f = getQuintile(item.frequency, frequencyValues, 'asc');
    const score_m = getQuintile(item.monetary, monetaryValues, 'asc');
    const score_fm = Math.round((score_f + score_m) / 2);
    const category = classify(score_r, score_fm);

    return {
      ...item,
      score_r,
      score_f,
      score_m,
      score_fm,
      category
    };
  });

  // 5. Heatmap Generation
  const heatmap: HeatmapCell[] = [];
  // 5x5 Grid (R: 1-5, FM: 1-5)
  for (let fm = 5; fm >= 1; fm--) { // Inverted Y axis as per spec
    for (let r = 1; r <= 5; r++) {
      const cat = classify(r, fm);
      const count = scoredData.filter(d => d.score_r === r && d.score_fm === fm).length;
      heatmap.push({
        r,
        fm,
        category: cat,
        count,
        color: CATEGORY_COLORS[cat] || "#e0e0e0"
      });
    }
  }

  // 6. Category Counts
  const categoryCounts: CategoryCount[] = CATEGORY_ORDER.map(cat => ({
    category: cat,
    count: scoredData.filter(d => d.category === cat).length,
    color: CATEGORY_COLORS[cat] || "#e0e0e0"
  }));

  // Add "Sem Categoria" if any
  const uncategorizedCount = scoredData.filter(d => !CATEGORY_ORDER.includes(d.category)).length;
  if (uncategorizedCount > 0) {
    categoryCounts.push({
      category: "Sem Categoria",
      count: uncategorizedCount,
      color: CATEGORY_COLORS["Sem Categoria"]
    });
  }

  return {
    data: scoredData,
    categoryCounts,
    heatmap
  };
}
