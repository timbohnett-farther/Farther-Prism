import { useState } from 'react';
import { Upload, Plus, Trash2, FileText, Edit3 } from 'lucide-react';

export default function PortfolioBuilder({ data, onUpdate, onNext, onPrev }) {
  const [mode, setMode] = useState('upload'); // 'upload' or 'manual'
  const [holdings, setHoldings] = useState(data.portfolio || []);
  const [newHolding, setNewHolding] = useState({
    ticker: '',
    name: '',
    shares: '',
    price: '',
  });
  const [csvData, setCsvData] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n');
    const headers = lines[0].toLowerCase().split(',');
    const parsed = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const holding = {
        ticker: values[headers.indexOf('ticker')] || values[headers.indexOf('symbol')] || '',
        name: values[headers.indexOf('name')] || values[headers.indexOf('description')] || '',
        shares: parseFloat(values[headers.indexOf('shares')] || values[headers.indexOf('quantity')] || 0),
        price: parseFloat(values[headers.indexOf('price')] || values[headers.indexOf('current price')] || 0),
      };
      
      if (holding.ticker) {
        holding.value = holding.shares * holding.price;
        parsed.push(holding);
      }
    }

    setHoldings(parsed);
    setCsvData(text);
  };

  const addHolding = () => {
    if (newHolding.ticker && newHolding.shares && newHolding.price) {
      const value = parseFloat(newHolding.shares) * parseFloat(newHolding.price);
      setHoldings([...holdings, { ...newHolding, value }]);
      setNewHolding({ ticker: '', name: '', shares: '', price: '' });
    }
  };

  const removeHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const totalValue = holdings.reduce((sum, h) => sum + (h.value || 0), 0);

  const handleContinue = () => {
    if (holdings.length === 0) {
      alert('Please add at least one holding to continue');
      return;
    }
    onUpdate('portfolio', holdings);
    onNext();
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Build Portfolio</h2>
        <p className="text-slate-600">Upload a CSV file or manually enter portfolio holdings.</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
            mode === 'upload'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Upload className="inline w-5 h-5 mr-2" />
          Upload CSV
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
            mode === 'manual'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Edit3 className="inline w-5 h-5 mr-2" />
          Manual Entry
        </button>
      </div>

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div className="mb-8">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <FileText className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <p className="text-lg font-medium text-slate-700 mb-2">
                Drop CSV file here or click to browse
              </p>
              <p className="text-sm text-slate-500">
                Expected columns: Ticker, Name, Shares, Price
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Manual Entry Mode */}
      {mode === 'manual' && (
        <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">Add Holding</h3>
          <div className="grid grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Ticker"
              value={newHolding.ticker}
              onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value.toUpperCase() })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Name"
              value={newHolding.name}
              onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 col-span-2"
            />
            <input
              type="number"
              placeholder="Shares"
              value={newHolding.shares}
              onChange={(e) => setNewHolding({ ...newHolding, shares: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Price"
              value={newHolding.price}
              onChange={(e) => setNewHolding({ ...newHolding, price: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={addHolding}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="inline w-4 h-4 mr-2" />
            Add to Portfolio
          </button>
        </div>
      )}

      {/* Holdings Table */}
      {holdings.length > 0 && (
        <div className="mb-8">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Ticker</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Shares</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Value</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">%</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {holdings.map((holding, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{holding.ticker}</td>
                    <td className="px-6 py-4 text-slate-600">{holding.name || '-'}</td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {parseFloat(holding.shares).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      ${parseFloat(holding.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      ${(holding.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {((holding.value / totalValue) * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => removeHolding(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan="4" className="px-6 py-4 font-bold text-slate-900">Total Portfolio Value</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-slate-200">
        <button
          onClick={onPrev}
          className="px-8 py-3 border-2 border-farther-slate text-farther-charcoal font-semibold rounded-lg hover:bg-gray-50 transition-all"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={holdings.length === 0}
          className="px-8 py-3 bg-farther-teal text-white font-semibold rounded-lg hover:bg-farther-teal/90 transition-all shadow-md hover:shadow-xl disabled:bg-farther-slate disabled:cursor-not-allowed focus:ring-2 focus:ring-farther-teal"
        >
          Continue to Risk Assessment →
        </button>
      </div>
    </div>
  );
}
