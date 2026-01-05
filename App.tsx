import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, FileDown, Database, Save, Moon, Coffee, Upload, Settings, Search, User, Briefcase, Calendar, Lock, Unlock, Cloud, CheckCircle2, XCircle, Edit3, Eraser } from 'lucide-react';
import { Employee, BillItem, BillType } from './types';
import { generateBillPDF } from './services/pdfService';
import { INITIAL_DB } from './database';

const App: React.FC = () => {
  // -- State --
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('tusuka_employees');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 0 && INITIAL_DB.length > 0) {
            return INITIAL_DB;
        }
        return parsed;
      }
      return INITIAL_DB;
    } catch (e) {
      console.error("Failed to load database", e);
      return INITIAL_DB;
    }
  });

  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [billType, setBillType] = useState<BillType>(BillType.TIFFIN);
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [securityInput, setSecurityInput] = useState('');
  const [serverDBStatus, setServerDBStatus] = useState<'loading' | 'connected' | 'not-found'>('loading');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [nightSoRate, setNightSoRate] = useState<number>(350);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    cardNo: '',
    designation: 'S/O',
    customDesignation: '',
    remarks: ''
  });

  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // -- Helper Logic --
  const calculateRate = (type: BillType, designation: string, currentNightRate: number) => {
    if (type === BillType.TIFFIN) return 50;
    if (type === BillType.DAILY_LABOUR) return 600;
    if (type === BillType.HOLIDAY) {
      if (designation === 'LABOUR') return 600;
      return 800;
    }
    if (type === BillType.NIGHT_ENTERTAINMENT) {
      if (designation === 'LABOUR') return 150;
      return currentNightRate;
    }
    return 0;
  };

  // Effect to set default rank based on Bill Type
  useEffect(() => {
    if (billType === BillType.DAILY_LABOUR) {
      setFormData(prev => ({ ...prev, designation: 'LABOUR', customDesignation: '' }));
    } else {
      setFormData(prev => ({ ...prev, designation: 'S/O', customDesignation: '' }));
    }
  }, [billType]);

  // 1. Load Server CSV
  useEffect(() => {
    const fetchServerCSV = async () => {
      try {
        const response = await fetch('/database.csv');
        if (response.ok) {
           const text = await response.text();
           const lines = text.split('\n');
           const csvEmployees: Employee[] = [];
           for (let i = 0; i < lines.length; i++) {
             const line = lines[i].trim();
             if (!line) continue;
             const cols = line.split(',');
             if (cols.length < 3) continue;
             if (i === 0 && cols[0].toLowerCase().includes('name')) continue;
             csvEmployees.push({
               id: `server-${Math.random().toString(36).substr(2, 9)}`,
               name: cols[0].trim(),
               cardNo: cols[1].trim(),
               designation: cols[2].trim(),
               defaultTaka: cols[3] ? Number(cols[3]) : 0
             });
           }
           if (csvEmployees.length > 0) {
              setServerDBStatus('connected');
              setEmployees(prev => {
                  const map = new Map<string, Employee>();
                  csvEmployees.forEach(e => map.set(e.cardNo, e));
                  prev.forEach(e => { if (!map.has(e.cardNo)) map.set(e.cardNo, e); });
                  return Array.from(map.values());
              });
           } else {
             setServerDBStatus('not-found');
           }
        } else {
          setServerDBStatus('not-found');
        }
      } catch (e) {
        setServerDBStatus('not-found');
      }
    };
    fetchServerCSV();
  }, []);

  useEffect(() => {
    localStorage.setItem('tusuka_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    setBillItems(prevItems => prevItems.map(item => ({
      ...item,
      taka: calculateRate(billType, item.designation, nightSoRate)
    })));
  }, [billType, nightSoRate]);

  const activeDesignation = formData.designation === 'OTHER' ? formData.customDesignation : formData.designation;

  const currentTaka = useMemo(() => {
    return calculateRate(billType, activeDesignation, nightSoRate);
  }, [billType, activeDesignation, nightSoRate]);
  
  const isUnlocked = securityInput === 'Fabric2038';

  const themeColor = useMemo(() => {
    switch (billType) {
      case BillType.TIFFIN: return "indigo";
      case BillType.NIGHT_ENTERTAINMENT: return "violet";
      case BillType.HOLIDAY: return "rose";
      case BillType.DAILY_LABOUR: return "emerald";
      default: return "slate";
    }
  }, [billType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let nextFormData = { ...formData, [name]: value };
    
    if (name === 'cardNo') {
        const found = employees.find(emp => emp.cardNo === value.trim());
        if (found) {
            nextFormData.name = found.name;
            const standardRanks = ['S/O', 'LABOUR', 'STORE ASSISTANT'];
            if (standardRanks.includes(found.designation)) {
                nextFormData.designation = found.designation;
            } else {
                nextFormData.designation = 'OTHER';
                nextFormData.customDesignation = found.designation;
            }
        }
    }
    setFormData(nextFormData);

    if (name === 'name' || name === 'cardNo') {
      if (value.length > 0) {
        const lowerVal = value.toLowerCase();
        const filtered = employees.filter(emp => 
          emp.name.toLowerCase().includes(lowerVal) || 
          emp.cardNo.includes(lowerVal)
        );
        setSuggestions(filtered.slice(0, 10));
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  const selectEmployee = (emp: Employee) => {
    const standardRanks = ['S/O', 'LABOUR', 'STORE ASSISTANT'];
    setFormData({
      name: emp.name,
      cardNo: emp.cardNo,
      designation: standardRanks.includes(emp.designation) ? emp.designation : 'OTHER',
      customDesignation: standardRanks.includes(emp.designation) ? '' : emp.designation,
      remarks: ''
    });
    setShowSuggestions(false);
  };

  const addEntry = () => {
    if (!formData.name || !formData.cardNo) return;
    const finalRank = formData.designation === 'OTHER' ? (formData.customDesignation || 'OTHER') : formData.designation;

    const newItem: BillItem = {
      id: Date.now().toString() + Math.random(),
      name: formData.name.trim(),
      cardNo: formData.cardNo.trim(),
      designation: finalRank,
      taka: currentTaka,
      remarks: formData.remarks
    };
    
    // Items appear in the exact order they are added
    setBillItems(prev => [...prev, newItem]);

    // Update database
    const existingIndex = employees.findIndex(e => e.cardNo.trim() === formData.cardNo.trim());
    if (existingIndex === -1) {
      setEmployees(prev => [...prev, {
        id: Date.now().toString(),
        name: formData.name.trim(),
        cardNo: formData.cardNo.trim(),
        designation: finalRank,
        defaultTaka: currentTaka
      }]);
    }

    // Reset form but keep default designation logic
    const defaultRank = billType === BillType.DAILY_LABOUR ? 'LABOUR' : 'S/O';
    setFormData({ name: '', cardNo: '', designation: defaultRank, customDesignation: '', remarks: '' });
    setShowSuggestions(false);
    nameInputRef.current?.focus();
  };

  const updateItemField = (id: string, field: 'taka' | 'cardNo', value: string) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: field === 'taka' ? (value === '' ? 0 : Number(value)) : value };
      }
      return item;
    }));
  };

  const clearDatabase = () => {
    if (window.confirm("Are you sure you want to delete all saved employee profiles? This action cannot be undone.")) {
      setEmployees([]);
      localStorage.removeItem('tusuka_employees');
      alert("Database cleared successfully.");
    }
  };

  const exportDatabase = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,CardNo,Designation,DefaultTaka\n"
      + employees.map(e => `${e.name},${e.cardNo},${e.designation},${e.defaultTaka}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `database_backup.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const importDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const newEmployees: Employee[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length >= 3) {
          newEmployees.push({
            id: Date.now().toString() + Math.random().toString().slice(2),
            name: cols[0].trim(),
            cardNo: cols[1].trim(),
            designation: cols[2].trim(),
            defaultTaka: cols[3] ? Number(cols[3]) : 0
          });
        }
      }

      const mergedMap = new Map<string, Employee>();
      employees.forEach(e => mergedMap.set(e.cardNo, e));
      newEmployees.forEach(e => mergedMap.set(e.cardNo, e));
      
      setEmployees(Array.from(mergedMap.values()));
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert(`Database updated! Total profiles: ${mergedMap.size}`);
    };
    reader.readAsText(file);
  };

  const handleGeneratePDF = async () => {
    if (billItems.length === 0) return alert("Please add at least one entry.");
    const dateObj = new Date(billDate);
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getFullYear()).slice(-2)}`;
    await generateBillPDF(billType, formattedDate, billItems);
  };

  const totalTaka = useMemo(() => billItems.reduce((acc, curr) => acc + curr.taka, 0), [billItems]);

  return (
    <div className={`min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-10`}>
      {/* Navbar */}
      <div className={`bg-white border-b border-${themeColor}-100 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-95`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 bg-${themeColor}-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-${themeColor}-200`}>
                    <FileDown size={16} strokeWidth={3} />
                </div>
                <div>
                    <h1 className="text-base font-black uppercase tracking-tight text-gray-800 leading-none">Daily Bill Generator</h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Accurate • Efficient • Reliable</p>
                </div>
            </div>
            <div className={`flex items-center gap-3`}>
                 <div className="hidden md:flex items-center gap-4 border-r border-gray-100 pr-4 mr-2 text-right">
                    <div className="group">
                         <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Bill Date</label>
                         <input type="date" className={`bg-transparent text-right font-bold text-gray-700 outline-none text-xs w-full`} value={billDate} onChange={(e) => setBillDate(e.target.value)} />
                    </div>
                    <div className="relative group">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Bill Type</label>
                        <select className={`appearance-none bg-transparent pr-4 text-right font-black text-${themeColor}-600 uppercase text-sm outline-none`} value={billType} onChange={(e) => setBillType(e.target.value as BillType)}>
                            {Object.values(BillType).map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                </div>
                <div className="text-right hidden sm:block">
                   <p className="text-[9px] uppercase font-bold text-gray-400">Total Payable</p>
                   <p className={`text-xl font-black text-${themeColor}-600 leading-none`}>{totalTaka}<span className="text-[10px] text-gray-400 ml-1">Tk</span></p>
                </div>
                <button onClick={handleGeneratePDF} className={`bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-${themeColor}-200/50 active:scale-95`}>
                  <Save size={16} /> <span className="hidden sm:inline">Download PDF</span>
                </button>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch lg:h-[calc(100vh-100px)]">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden shrink-0">
             <div className={`h-1 w-full bg-gradient-to-r from-${themeColor}-400 to-${themeColor}-600`}></div>
             <div className="p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    {serverDBStatus === 'connected' && (
                        <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> {employees.length} Records Loaded
                        </div>
                    )}
                    <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-50 text-gray-500 hover:text-gray-700">
                        <Settings size={12} /> <span className="text-[10px] font-bold">Settings</span>
                    </button>
                </div>
                
                {showSettings && (
                    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg animate-in slide-in-from-top-2">
                        {!isUnlocked ? (
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Lock size={10} /> Enter Security Key</label>
                                <input type="password" placeholder="Key..." className="w-full px-3 py-1.5 text-xs border rounded outline-none" value={securityInput} onChange={(e) => setSecurityInput(e.target.value)} />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={exportDatabase} className="flex items-center justify-center gap-1.5 bg-white border border-slate-300 py-1.5 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-100"><Database size={10} /> Export</button>
                                    <button onClick={handleImportClick} className="flex items-center justify-center gap-1.5 bg-white border border-slate-300 py-1.5 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-100"><Upload size={10} /> Import</button>
                                </div>
                                <button onClick={clearDatabase} className="w-full flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 py-2 rounded text-[10px] font-bold text-red-600 hover:bg-red-100 transition-colors">
                                    <Eraser size={12} /> Clear All Records
                                </button>
                                <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={importDatabase} />
                            </div>
                        )}
                    </div>
                )}
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-100 flex-1 flex flex-col">
            <div className="p-6 flex flex-col h-full overflow-y-auto">
                <h2 className="text-sm font-bold text-gray-800 uppercase mb-6 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded bg-${themeColor}-100 text-${themeColor}-600 flex items-center justify-center`}><Plus size={14} /></div>
                  New Entry
                </h2>

                <div className="flex flex-col gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 uppercase">Employee Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                            <input ref={nameInputRef} name="name" type="text" autoComplete="off" className={`w-full pl-12 pr-4 py-3 text-base border border-gray-200 rounded-lg outline-none focus:border-${themeColor}-500 font-bold text-gray-800`} placeholder="Enter Name..." value={formData.name} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && addEntry()} />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 z-20 w-full bg-white border border-gray-100 shadow-xl rounded-xl mt-1 overflow-hidden">
                                    {suggestions.map(emp => (
                                        <div key={emp.id} className={`px-4 py-2 hover:bg-${themeColor}-50 cursor-pointer border-b border-gray-50 last:border-0`} onClick={() => selectEmployee(emp)}>
                                            <div className="flex justify-between items-center"><span className="font-bold text-gray-700 text-sm">{emp.name}</span><span className="text-[10px] bg-gray-100 px-1.5 rounded text-gray-500">{emp.cardNo}</span></div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">{emp.designation}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase">Card No</label>
                            <div className="relative">
                                <div className="absolute left-4 top-3.5 text-gray-400 font-bold">#</div>
                                <input name="cardNo" type="text" className={`w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg outline-none focus:border-${themeColor}-500 font-bold text-gray-700`} placeholder="000" value={formData.cardNo} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && addEntry()} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase">Rank</label>
                            <select name="designation" className={`w-full px-4 py-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-${themeColor}-500 font-bold text-gray-700 bg-white`} value={formData.designation} onChange={handleInputChange}>
                                <option value="S/O">S/O</option>
                                <option value="LABOUR">LABOUR</option>
                                <option value="STORE ASSISTANT">STORE ASSISTANT</option>
                                <option value="OTHER">OTHER (NEW RANK)</option>
                            </select>
                        </div>
                    </div>

                    {formData.designation === 'OTHER' && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Edit3 size={12}/> Input Custom Rank</label>
                             <input name="customDesignation" type="text" className={`w-full px-4 py-3 text-sm border border-orange-200 bg-orange-50/30 rounded-lg outline-none focus:border-orange-400 font-bold text-gray-700`} placeholder="Type rank here..." value={formData.customDesignation} onChange={handleInputChange} />
                        </div>
                    )}

                    {billType === BillType.NIGHT_ENTERTAINMENT && activeDesignation === 'S/O' && (
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Overtime Rate</span>
                            <div className="flex gap-3">
                                {[350, 250].map((rate) => (
                                    <label key={rate} className={`flex-1 cursor-pointer border ${nightSoRate === rate ? 'border-orange-500 bg-orange-100 text-orange-700 shadow-sm' : 'border-orange-200 bg-white text-gray-500'} rounded-lg py-2 text-center font-bold text-sm`}>
                                        <input type="radio" className="hidden" checked={nightSoRate === rate} onChange={() => setNightSoRate(rate)} /> {rate} Tk
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-4">
                        <button onClick={addEntry} className={`w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold text-sm shadow-lg active:scale-95 flex items-center justify-center gap-2`}><Plus size={18} /> Add to List</button>
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 bg-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-4 bg-${themeColor}-500 rounded-full`}></div>
                        <h3 className="font-bold text-gray-800 text-sm">Bill Items</h3>
                        <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{billItems.length}</span>
                    </div>
                    {billItems.length > 0 && (
                        <button onClick={() => setBillItems([])} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"><Trash2 size={12} /> Clear All</button>
                    )}
                </div>

                <div className="flex-1 overflow-auto bg-gray-50/30">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase w-10 text-center">SL</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase">Employee Name</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase">Card No</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase">Designation</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase text-right">Amount</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase text-center w-12">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {billItems.length === 0 ? (
                                <tr><td colSpan={6} className="py-20 text-center text-gray-300"><p className="text-xs font-medium">List is empty. Add entries from the left.</p></td></tr>
                            ) : (
                                billItems.map((item, idx) => (
                                    <tr key={item.id} className="group hover:bg-white bg-white/50 transition-colors">
                                        <td className="px-3 py-1.5 text-center text-[10px] font-mono text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="px-3 py-1.5 font-bold text-gray-700 text-xs">{item.name}</td>
                                        <td className="px-3 py-1.5">
                                            <input type="text" className="w-16 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 outline-none text-[10px] font-mono font-bold text-gray-600 px-1 transition-all" value={item.cardNo} onChange={(e) => updateItemField(item.id, 'cardNo', e.target.value)} />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-${themeColor}-50 text-${themeColor}-600`}>{item.designation}</span>
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            <input type="number" min="0" className={`w-16 text-right font-bold text-gray-700 text-xs bg-transparent border-b border-dashed border-gray-300 focus:border-solid focus:border-${themeColor}-500 outline-none py-0.5`} value={item.taka} onChange={(e) => updateItemField(item.id, 'taka', e.target.value)} onFocus={(e) => e.target.select()} />
                                        </td>
                                        <td className="px-3 py-1.5 text-center">
                                            <button onClick={() => setBillItems(billItems.filter(bi => bi.id !== item.id))} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 transition-all"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white border-t border-gray-100 p-3">
                    <div className="flex justify-end items-center gap-4">
                        <div className="text-right"><p className="text-[9px] text-gray-400 font-bold uppercase">Count</p><p className="text-xs font-bold text-gray-700">{billItems.length}</p></div>
                        <div className={`h-6 w-px bg-gray-200`}></div>
                        <div className="text-right"><p className="text-[9px] text-gray-400 font-bold uppercase">Total Amount</p><p className={`text-lg font-black text-${themeColor}-600`}>{totalTaka} <span className="text-[10px] text-gray-400">Tk</span></p></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;