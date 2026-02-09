
import { Product, MappedProduct } from '../types';

export const SHEET_ID = '1Qo1g6s8NZv9Q-GjXBSz2gpH0VQnWKN1GHfJaO8MOe3A';
export const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const fetchAndParseProducts = async (): Promise<MappedProduct[]> => {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`Sheet unreachable: ${response.statusText}`);
    
    const text = await response.text();
    if (text.trim().startsWith('<!DOCTYPE html>')) {
      throw new Error("A planilha não está pública ou o link expirou.");
    }

    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    return lines.slice(1).map((line, index) => {
      const values = parseCSVLine(line);
      const rawObj: Record<string, string> = {};
      headers.forEach((header, i) => { rawObj[header] = values[i] || ''; });

      const findField = (keywords: string[]): string => {
        // Try exact match first
        let key = headers.find(h => keywords.some(k => h === k));
        // Then try contains
        if (!key) key = headers.find(h => keywords.some(k => h.includes(k)));
        return key ? rawObj[key] : '';
      };

      const title = findField(['nome', 'name', 'produto', 'title', 'item', 'descricao', 'descrição']) || values[0] || 'Produto sem nome';
      const code = findField(['codigo', 'código', 'code', 'id', 'ref', 'referencia', 'referência']) || `REF-${index}`;
      const priceStr = findField(['preco', 'preço', 'price', 'valor', 'cost', 'unitario', 'venda', 'preço venda']) || '0';
      const brand = findField(['marca', 'brand', 'fabricante', 'lab', 'laboratorio', 'mrc']) || 'Marca não informada';
      const supplier = findField(['fornecedor', 'supplier', 'distribuidor', 'vendedor', 'empresa', 'origem', 'loja']) || 'Fornecedor Direto';

      const priceClean = parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', '.'));

      return {
        id: `prod-${index}-${Date.now()}`,
        _raw: rawObj,
        title: title.trim(),
        code: code.trim(),
        price: isNaN(priceClean) ? 0 : priceClean,
        image: `https://picsum.photos/400/300?random=${index}`,
        category: findField(['categoria', 'tipo', 'grupo']) || 'Geral',
        description: findField(['detalhes', 'descricao', 'obs']) || '',
        brand: brand.trim(),
        supplier: supplier.trim()
      };
    });
  } catch (error) {
    console.error("CSV Fetch Error:", error);
    return [];
  }
};
