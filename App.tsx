
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MappedProduct, BulkSearchResult, QuotationMap } from './types';
import { fetchAndParseProducts } from './services/csvService';
import { extractShoppingItems, ExtractedItem } from './services/geminiService';
import ProductTable from './components/ProductTable';

const medicalThesaurus: Record<string, string[]> = {
  'afastador': ['afastador', 'afast', 'retractor'],
  'pinca': ['pinca', 'pinça', 'forceps', 'clamp'],
  'tesoura': ['tesoura', 'tes', 'scissors'],
  'porta': ['porta', 'needle', 'holder'],
  'cabo': ['cabo', 'handle'],
  'volkmann': ['volkmann', 'volkman', 'wulkman', 'vulkman', 'vulkmann'],
  'senn': ['senn', 'sen', 'semm', 'sem'],
  'mueller': ['mueller', 'muller', 'mulir', 'muler'],
  'metzenbaum': ['metzenbaum', 'metz', 'metzebaum'],
  'mayo': ['mayo', 'maio'],
  'kelly': ['kelly', 'kely'],
  'clipe': ['clipe', 'clips', 'clip'],
  'clips': ['clips', 'clipe', 'clip'],
};

const normalizeText = (text: string): string => {
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const levenshtein = (a: string, b: string): number => {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) tmp[i] = [i];
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
};

const calculateMatchScore = (product: MappedProduct, query: string): number => {
  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(" ").filter(t => t.length > 0);
  if (queryTokens.length === 0) return 0;

  const productTitle = normalizeText(product.title);
  const productWords = productTitle.split(" ");
  
  let score = 0;
  
  // High weight for items that contain all query words
  const containsAllTokens = queryTokens.every(token => {
    const synonyms = medicalThesaurus[token] || [token];
    return synonyms.some(syn => productTitle.includes(syn));
  });

  if (containsAllTokens) score += 5000;

  // Weight for first word matching (Anchor)
  const anchorToken = queryTokens[0];
  const anchorSynonyms = medicalThesaurus[anchorToken] || [anchorToken];
  const productStartsWithAnchor = anchorSynonyms.some(syn => productWords[0] === syn || productWords[0]?.startsWith(syn));
  const productContainsAnchor = anchorSynonyms.some(syn => productWords.includes(syn));

  if (productStartsWithAnchor) score += 5000; 
  else if (productContainsAnchor) score += 1000; 
  else {
    if (queryTokens.length > 1) return -1;
  }

  // Check for accessories mismatch
  const accessoryKeywords = ['cabo', 'capa', 'suporte', 'p/', 'para'];
  const isCaboSearch = anchorSynonyms.includes('cabo');
  const isProductAccessory = productWords.some(w => accessoryKeywords.includes(w));
  if (isProductAccessory && !isCaboSearch) score -= 4000;

  queryTokens.forEach((token, qIdx) => {
    const synonyms = medicalThesaurus[token] || [token];
    let bestMatch = 0;
    productWords.forEach((word) => {
      if (synonyms.some(s => word === s)) {
        bestMatch = 2000; 
      } else {
        const dist = levenshtein(token, word);
        const threshold = token.length > 5 ? 2 : 1;
        if (dist <= threshold) bestMatch = Math.max(bestMatch, 1000 - (dist * 200));
      }
    });
    score += bestMatch;
  });

  return score;
};

const App: React.FC = () => {
  const [allProducts, setAllProducts] = useState<MappedProduct[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkSearchResult[]>([]);
  const [quotationState, setQuotationState] = useState<QuotationMap>({});
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('Todos os fornecedores');
  const [queryInput, setQueryInput] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastStats, setToastStats] = useState({ exact: 0, similar: 0, notFound: 0 });

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    const init = async () => {
      try {
        const data = await fetchAndParseProducts();
        if (data.length > 0) {
          setAllProducts(data);
          const suppliers = Array.from(new Set(data.map(p => p.supplier))).sort();
          setAvailableSuppliers(suppliers);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false); 
      }
    };
    init();
  }, []);

  const handleSearch = async () => {
    if (!queryInput.trim() || isSearching) return;
    setIsSearching(true);
    setQuotationState({});
    setExpandedRows([]);
    setShowToast(false);
    
    try {
      const extractedItems = await extractShoppingItems(queryInput);
      
      const results: BulkSearchResult[] = extractedItems.map((item, index) => {
        const matches = allProducts
          .map(p => ({ ...p, matchScore: calculateMatchScore(p, item.name) }))
          .filter(p => (p.matchScore || 0) > 0)
          .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
          .slice(0, 15);

        if (matches.length > 0) {
          setQuotationState(prev => ({ ...prev, [index]: { [matches[0].id]: item.quantity } }));
        }
        return { 
          term: item.name, 
          originalTerm: item.name, 
          products: matches, 
          detectedQuantity: item.quantity 
        };
      });

      setBulkResults(results);

      // Calculate stats for toast
      let exact = 0;
      let similar = 0;
      let notFound = 0;

      results.forEach(res => {
        if (res.products.length === 0) {
          notFound++;
        } else {
          const p = res.products[0];
          if (normalizeText(res.term) === normalizeText(p.title)) {
            exact++;
          } else {
            similar++;
          }
        }
      });
      setToastStats({ exact, similar, notFound });
      setShowToast(true);

    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuantityChange = (termIndex: number, productId: string, newQty: number) => {
    setQuotationState(prev => ({
      ...prev,
      [termIndex]: { [productId]: Math.max(1, newQty) }
    }));
  };

  const filteredResults = useMemo(() => {
    if (selectedSupplierFilter === 'Todos os fornecedores') return bulkResults;
    return bulkResults.map(res => ({
      ...res,
      products: res.products.filter(p => p.supplier === selectedSupplierFilter)
    }));
  }, [bulkResults, selectedSupplierFilter]);

  const grandTotal = useMemo(() => {
    return filteredResults.reduce((total, result, idx) => {
        const selectedIds = Object.keys(quotationState[idx] || {});
        const activeId = selectedIds[0] || (result.products.length > 0 ? result.products[0].id : null);
        const p = activeId ? result.products.find(prod => prod.id === activeId) : null;
        const qty = activeId ? (quotationState[idx]?.[activeId] || result.detectedQuantity) : result.detectedQuantity;
        return total + ((p?.price || 0) * qty);
    }, 0);
  }, [filteredResults, quotationState]);

  const handleExportCSV = () => {
    const headers = ['Item Solicitado', 'Código', 'Produto Encontrado', 'Fornecedor', 'Quantidade', 'Preço Unitário', 'Preço Total', 'Status'];
    const rows = filteredResults.map((result, idx) => {
         const selectedIds = Object.keys(quotationState[idx] || {});
         const activeId = selectedIds[0] || (result.products.length > 0 ? result.products[0].id : null);
         const p = activeId ? result.products.find(prod => prod.id === activeId) : null;
         const qty = activeId ? (quotationState[idx]?.[activeId] || result.detectedQuantity) : result.detectedQuantity;
         
         const status = p && normalizeText(result.term) === normalizeText(p.title) ? 'Exato' : (p ? 'Similar' : 'Não Encontrado');
         const unitPrice = (p?.price || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2});
         const totalPrice = ((p?.price || 0) * qty).toLocaleString('pt-BR', {minimumFractionDigits: 2});

         return [
             `"${result.term.replace(/"/g, '""')}"`,
             `"${p?.code || ''}"`,
             `"${p?.title || ''}"`,
             `"${p?.supplier || ''}"`,
             qty,
             `"${unitPrice}"`,
             `"${totalPrice}"`,
             status
         ].join(';');
    });
    
    // Add Total Row
    rows.push(['', '', '', '', '', 'TOTAL', `"${grandTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}"`, ''].join(';'));

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cotacao_atec_medical.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-10 h-10 border-4 border-emerald-100 border-t-[#00D17B] rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-black text-slate-800">Carregando Sistema...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
           <img src="https://atecmedicalsearch.vercel.app/logo.png" alt="ATEC MEDICAL" className="h-10 w-auto" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Input Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 no-print">
          <h2 className="text-base font-bold text-[#1E5FCD] flex items-center gap-2 mb-4">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             Cole a lista de produtos
          </h2>
          <textarea
             className="w-full h-48 p-4 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#1E5FCD] focus:border-[#1E5FCD] outline-none resize-none placeholder-slate-400 transition-all bg-slate-50 focus:bg-white"
             placeholder="Ex:&#10;AFASTADOR GELPI LOKTITE 18CM  2&#10;AFASTADOR HAYS 5MMX16CM  2&#10;AFASTADOR SEMM MUELLER 16CM AGUDO  4..."
             value={queryInput}
             onChange={(e) => setQueryInput(e.target.value)}
          />
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
             <span className="text-xs text-slate-400 font-medium">Suporta até 2.000 itens por cotação</span>
             <button 
                onClick={handleSearch} 
                disabled={isSearching || !queryInput.trim()}
                className="bg-[#1E5FCD] text-white px-8 py-2.5 rounded-lg font-bold text-sm hover:bg-[#15469e] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-900/10"
             >
               {isSearching ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   Processando...
                 </>
               ) : (
                 <>
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                   Gerar cotação
                 </>
               )}
             </button>
          </div>
        </div>

        {/* Results Card */}
        {bulkResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             {/* Results Header */}
             <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white no-print">
               <div>
                 <h2 className="text-xl font-bold text-slate-900">Resultado da Cotação</h2>
                 <p className="text-xs text-slate-500 mt-1 font-medium">{Object.keys(quotationState).length} selecionados de {bulkResults.length} • Clique em uma linha para ver alternativas</p>
               </div>
               <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                 <select 
                   value={selectedSupplierFilter}
                   onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                   className="flex-grow lg:flex-grow-0 border border-slate-300 rounded-lg text-xs font-bold py-2.5 px-3 text-slate-700 outline-none focus:border-[#1E5FCD] bg-white cursor-pointer"
                 >
                   <option>Todos os fornecedores</option>
                   {availableSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 
                 <button 
                  onClick={handleExportCSV}
                  className="border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
                 >
                   <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                   CSV
                 </button>
                 <button onClick={() => window.print()} className="border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
                   <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5v1.5H19v2h-1.5V7h2V7zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                   PDF
                 </button>
               </div>
             </div>

             {/* Table */}
             <div className="overflow-x-auto">
               <table className="min-w-full text-left border-collapse">
                 <thead className="bg-[#F8FAFC]">
                   <tr>
                      <th className="py-4 px-4 w-12 text-center"><div className="w-4 h-4 bg-[#1E5FCD] rounded flex items-center justify-center mx-auto"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div></th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Digitado</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Código</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">Descrição Encontrada</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                      <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Qtd</th>
                      <th className="py-4 px-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valor Unit.</th>
                      <th className="py-4 px-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valor Total</th>
                      <th className="py-4 px-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Status</th>
                      <th className="py-4 px-2 w-8 no-print"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {filteredResults.map((result, idx) => {
                     const selectedIds = Object.keys(quotationState[idx] || {});
                     // Default to first match if no selection, but check if any match exists
                     const activeId = selectedIds[0] || (result.products.length > 0 ? result.products[0].id : null);
                     const p = activeId ? result.products.find(prod => prod.id === activeId) : null;
                     const qty = activeId ? (quotationState[idx]?.[activeId] || result.detectedQuantity) : result.detectedQuantity;
                     
                     const isExact = p && normalizeText(result.term) === normalizeText(p.title);
                     const isExpanded = expandedRows.includes(idx);
                     const hasMatches = result.products.length > 0;

                     return (
                       <React.Fragment key={idx}>
                         <tr 
                           className={`group transition-colors ${!p ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}
                           onClick={() => {
                             if (hasMatches) setExpandedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
                           }}
                         >
                            <td className="py-4 px-4 text-center">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center mx-auto transition-colors ${p ? 'bg-[#1E5FCD] border-[#1E5FCD]' : 'bg-slate-100 border-slate-300'}`}>
                                {p && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                               <p className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{result.term}</p>
                            </td>
                            <td className="py-4 px-4">
                               <p className="text-[11px] font-mono text-slate-500">{p?.code || '-'}</p>
                            </td>
                            <td className="py-4 px-4">
                               {p ? (
                                 <p className="text-[11px] font-bold text-slate-800">{p.title}</p>
                               ) : (
                                 <p className="text-[11px] font-bold text-red-400 italic">Produto não encontrado</p>
                               )}
                            </td>
                            <td className="py-4 px-4">
                               <p className="text-[11px] text-slate-600 truncate max-w-[120px]">{p?.supplier || '-'}</p>
                            </td>
                            <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                               <input 
                                 type="number" 
                                 min="1"
                                 value={qty}
                                 disabled={!p}
                                 onChange={(e) => p && handleQuantityChange(idx, p.id, parseInt(e.target.value) || 1)}
                                 className="w-16 py-1.5 px-1 text-center border border-slate-200 rounded text-xs font-bold text-slate-700 focus:border-[#1E5FCD] outline-none disabled:bg-slate-50 bg-white"
                               />
                            </td>
                            <td className="py-4 px-4 text-right">
                               <p className="text-[11px] text-slate-600 font-medium whitespace-nowrap">{p ? currencyFormatter.format(p.price || 0) : '-'}</p>
                            </td>
                            <td className="py-4 px-4 text-right">
                               <p className="text-[11px] text-slate-900 font-bold whitespace-nowrap">{p ? currencyFormatter.format((p.price || 0) * qty) : '-'}</p>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {hasMatches ? (
                                <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isExact ? 'bg-green-100 text-green-700' : 'bg-[#FFF8E1] text-[#B7791F]'}`}>
                                  {isExact ? 'Exato' : 'Similar'}
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                                  Não Enc.
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-2 no-print text-center">
                               {hasMatches && (
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                               )}
                            </td>
                         </tr>
                         {isExpanded && (
                            <tr className="bg-[#F8FAFC] no-print border-b border-slate-200">
                              <td colSpan={10} className="p-4 pl-16">
                                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Alternativas para "{result.term}"</p>
                                  <ProductTable 
                                    products={result.products} 
                                    termIndex={idx} 
                                    selectedItems={quotationState[idx] || {}} 
                                    onToggleSelect={(tIdx, pId) => {
                                      // Logic to ensure only one is selected if needed, or allow multiple
                                      // Here we switch selection to the clicked one for the main view
                                      setQuotationState(prev => ({ ...prev, [tIdx]: { [pId]: result.detectedQuantity || 1 } }));
                                    }} 
                                    onQuantityChange={handleQuantityChange} 
                                  />
                                </div>
                              </td>
                            </tr>
                         )}
                       </React.Fragment>
                     );
                   })}
                 </tbody>
                 {/* Total Footer */}
                 <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={7} className="py-4 px-4 text-right text-xs font-black text-slate-500 uppercase tracking-wider">Total da Cotação</td>
                      <td className="py-4 px-4 text-right text-sm font-black text-[#1E5FCD] whitespace-nowrap">{currencyFormatter.format(grandTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                 </tfoot>
               </table>
             </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-lg p-4 border border-slate-100 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
           <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
             <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
           </div>
           <div>
             <p className="text-xs font-bold text-slate-800">Cotação gerada com sucesso</p>
             <p className="text-[11px] text-slate-500 font-medium mt-0.5">{toastStats.exact} exatos, {toastStats.similar} similares, {toastStats.notFound} não encontrados.</p>
           </div>
           <button onClick={() => setShowToast(false)} className="text-slate-400 hover:text-slate-600">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
