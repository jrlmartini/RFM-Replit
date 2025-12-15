import { useState, useRef, useMemo } from "react";
import { useThemeToggle } from "@/hooks/use-theme";
import { processRFM, RFMResult, CATEGORY_COLORS, CATEGORY_ORDER, RFMData } from "@/lib/rfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, FileSpreadsheet, Image as ImageIcon, FilterX, ArrowUpDown, ArrowUp, ArrowDown, Search, Sun, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { utils, writeFile } from "xlsx";
import * as htmlToImage from "html-to-image";
import { saveAs } from "file-saver";
import { cn } from "@/lib/utils";

type SortConfig = {
  key: keyof RFMData | null;
  direction: 'asc' | 'desc';
};

export default function RFMAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RFMResult | null>(null);
  const [months, setMonths] = useState([12]);
  const [segments, setSegments] = useState<string[]>(["Autarquia", "Privado"]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  
  const { toast } = useToast();
  const { theme, toggleTheme } = useThemeToggle();
  
  const heatmapRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      toast({ title: "Erro", description: "Por favor, envie um arquivo Excel.", variant: "destructive" });
      return;
    }
    if (segments.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um segmento.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setSelectedCategory(null); // Reset filter on new analysis
    setSearchQuery(""); // Reset search
    setSortConfig({ key: null, direction: 'asc' }); // Reset sort
    try {
      const data = await processRFM(file, months[0], segments);
      setResult(data);
      toast({ title: "Sucesso", description: "Análise RFM concluída!" });
    } catch (error: any) {
      toast({ 
        title: "Erro na análise", 
        description: error.message || "Verifique o formato do arquivo.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategory(prev => prev === category ? null : category);
  };

  const handleSort = (key: keyof RFMData) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredData = useMemo(() => {
    if (!result) return [];
    
    let data = [...result.data];

    // Filter by category
    if (selectedCategory) {
      data = data.filter(d => d.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      data = data.filter(d => d.cliente.toLowerCase().includes(query));
    }

    // Sort
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [result, selectedCategory, searchQuery, sortConfig]);

  // Get unique categories from result for the dropdown
  const availableCategories = useMemo(() => {
    if (!result) return [];
    const categories = Array.from(new Set(result.data.map(d => d.category)));
    return CATEGORY_ORDER.filter(cat => categories.includes(cat));
  }, [result]);

  const exportExcel = () => {
    if (!result) return;
    
    const wb = utils.book_new();
    
    // Clients Sheet
    const wsData = utils.json_to_sheet(result.data.map(d => ({
      "Cliente": d.cliente,
      "Recência (dias)": d.recency,
      "Frequência": d.frequency,
      "Monetário": d.monetary,
      "Score R": d.score_r,
      "Score F": d.score_f,
      "Score M": d.score_m,
      "Score FM": d.score_fm,
      "Categoria": d.category
    })));
    utils.book_append_sheet(wb, wsData, "Clientes RFM");
    
    // Summary Sheet
    const wsSummary = utils.json_to_sheet(result.categoryCounts);
    utils.book_append_sheet(wb, wsSummary, "Resumo Categorias");
    
    writeFile(wb, "rfm_resultado.xlsx");
    toast({ title: "Download", description: "Planilha rfm_resultado.xlsx gerada." });
  };

  const exportImages = async () => {
    if (heatmapRef.current) {
      const blob = await htmlToImage.toBlob(heatmapRef.current, { backgroundColor: '#fff' });
      if (blob) saveAs(blob, "rfm_heatmap.png");
    }
    
    // Delay slightly to ensure browser handles first download
    setTimeout(async () => {
      if (barChartRef.current) {
        const blob = await htmlToImage.toBlob(barChartRef.current, { backgroundColor: '#fff' });
        if (blob) saveAs(blob, "rfm_barras.png");
      }
      toast({ title: "Download", description: "Imagens geradas." });
    }, 500);
  };

  const SortIcon = ({ column }: { column: keyof RFMData }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-slate-400" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-3 w-3 text-primary" />
      : <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const SortableHead = ({ column, label, align = "left" }: { column: keyof RFMData, label: string, align?: "left" | "right" | "center" }) => (
    <TableHead 
      className={cn(
        "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      )}
      onClick={() => handleSort(column)}
    >
      <div className={cn("flex items-center gap-1", align === "right" && "justify-end", align === "center" && "justify-center")}>
        {label}
        <SortIcon column={column} />
      </div>
    </TableHead>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Análise RFM</h1>
            <p className="text-slate-500 dark:text-slate-400">Segmentação inteligente de clientes baseada em dados.</p>
          </div>
          <div className="flex items-center gap-2">
             {result && (
               <>
                 <Button variant="outline" onClick={exportImages} data-testid="button-export-images">
                   <ImageIcon className="mr-2 h-4 w-4" /> Salvar Imagens
                 </Button>
                 <Button variant="outline" onClick={exportExcel} data-testid="button-export-excel">
                   <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel
                 </Button>
               </>
             )}
             <Button
               variant="ghost"
               size="icon"
               onClick={toggleTheme}
               className="ml-2"
               data-testid="button-theme-toggle"
             >
               {theme === "dark" ? (
                 <Sun className="h-5 w-5 text-yellow-500" />
               ) : (
                 <Moon className="h-5 w-5 text-slate-600" />
               )}
             </Button>
          </div>
        </div>

        {/* Controls Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle>Configuração da Análise</CardTitle>
            <CardDescription>Carregue seus dados e ajuste os parâmetros.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-6">
            
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo Excel (.xlsx)</Label>
              <div className="relative">
                <Input 
                  id="file" 
                  type="file" 
                  accept=".xlsx" 
                  onChange={handleFileChange} 
                  className="cursor-pointer file:cursor-pointer file:text-primary file:font-medium"
                />
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Prazo de Análise</Label>
                <span className="text-sm text-slate-500 font-mono">{months[0]} meses</span>
              </div>
              <Slider 
                value={months} 
                onValueChange={setMonths} 
                min={1} 
                max={36} 
                step={1} 
                className="py-2"
              />
            </div>

            {/* Segment Toggle */}
            <div className="space-y-2">
              <Label>Segmento</Label>
              <ToggleGroup type="multiple" value={segments} onValueChange={setSegments} className="justify-start">
                <ToggleGroupItem value="Autarquia" aria-label="Toggle Autarquia" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Autarquia
                </ToggleGroupItem>
                <ToggleGroupItem value="Privado" aria-label="Toggle Privado" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Privado
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Action Button */}
            <div className="flex items-end">
              <Button onClick={runAnalysis} disabled={loading} className="w-full text-md font-medium" size="lg">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Análise RFM"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-8">
              
              {/* Heatmap */}
              <Card ref={heatmapRef} className="overflow-hidden border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle>Heatmap de Categorias</CardTitle>
                  <CardDescription>
                    Distribuição de clientes por Score R vs Score FM. 
                    <span className="text-primary font-medium ml-1">Clique para filtrar.</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center p-6"> 
                  <div className="flex items-center gap-4">
                    {/* Y Axis Label Container */}
                    <div className="h-48 w-6 flex items-center justify-center relative">
                       <span className="-rotate-90 whitespace-nowrap text-xs font-semibold text-slate-500 tracking-wider absolute">
                          SCORE FM (Frequência + Monetário)
                       </span>
                    </div>

                    <div className="flex flex-col items-center">
                      {/* Grid */}
                      <div className="grid grid-cols-5 gap-1 mb-2">
                        {result.heatmap.map((cell, idx) => {
                          const isSelected = selectedCategory === cell.category;
                          const isDimmed = selectedCategory && !isSelected;
                          
                          return (
                            <div 
                              key={idx} 
                              onClick={() => toggleCategory(cell.category)}
                              className={cn(
                                "w-16 h-16 md:w-24 md:h-24 flex flex-col items-center justify-center text-center p-1 rounded-sm shadow-sm transition-all border border-white/10 cursor-pointer",
                                isDimmed ? "opacity-30 grayscale" : "hover:scale-105 hover:z-10 hover:shadow-lg",
                                isSelected ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 z-10 scale-105" : ""
                              )}
                              style={{ backgroundColor: cell.color, color: '#fff' }}
                              title={`${cell.category}: R=${cell.r}, FM=${cell.fm}`}
                            >
                              <span className="text-xl md:text-2xl font-bold leading-none mb-1 drop-shadow-md">{cell.count}</span>
                              <span className="text-[9px] md:text-[10px] opacity-90 leading-tight uppercase tracking-tight">{cell.category}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* X Axis Label */}
                      <div className="text-center text-xs font-semibold text-slate-500 tracking-wider mt-4">
                        SCORE R (Recência)
                      </div>
                    </div>
                  </div>
                  
                  {/* Axis Indicators - Moved outside the flex container to span full width below if needed, or keep inside */}
                </CardContent>
                <div className="flex justify-between w-full max-w-[480px] px-8 mx-auto pb-6 -mt-2 text-[10px] text-slate-400 font-mono">
                    <span>1 (Pior)</span>
                    <span>5 (Melhor)</span>
                </div>
              </Card>

              {/* Bar Chart */}
              <Card ref={barChartRef} className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle>Clientes por Categoria</CardTitle>
                  <CardDescription>
                    Volume total de clientes em cada segmento.
                    <span className="text-primary font-medium ml-1">Clique para filtrar.</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.categoryCounts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="category" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80} 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      />
                      <Bar 
                        dataKey="count" 
                        radius={[4, 4, 0, 0]} 
                        onClick={(data) => toggleCategory(data.category)}
                        cursor="pointer"
                      >
                        {result.categoryCounts.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            opacity={selectedCategory && selectedCategory !== entry.category ? 0.3 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Data Table */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Detalhamento por Cliente
                      {(selectedCategory || searchQuery) && (
                        <button 
                          onClick={() => { setSelectedCategory(null); setSearchQuery(""); }} 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          data-testid="button-clear-filters"
                        >
                          Limpar filtros
                          <FilterX className="ml-1 h-3 w-3" />
                        </button>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Mostrando {filteredData.length} de {result.data.length} clientes
                      {selectedCategory ? ` na categoria "${selectedCategory}"` : ""}
                      {searchQuery ? ` com "${searchQuery}"` : ""}
                      .
                    </CardDescription>
                  </div>
                </div>
                
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-client"
                    />
                  </div>
                  <Select 
                    value={selectedCategory || "all"} 
                    onValueChange={(value) => setSelectedCategory(value === "all" ? null : value)}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category-filter">
                      <SelectValue placeholder="Filtrar por categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                            />
                            {cat}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                   <div className="max-h-[600px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                        <TableRow>
                          <SortableHead column="cliente" label="Cliente" />
                          <SortableHead column="category" label="Categoria" />
                          <SortableHead column="recency" label="Recência (dias)" align="right" />
                          <SortableHead column="frequency" label="Frequência" align="right" />
                          <SortableHead column="monetary" label="Monetário" align="right" />
                          <SortableHead column="score_r" label="Score R" align="center" />
                          <SortableHead column="score_fm" label="Score FM" align="center" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.length > 0 ? (
                          filteredData.map((row, i) => (
                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <TableCell className="font-medium">{row.cliente}</TableCell>
                              <TableCell>
                                <span 
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white shadow-sm"
                                  style={{ backgroundColor: CATEGORY_COLORS[row.category] || "#999" }}
                                >
                                  {row.category}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono">{row.recency}</TableCell>
                              <TableCell className="text-right font-mono">{row.frequency}</TableCell>
                              <TableCell className="text-right font-mono">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.monetary)}
                              </TableCell>
                              <TableCell className="text-center font-mono text-slate-500">{row.score_r}</TableCell>
                              <TableCell className="text-center font-mono text-slate-500">{row.score_fm}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                              Nenhum cliente encontrado com os filtros atuais.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}
