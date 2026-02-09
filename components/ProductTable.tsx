
import React from 'react';
import { MappedProduct } from '../types';

interface ProductTableProps {
  products: MappedProduct[];
  termIndex: number;
  selectedItems: Record<string, number>;
  onToggleSelect: (termIndex: number, productId: string) => void;
  onQuantityChange: (termIndex: number, productId: string, quantity: number) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, termIndex, selectedItems, onToggleSelect, onQuantityChange }) => {
  const currencyFormatter = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 w-8"></th>
            <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider">Produto</th>
            <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider">Código</th>
            <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fornecedor</th>
            <th className="px-3 py-2 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider">Valor Unit.</th>
            <th className="px-3 py-2 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">Qtd</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {products.map((product) => {
            const isSelected = selectedItems[product.id] !== undefined;
            return (
              <tr key={product.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                <td className="px-3 py-3 text-center">
                  <div 
                    onClick={() => onToggleSelect(termIndex, product.id)}
                    className={`w-3.5 h-3.5 rounded border cursor-pointer flex items-center justify-center transition-colors ${isSelected ? 'bg-[#1E5FCD] border-[#1E5FCD]' : 'bg-white border-slate-300'}`}
                  >
                     {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-[11px] font-bold text-slate-700">{product.title}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-[11px] font-mono text-slate-500">{product.code}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-[11px] text-slate-600">{product.supplier}</p>
                </td>
                <td className="px-3 py-3 text-right">
                  <p className="text-[11px] font-medium text-slate-700">{currencyFormatter(product.price || 0)}</p>
                </td>
                <td className="px-3 py-3 text-center">
                  <input
                    type="number"
                    min="1"
                    disabled={!isSelected}
                    value={isSelected ? selectedItems[product.id] : ''}
                    onChange={(e) => onQuantityChange(termIndex, product.id, parseInt(e.target.value) || 1)}
                    className="w-12 py-1 px-1 text-center border border-slate-200 rounded text-[10px] font-bold text-slate-700 focus:border-[#1E5FCD] outline-none disabled:bg-slate-50 disabled:opacity-50 bg-white"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;
