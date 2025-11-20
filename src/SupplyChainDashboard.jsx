import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine, ComposedChart
} from 'recharts';
import {
    Upload, Filter, Package, Calendar, ChevronDown, Search, Clock, ToggleLeft, ToggleRight, AlertTriangle, X, Table, SlidersHorizontal, ArrowUpDown, CheckSquare, Square, Activity, Layers, Factory, Network, FileSpreadsheet, ArrowRight, Warehouse, Box, ArrowLeftRight, MapPin, RefreshCw, RotateCcw, PanelLeft
} from 'lucide-react';

// --- CONFIGURATION ---
const GOOGLE_SHEET_CONFIG = {
    INVENTORY_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSe_LVLpnR6g1hDB3e9iulTyW6H-GZaDr0RbmOf0_ePIFcS8XnKFngsdZHKy_i4YSLpdLe6BMPAO9Av/pub?gid=1666488360&single=true&output=csv", 
    BOM_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwON2WzEI596aLH7oCBzoawdIL1TufE-Ta8GWpsj_D3xQOVggZMsFEl_l4pFzeFmvLPAbyS2AWSghV/pub?gid=106702660&single=true&output=csv"        
};

const PLANT_ORGS = ['THRYPM', 'MYBGPM'];
const DC_ORGS = ['THBNDM', 'VNHCDM', 'VNHNDM', 'IDCKDM', 'PHPSDM'];

// --- Helper for CSV Parsing ---
const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                let value = currentLine[index].trim().replace(/^"|"$/g, '');
                if (!isNaN(value) && value !== '' && (header === 'Value' || header.includes('Qty') || header.includes('Ratio') || header.includes('Quantity'))) {
                    value = parseFloat(value);
                }
                row[header] = value;
            });
            if (row.Date) {
                row._dateObj = new Date(row.Date);
            }
            if (row.Metric) {
                row.Metric = row.Metric.trim();
            }
            data.push(row);
        }
    }
    return data;
};

const toInputDate = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toISOString().split('T')[0];
};

const addWeeks = (date, weeks) => {
    const result = new Date(date);
    result.setDate(result.getDate() + (weeks * 7));
    return result;
};

const getLeadTimeWeeks = (invOrg) => {
    if (invOrg === 'IDCKDM') return 6;
    if (invOrg === 'VNHCDM' || invOrg === 'VNHNDM') return 7;
    if (invOrg === 'THBNDM' || invOrg === 'MYBGPM') return 5;
    return 4;
};

// --- Sample Data ---
const SAMPLE_CSV = `Factory,Type,Item Code,Inv Org,Item Class,UOM,Strategy,Original Item String,Metric,Start,Date,Value
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/19/2025,9910.16
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/19/2025,5000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Target Inv.,0,11/19/2025,4000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/20/2025,500.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/20/2025,400.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Target Inv.,0,11/20/2025,4000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/21/2025,0
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/21/2025,-400.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Target Inv.,0,11/21/2025,4000.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Inventory (Forecast),0,11/19/2025,2500.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Target Inv.,0,11/19/2025,3000.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Inventory (Forecast),0,11/20/2025,2400.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Target Inv.,0,11/20/2025,3000.00`;

const DEFAULT_BOM = [
    { parent: 'AAG620-MR2', child: 'BAB250-MR1', ratio: 0.5, plant: 'MYBGPM' }, 
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-100 text-sm">
                <p className="font-semibold text-slate-800 mb-2">{new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <div className="space-y-1">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="text-slate-500 text-xs">{entry.name}</span>
                            </div>
                            <span className="font-mono font-medium text-slate-700">
                                {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const SearchableSelect = ({ label, value, options, onChange, multi = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef(null);

    const filteredOptions = useMemo(() => {
        return options.filter(opt =>
            opt.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleMultiSelect = (opt) => {
        let newValue;
        if (opt === 'All') {
            newValue = ['All'];
        } else {
            let current = value.includes('All') ? [] : [...value];
            if (current.includes(opt)) {
                current = current.filter(item => item !== opt);
            } else {
                current.push(opt);
            }
            newValue = current.length === 0 ? ['All'] : current;
        }
        onChange(newValue);
    };

    const getDisplayText = () => {
        if (multi) {
            if (value.includes('All')) return 'All';
            if (value.length === 1) return value[0];
            return `${value.length} selected`;
        }
        return value || 'All';
    };

    return (
        <div className="relative group" ref={wrapperRef}>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{label}</label>
            <button
                className={`w-full bg-white rounded-lg border px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-all duration-200 ease-in-out
                    ${isOpen ? 'border-indigo-500 ring-1 ring-indigo-100 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
                onClick={() => {
                    if (!isOpen) setSearchTerm("");
                    setIsOpen(!isOpen);
                }}
            >
                <span className={`truncate block max-w-[140px] text-left font-medium ${value === 'All' || (multi && value.includes('All')) ? 'text-slate-500' : 'text-slate-800'}`}>
                    {getDisplayText()}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 py-1 scrollbar-thin scrollbar-thumb-slate-200">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt}
                                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors
                                        ${value === opt || (multi && value.includes(opt)) 
                                            ? 'bg-indigo-50/80 text-indigo-700 font-medium' 
                                            : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}
                                    onClick={(e) => {
                                        if (multi) {
                                            e.stopPropagation();
                                            handleMultiSelect(opt);
                                        } else {
                                            onChange(opt);
                                            setIsOpen(false);
                                        }
                                    }}
                                >
                                    <span className="truncate">{opt}</span>
                                    {multi && (
                                        (value.includes(opt))
                                            ? <CheckSquare className="w-3 h-3 text-indigo-600" />
                                            : <Square className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center italic">No results</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Weekly Health Indicator ---
const WeeklyHealthIndicator = React.memo(({ data }) => {
    if (!data || data.length === 0) return <div className="text-[9px] text-slate-400 mt-1">No forecast data</div>;

    return (
        <div className="flex items-center gap-0.5 mt-1.5">
            {data.map((w, idx) => {
                let colorClass = 'bg-slate-200';
                if (w.pct >= 100) colorClass = 'bg-emerald-400';
                else if (w.pct > 0) colorClass = 'bg-amber-400';
                else colorClass = 'bg-red-400';
                
                return (
                    <div key={idx} className="group relative flex-1 h-1.5 first:rounded-l-sm last:rounded-r-sm bg-slate-100 overflow-hidden">
                        <div className={`h-full w-full ${colorClass}`} title={`Week ${w.week}: ${w.pct.toFixed(0)}% Target`}></div>
                    </div>
                );
            })}
        </div>
    );
});

// --- Node Card ---
const NodeCard = React.memo(({ node, onSelect, isActive, onOpenDetail }) => {
    const statusColors = {
        'Critical': 'border-red-200 bg-red-50/50 hover:border-red-300',
        'Low': 'border-amber-200 bg-amber-50/50 hover:border-amber-300',
        'Good': 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300',
        'Neutral': 'border-slate-200 bg-slate-50/50 hover:border-indigo-300'
    };
    
    return (
        <div 
            className={`relative flex flex-col p-2.5 rounded-xl border shadow-sm transition-all cursor-pointer group
                ${isActive ? 'ring-2 ring-indigo-500 border-transparent shadow-md bg-white z-10' : statusColors[node.status] || statusColors['Neutral']}`}
            onClick={onSelect}
        >
            <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded border ${isActive ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white/60 border-black/5 text-slate-500'}`}>
                        {node.type}
                    </span>
                    <div className="flex flex-col min-w-0">
                         <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]" title={node.id}>{node.id}</div>
                         <div className="flex items-center text-[10px] text-slate-400">
                             <MapPin className="w-2.5 h-2.5 mr-0.5" />
                             {node.invOrg}
                         </div>
                    </div>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(node); }}
                    className="p-1 rounded-md hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors z-10 relative"
                    title="View Details"
                >
                    <Table className="w-3 h-3" />
                </button>
            </div>
            
            <div className="flex items-baseline justify-between mt-1">
                <div className="text-[9px] text-slate-500 font-mono">Inv: {node.currentInv?.toLocaleString() || 0}</div>
                {node.status === 'Critical' && <AlertTriangle className="w-3 h-3 text-red-500" />}
            </div>

            <WeeklyHealthIndicator data={node.weeklyHealth} />
            {node.itemClass && <div className="text-[9px] text-slate-300 mt-1">{node.itemClass}</div>}
        </div>
    );
});

// --- Render Column Helper ---
const RenderColumn = React.memo(({ title, count, items, type, searchTerm, setSearchTerm, setSort, sortValue, isActiveCol, children }) => (
    <div className={`flex flex-col h-full border-r border-slate-200 bg-slate-50/30 ${isActiveCol ? 'bg-indigo-50/30' : ''} min-w-[280px] flex-1`}>
        <div className="p-3 border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    {type === 'RM' ? <Box className="w-3 h-3" /> : (type === 'FG' ? <Factory className="w-3 h-3" /> : <Warehouse className="w-3 h-3" />)}
                    {title} <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px]">{count}</span>
                </h3>
                <div className="flex gap-1">
                    <button onClick={() => setSort('alpha')} className={`p-1 rounded hover:bg-slate-100 ${sortValue === 'alpha' ? 'text-indigo-600' : 'text-slate-400'}`} title="Sort Alpha"><ArrowUpDown className="w-3 h-3" /></button>
                    <button onClick={() => setSort('invDesc')} className={`p-1 rounded hover:bg-slate-100 ${sortValue === 'invDesc' ? 'text-indigo-600' : 'text-slate-400'}`} title="Sort Inv"><Activity className="w-3 h-3" /></button>
                </div>
            </div>
            <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input 
                    type="text" 
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {children}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
            {items.length > 0 ? items.map(node => (
                <React.Fragment key={`${node.id}-${node.invOrg}`}>
                   {node.component} 
                </React.Fragment>
            )) : <div className="text-xs text-center text-slate-400 py-8 italic">No items found</div>}
        </div>
    </div>
));


// --- Supply Chain Network Map Component ---
const SupplyChainMap = ({ selectedItemFromParent, bomData, inventoryData, dateRange, onOpenDetails, onNodeSelect }) => {
    const [mapFocus, setMapFocus] = useState(null); 
    
    // List States
    const [searchTermRM, setSearchTermRM] = useState("");
    const [searchTermFG, setSearchTermFG] = useState("");
    const [searchTermDC, setSearchTermDC] = useState(""); 
    const [sortRM, setSortRM] = useState("alpha"); 
    const [sortFG, setSortFG] = useState("alpha");
    const [sortDC, setSortDC] = useState("alpha"); 

    // Filters
    const [rmClassFilter, setRmClassFilter] = useState('All');
    const [fgPlantFilter, setFgPlantFilter] = useState('All'); 
    const [dcFilter, setDcFilter] = useState('All'); 

    // Reset Internal Map State
    const handleReset = () => {
        setMapFocus(null);
        setSearchTermRM(""); setSearchTermFG(""); setSearchTermDC("");
        setRmClassFilter('All'); setFgPlantFilter('All'); setDcFilter('All');
        onNodeSelect(null); 
    };

    useEffect(() => {
        if (selectedItemFromParent) {
            let type = 'FG';
            if (PLANT_ORGS.includes(selectedItemFromParent.invOrg)) type = 'FG';
            else if (DC_ORGS.includes(selectedItemFromParent.invOrg)) type = 'DC';
            else type = 'RM'; 

            if (!mapFocus || mapFocus.id !== selectedItemFromParent.itemCode) {
                setMapFocus({ 
                    type: type,
                    id: selectedItemFromParent.itemCode, 
                    invOrg: selectedItemFromParent.invOrg 
                });
            }
        }
    }, [selectedItemFromParent, inventoryData]);

    // 1. Index Data
    const dataIndex = useMemo(() => {
        const idx = {}; // Key: "ItemCode|InvOrg"
        const rmKeys = new Set();
        const fgKeys = new Set();
        const dcKeys = new Set();

        inventoryData.forEach(row => {
            const key = `${row['Item Code']}|${row['Inv Org']}`;
            if (!idx[key]) idx[key] = [];
            idx[key].push(row);
            
            if (row.Type === 'RM') rmKeys.add(key);
            else if (row.Type === 'FG') {
                if (PLANT_ORGS.includes(row['Inv Org'])) fgKeys.add(key);
                else if (DC_ORGS.includes(row['Inv Org'])) dcKeys.add(key);
            }
        });
        return { index: idx, rmKeys: Array.from(rmKeys), fgKeys: Array.from(fgKeys), dcKeys: Array.from(dcKeys) };
    }, [inventoryData]);

    // 2. Index BOM
    const bomIndex = useMemo(() => {
        const p2c = {}; // Parent -> Children
        const c2p = {}; // Child -> Parents
        const parents = new Set();
        const children = new Set();
        
        bomData.forEach(b => {
            if (!p2c[b.parent]) p2c[b.parent] = new Set();
            p2c[b.parent].add(b.child);
            parents.add(b.parent);

            if (!c2p[b.child]) c2p[b.child] = new Set();
            c2p[b.child].add(b.parent);
            children.add(b.child);
        });
        return { p2c, c2p, parents, children };
    }, [bomData]);

    // 3. Get Stats
    const getNodeStats = useCallback((key, type) => {
        const records = dataIndex.index[key];
        if (!records) return null;

        const firstRec = records[0];
        const itemCode = firstRec['Item Code'];
        const invOrg = firstRec['Inv Org'];
        const itemClass = firstRec['Item Class']; 

        const validRecords = records.filter(d => 
            (!dateRange.start || d._dateObj >= new Date(dateRange.start)) &&
            (!dateRange.end || d._dateObj <= new Date(dateRange.end))
        );

        const weeklyMap = {};
        validRecords.forEach(r => {
            if (r.Metric === 'Tot.Inventory (Forecast)' || r.Metric === 'Tot.Target Inv.') {
                const weekNum = Math.floor(r._dateObj.getTime() / (7 * 24 * 60 * 60 * 1000));
                if (!weeklyMap[weekNum]) weeklyMap[weekNum] = { inv: 0, target: 0, count: 0 };
                
                if (r.Metric === 'Tot.Inventory (Forecast)') {
                    weeklyMap[weekNum].inv += r.Value;
                    weeklyMap[weekNum].count++;
                }
                if (r.Metric === 'Tot.Target Inv.') {
                    weeklyMap[weekNum].target += r.Value;
                }
            }
        });

        const weeklyHealth = Object.keys(weeklyMap).sort().map(w => {
            const d = weeklyMap[w];
            const avgInv = d.count ? d.inv / d.count : 0;
            const avgTarget = d.count ? d.target / d.count : 1;
            return { week: w, pct: avgTarget > 0 ? (avgInv / avgTarget) * 100 : 0 };
        });

        const invRows = validRecords.filter(r => r.Metric === 'Tot.Inventory (Forecast)');
        invRows.sort((a,b) => b._dateObj - a._dateObj);
        const currentInv = invRows.length > 0 ? invRows[0].Value : 0;
        const status = currentInv < 0 ? 'Critical' : (currentInv < 1000 ? 'Low' : 'Good');

        return {
            id: itemCode,
            itemCode: itemCode,
            invOrg: invOrg,
            itemClass: itemClass,
            type,
            status,
            currentInv,
            weeklyHealth
        };
    }, [dataIndex, dateRange]);

    // 4. Generate Lists
    const { rmList, fgList, dcList } = useMemo(() => {
        let targetRMKeys = dataIndex.rmKeys;
        let targetFGKeys = dataIndex.fgKeys;
        let targetDCKeys = dataIndex.dcKeys;

        targetRMKeys = targetRMKeys.filter(k => bomIndex.children.has(k.split('|')[0]));
        targetFGKeys = targetFGKeys.filter(k => bomIndex.parents.has(k.split('|')[0]));

        if (mapFocus) {
            const focusId = mapFocus.id; 
            
            if (mapFocus.type === 'FG') {
                const ingredients = bomIndex.p2c[focusId];
                if (ingredients) targetRMKeys = targetRMKeys.filter(k => ingredients.has(k.split('|')[0]));
                else targetRMKeys = []; 
                
                targetDCKeys = targetDCKeys.filter(k => k.split('|')[0] === focusId);

            } else if (mapFocus.type === 'RM') {
                const consumers = bomIndex.c2p[focusId];
                if (consumers) targetFGKeys = targetFGKeys.filter(k => consumers.has(k.split('|')[0]));
                else targetFGKeys = [];
                
                const visibleFgCodes = new Set(targetFGKeys.map(k => k.split('|')[0]));
                targetDCKeys = targetDCKeys.filter(k => visibleFgCodes.has(k.split('|')[0]));

            } else if (mapFocus.type === 'DC') {
                targetFGKeys = targetFGKeys.filter(k => k.split('|')[0] === focusId);
                
                const ingredients = bomIndex.p2c[focusId];
                if (ingredients) targetRMKeys = targetRMKeys.filter(k => ingredients.has(k.split('|')[0]));
                else targetRMKeys = [];
            }
        }

        if (searchTermRM) targetRMKeys = targetRMKeys.filter(k => k.toLowerCase().includes(searchTermRM.toLowerCase()));
        if (searchTermFG) targetFGKeys = targetFGKeys.filter(k => k.toLowerCase().includes(searchTermFG.toLowerCase()));
        if (searchTermDC) targetDCKeys = targetDCKeys.filter(k => k.toLowerCase().includes(searchTermDC.toLowerCase()));

        let rmNodes = targetRMKeys.map(k => getNodeStats(k, 'RM')).filter(Boolean);
        let fgNodes = targetFGKeys.map(k => getNodeStats(k, 'FG')).filter(Boolean);
        let dcNodes = targetDCKeys.map(k => getNodeStats(k, 'DC')).filter(Boolean);

        if (rmClassFilter !== 'All') {
            rmNodes = rmNodes.filter(n => n.itemClass && n.itemClass.includes(rmClassFilter));
        }
        if (fgPlantFilter !== 'All') {
            fgNodes = fgNodes.filter(n => n.invOrg === fgPlantFilter);
        }
        if (dcFilter !== 'All') {
            dcNodes = dcNodes.filter(n => n.invOrg === dcFilter);
        }

        const sorter = (a, b, method) => {
            if (method === 'alpha') return a.id.localeCompare(b.id);
            if (method === 'invDesc') return b.currentInv - a.currentInv;
            return 0;
        };
        rmNodes.sort((a, b) => sorter(a, b, sortRM));
        fgNodes.sort((a, b) => sorter(a, b, sortFG));
        dcNodes.sort((a, b) => sorter(a, b, sortDC));

        const wrapNode = (n) => ({
            id: n.id, 
            invOrg: n.invOrg,
            component: (
                <NodeCard 
                    key={`${n.id}-${n.invOrg}`} 
                    node={n} 
                    isActive={mapFocus && mapFocus.id === n.id && mapFocus.invOrg === n.invOrg}
                    onSelect={() => {
                        setMapFocus(n);
                        onNodeSelect(n); 
                    }}
                    onOpenDetail={onOpenDetails}
                />
            )
        });

        return { 
            rmList: rmNodes.map(wrapNode), 
            fgList: fgNodes.map(wrapNode),
            dcList: dcNodes.map(wrapNode)
        };

    }, [dataIndex, bomIndex, mapFocus, searchTermRM, searchTermFG, searchTermDC, sortRM, sortFG, sortDC, dateRange, getNodeStats, onOpenDetails, rmClassFilter, fgPlantFilter, dcFilter, onNodeSelect]);

    return (
        <div className="flex h-[600px] overflow-hidden bg-white rounded-xl border border-slate-200 shadow-inner relative">
            
            {/* Reset Map Button */}
            <div className="absolute top-3 right-3 z-30">
                <button 
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur text-xs font-medium text-slate-600 border border-slate-300 rounded-lg shadow-sm hover:text-indigo-600 hover:border-indigo-300 hover:shadow transition-all"
                >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
            </div>

            {/* RM Column */}
            <RenderColumn 
                title="Raw Materials" 
                count={rmList.length} 
                items={rmList} 
                type="RM"
                searchTerm={searchTermRM}
                setSearchTerm={setSearchTermRM}
                sortValue={sortRM}
                setSort={setSortRM}
                isActiveCol={mapFocus && mapFocus.type === 'RM'}
            >
                <div className="flex gap-1 mt-1 overflow-x-auto pb-1 scrollbar-none">
                    {['All', 'FA', 'AD', 'LI'].map(cls => (
                        <button 
                            key={cls}
                            onClick={() => setRmClassFilter(cls)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap
                                ${rmClassFilter === cls 
                                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
                        >
                            {cls}
                        </button>
                    ))}
                </div>
            </RenderColumn>

            {/* FG Column */}
            <RenderColumn 
                title="Finished Goods (Plant)" 
                count={fgList.length} 
                items={fgList} 
                type="FG"
                searchTerm={searchTermFG}
                setSearchTerm={setSearchTermFG}
                sortValue={sortFG}
                setSort={setSortFG}
                isActiveCol={mapFocus && mapFocus.type === 'FG'}
            >
                <div className="flex gap-1 mt-1 overflow-x-auto pb-1 scrollbar-none">
                    {['All', ...PLANT_ORGS].map(org => (
                        <button 
                            key={org}
                            onClick={() => setFgPlantFilter(org)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap
                                ${fgPlantFilter === org 
                                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
                        >
                            {org}
                        </button>
                    ))}
                </div>
            </RenderColumn>

            {/* DC Column */}
            <RenderColumn 
                title="Distribution Centers" 
                count={dcList.length} 
                items={dcList} 
                type="DC"
                searchTerm={searchTermDC}
                setSearchTerm={setSearchTermDC}
                sortValue={sortDC}
                setSort={setSortDC}
                isActiveCol={mapFocus && mapFocus.type === 'DC'}
            >
                <div className="flex gap-1 mt-1 overflow-x-auto pb-1 scrollbar-none">
                    {['All', ...DC_ORGS].map(org => (
                        <button 
                            key={org}
                            onClick={() => setDcFilter(org)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap
                                ${dcFilter === org 
                                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
                        >
                            {org}
                        </button>
                    ))}
                </div>
            </RenderColumn>
        </div>
    );
};

export default function SupplyChainDashboard() {
    const [rawData, setRawData] = useState([]);
    const [bomData, setBomData] = useState(DEFAULT_BOM);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filters, setFilters] = useState({
        itemCode: 'All',
        invOrg: 'All',
        itemClass: 'All',
        uom: 'All',
        strategy: 'All',
        metric: ['All']
    });
    const [isLeadTimeMode, setIsLeadTimeMode] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [hoveredDate, setHoveredDate] = useState(null);
    const [riskFilters, setRiskFilters] = useState({
        critical: true,
        watchOut: true,
        minDays: 1
    });
    const [ganttSort, setGanttSort] = useState('itemCode');
    const [isLoading, setIsLoading] = useState(false);

    const handleDataLoad = (data) => {
        setRawData(data);
        const validTimes = [];
        for (let i = 0; i < data.length; i++) {
            const t = data[i]._dateObj ? data[i]._dateObj.getTime() : NaN;
            if (!isNaN(t)) validTimes.push(t);
        }
        if (validTimes.length > 0) {
            let minTime = validTimes[0];
            let maxTime = validTimes[0];
            for (let i = 1; i < validTimes.length; i++) {
                if (validTimes[i] < minTime) minTime = validTimes[i];
                if (validTimes[i] > maxTime) maxTime = validTimes[i];
            }
            setDateRange({
                start: toInputDate(new Date(minTime)),
                end: toInputDate(new Date(maxTime))
            });
        }
    };

    // --- Fetch from Google Sheets ---
    useEffect(() => {
        const fetchData = async () => {
            if (!GOOGLE_SHEET_CONFIG.INVENTORY_URL || !GOOGLE_SHEET_CONFIG.BOM_URL) {
                const parsed = parseCSV(SAMPLE_CSV);
                handleDataLoad(parsed);
                return;
            }

            setIsLoading(true);
            try {
                const [invRes, bomRes] = await Promise.all([
                    fetch(GOOGLE_SHEET_CONFIG.INVENTORY_URL),
                    fetch(GOOGLE_SHEET_CONFIG.BOM_URL)
                ]);

                const invText = await invRes.text();
                const bomText = await bomRes.text();

                const invData = parseCSV(invText);
                const bomParsed = parseCSV(bomText);

                const processedBom = bomParsed.map(row => ({
                    plant: row['Plant'] || row['Plant '],
                    parent: row['Parent'] || row['Parent Item'] || row['Parent Item '],
                    child: row['Child'] || row['Child Item'] || row['Child Item '],
                    ratio: parseFloat(row['Ratio'] || row['Quantity Per'] || row['Quantity Per '] || row['qty'] || 0)
                })).filter(row => row.parent && row.child);

                handleDataLoad(invData);
                setBomData(processedBom);

            } catch (error) {
                console.error("Failed to load Google Sheets", error);
                const parsed = parseCSV(SAMPLE_CSV);
                handleDataLoad(parsed);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleInventoryUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = parseCSV(text);
            handleDataLoad(parsed);
        };
        reader.readAsText(file);
    };

    const handleBomUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const rawParsed = parseCSV(text);
            const processedBom = rawParsed.map(row => ({
                plant: row['Plant'] || row['Plant '],
                parent: row['Parent'] || row['Parent Item'] || row['Parent Item '],
                child: row['Child'] || row['Child Item'] || row['Child Item '],
                ratio: parseFloat(row['Ratio'] || row['Quantity Per'] || row['Quantity Per '] || row['qty'] || 0)
            })).filter(row => row.parent && row.child);

            setBomData(processedBom);
            alert(`Successfully imported ${processedBom.length} BOM records.`);
        };
        reader.readAsText(file);
    };

    // --- Filter Logic ---
    const options = useMemo(() => {
        const getFilteredDataForField = (excludeKey) => {
            return rawData.filter(item => {
                const itemDate = item._dateObj;
                const startDate = dateRange.start ? new Date(dateRange.start) : null;
                const endDate = dateRange.end ? new Date(dateRange.end) : null;
                const inDateRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                if (!inDateRange) return false;
                return (
                    inDateRange &&
                    (excludeKey === 'itemCode' || filters.itemCode === 'All' || item['Item Code'] === filters.itemCode) &&
                    (excludeKey === 'invOrg' || filters.invOrg === 'All' || item['Inv Org'] === filters.invOrg) &&
                    (excludeKey === 'itemClass' || filters.itemClass === 'All' || item['Item Class'] === filters.itemClass) &&
                    (excludeKey === 'uom' || filters.uom === 'All' || item['UOM'] === filters.uom) &&
                    (excludeKey === 'strategy' || filters.strategy === 'All' || item['Strategy'] === filters.strategy)
                );
            });
        };
        const getUnique = (data, key) => ['All', ...new Set(data.map(d => d[key]).filter(Boolean))].sort();
        return {
            itemCodes: getUnique(getFilteredDataForField('itemCode'), 'Item Code'),
            invOrgs: getUnique(getFilteredDataForField('invOrg'), 'Inv Org'),
            itemClasses: getUnique(getFilteredDataForField('itemClass'), 'Item Class'),
            uoms: getUnique(getFilteredDataForField('uom'), 'UOM'),
            strategies: getUnique(getFilteredDataForField('strategy'), 'Strategy'),
            metrics: getUnique(getFilteredDataForField('metric'), 'Metric'),
        };
    }, [rawData, filters, dateRange]);

    const filteredData = useMemo(() => {
        return rawData.filter(item => {
            const itemDate = item._dateObj;
            const startDate = dateRange.start ? new Date(dateRange.start) : null;
            const endDate = dateRange.end ? new Date(dateRange.end) : null;
            const inDateRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
            
            return (
                inDateRange &&
                (filters.itemCode === 'All' || item['Item Code'] === filters.itemCode) &&
                (filters.invOrg === 'All' || item['Inv Org'] === filters.invOrg) &&
                (filters.itemClass === 'All' || item['Item Class'] === filters.itemClass) &&
                (filters.uom === 'All' || item['UOM'] === filters.uom) &&
                (filters.strategy === 'All' || item['Strategy'] === filters.strategy)
            );
        });
    }, [rawData, filters, dateRange]);

    const riskChartData = useMemo(() => {
        let sourceData = filteredData;
        if (selectedItem) {
            sourceData = rawData.filter(d => 
                d['Item Code'] === selectedItem.itemCode && 
                d['Inv Org'] === selectedItem.invOrg &&
                (!dateRange.start || d._dateObj >= new Date(dateRange.start)) &&
                (!dateRange.end || d._dateObj <= new Date(dateRange.end))
            );
        }

        const grouped = {};
        const chartFiltered = sourceData.filter(item => 
             filters.metric.includes('All') || filters.metric.includes(item.Metric)
        );

        chartFiltered.forEach(item => {
            if (!grouped[item.Date]) grouped[item.Date] = { date: item.Date, _dateObj: item._dateObj };
            if (!grouped[item.Date][item.Metric]) grouped[item.Date][item.Metric] = 0;
            grouped[item.Date][item.Metric] += (item.Value || 0);
        });
        return Object.values(grouped).sort((a, b) => a._dateObj - b._dateObj);
    }, [filteredData, filters.metric, selectedItem, rawData, dateRange]);

    const ganttData = useMemo(() => {
        const grouped = {};
        const today = new Date();

        filteredData.forEach(item => {
            const key = `${item['Item Code']}|${item['Inv Org']}`;
            if (!grouped[key]) grouped[key] = { itemCode: item['Item Code'], invOrg: item['Inv Org'], days: {} };
            if (!grouped[key].days[item.Date]) grouped[key].days[item.Date] = { _dateObj: item._dateObj, metrics: {} };
            const normMetric = item.Metric.trim();
            grouped[key].days[item.Date].metrics[normMetric] = (grouped[key].days[item.Date].metrics[normMetric] || 0) + (item.Value || 0);
        });

        let rows = [];

        Object.values(grouped).forEach(group => {
            const sortedDates = Object.values(group.days).sort((a, b) => a._dateObj - b._dateObj);
            const blocks = [];
            let currentBlock = null;
            
            let totalShortageDays = 0;
            let hasInsideLeadTimeRisk = false;
            let firstOutsideLeadTimeRiskDate = 9999999999999;
            const leadTimeWeeks = getLeadTimeWeeks(group.invOrg);
            const leadTimeDate = addWeeks(today, leadTimeWeeks);

            sortedDates.forEach(day => {
                const m = day.metrics;
                const totReq = m['Tot.Req.'] || 0;
                const indepReq = m['Indep. Req. (Forecast)'] || 0;
                const inventory = m['Tot.Inventory (Forecast)'] || 0;
                const targetInv = m['Tot.Target Inv.'] || 0;

                let status = null;
                if ((totReq + indepReq) > inventory) status = 'Critical';
                else if (inventory < targetInv && (totReq + indepReq) <= 0.001) status = 'Watch Out';

                if (status) {
                    if (day._dateObj <= leadTimeDate) hasInsideLeadTimeRisk = true;
                    else if (day._dateObj.getTime() < firstOutsideLeadTimeRiskDate) firstOutsideLeadTimeRiskDate = day._dateObj.getTime();

                    if (currentBlock && currentBlock.status === status && (day._dateObj.getTime() - currentBlock.end.getTime() <= 86400000 + 10000)) {
                        currentBlock.end = day._dateObj;
                        currentBlock.days += 1;
                    } else {
                        if (currentBlock) blocks.push(currentBlock);
                        currentBlock = { start: day._dateObj, end: day._dateObj, status: status, days: 1 };
                    }
                } else {
                    if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
                }
            });
            if (currentBlock) blocks.push(currentBlock);

            const filteredBlocks = blocks.filter(b => {
                if (b.days < riskFilters.minDays) return false;
                if (b.status === 'Critical' && !riskFilters.critical) return false;
                if (b.status === 'Watch Out' && !riskFilters.watchOut) return false;
                return true;
            });

            totalShortageDays = filteredBlocks.reduce((acc, b) => acc + b.days, 0);

            if (filteredBlocks.length > 0) {
                rows.push({
                    itemCode: group.itemCode, invOrg: group.invOrg, blocks: filteredBlocks,
                    totalShortageDays, hasInsideLeadTimeRisk, firstOutsideLeadTimeRiskDate
                });
            }
        });

        rows.sort((a, b) => {
            if (ganttSort === 'itemCode') return a.itemCode.localeCompare(b.itemCode);
            if (ganttSort === 'leadTime') {
                if (a.hasInsideLeadTimeRisk !== b.hasInsideLeadTimeRisk) return a.hasInsideLeadTimeRisk ? -1 : 1; 
                return b.totalShortageDays - a.totalShortageDays;
            }
            if (ganttSort === 'duration') return b.totalShortageDays - a.totalShortageDays;
            if (ganttSort === 'planning') return a.firstOutsideLeadTimeRiskDate - b.firstOutsideLeadTimeRiskDate;
            return 0;
        });

        return rows;
    }, [filteredData, riskFilters, ganttSort]);

    const selectedItemData = useMemo(() => {
        if (!selectedItem) return null;
        const itemsData = rawData.filter(d => d['Item Code'] === selectedItem.itemCode && d['Inv Org'] === selectedItem.invOrg);
        const startDate = dateRange.start ? new Date(dateRange.start) : null;
        const endDate = dateRange.end ? new Date(dateRange.end) : null;
        const uniqueDates = new Set();
        const uniqueMetrics = new Set();
        const valueMap = {};

        itemsData.forEach(d => {
             const itemDate = d._dateObj;
             if (startDate && itemDate < startDate) return;
             if (endDate && itemDate > endDate) return;
             uniqueDates.add(d.Date);
             const metric = d.Metric.trim();
             uniqueMetrics.add(metric);
             if (!valueMap[metric]) valueMap[metric] = {};
             valueMap[metric][d.Date] = (valueMap[metric][d.Date] || 0) + d.Value;
        });

        const sortedDates = Array.from(uniqueDates).sort((a,b) => new Date(a) - new Date(b));
        const sortedMetrics = Array.from(uniqueMetrics).sort();
        return { dates: sortedDates, metrics: sortedMetrics, values: valueMap };
    }, [selectedItem, rawData, dateRange]);

    const activeMetrics = useMemo(() => {
        if (filters.metric.includes('All')) return Array.from(new Set(filteredData.map(d => d.Metric)));
        return filters.metric;
    }, [filteredData, filters.metric]);

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const resetFilters = () => {
        setIsLeadTimeMode(false);
        setFilters({ itemCode: 'All', invOrg: 'All', itemClass: 'All', uom: 'All', strategy: 'All', metric: ['All'] });
        setRiskFilters({ critical: true, watchOut: true, minDays: 1 });
        setSelectedItem(null);
        setIsDetailOpen(false);
        setGanttSort('itemCode');
        setHoveredDate(null);
        const validTimes = [];
        for (let i = 0; i < rawData.length; i++) {
            const t = rawData[i]._dateObj ? rawData[i]._dateObj.getTime() : NaN;
            if (!isNaN(t)) validTimes.push(t);
        }
        if (validTimes.length > 0) {
            let minTime = validTimes[0];
            let maxTime = validTimes[0];
            for (let i = 1; i < validTimes.length; i++) {
                if (validTimes[i] < minTime) minTime = validTimes[i];
                if (validTimes[i] > maxTime) maxTime = validTimes[i];
            }
            setDateRange({ start: toInputDate(new Date(minTime)), end: toInputDate(new Date(maxTime)) });
        }
    };

    const getGanttStyles = (start, end) => {
        if (!dateRange.start || !dateRange.end) return { left: '0%', width: '0%' };
        const min = new Date(dateRange.start).getTime();
        const max = new Date(dateRange.end).getTime();
        const total = max - min;
        if (total <= 0) return { left: '0%', width: '0%' };
        const s = start.getTime();
        const e = end.getTime();
        const left = Math.max(0, ((s - min) / total) * 100);
        const right = Math.min(100, ((e - min) / total) * 100);
        const width = Math.max(0.5, right - left);
        return { left: `${left}%`, width: `${width}%` };
    };

    const Y_AXIS_WIDTH = 200; 

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 selection:bg-indigo-100 selection:text-indigo-800">
             <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 transition-all duration-300">
                <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supply Chain <span className="text-indigo-600">Analytics</span></h1>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Inventory Intelligence</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => window.location.reload()} className="group flex items-center px-3 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm" title="Reload Data">
                             <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <label className="group flex items-center px-4 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm">
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600 group-hover:-translate-y-0.5 transition-transform" />Import BOM<input type="file" accept=".csv" onChange={handleBomUpload} className="hidden" />
                        </label>
                        <label className="group flex items-center px-4 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm">
                            <Upload className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" />Import CSV<input type="file" accept=".csv" onChange={handleInventoryUpload} className="hidden" />
                        </label>
                    </div>
                </div>
            </header>

            <div className="flex min-h-screen max-w-[1800px] mx-auto">
                {/* --- LEFT SIDEBAR PLACEHOLDER (10%) --- */}
                <div className="hidden xl:block w-[5%] 2xl:w-[10%] border-r border-slate-200 bg-slate-50/50">
                    <div className="h-full w-full flex items-center justify-center text-slate-300">
                        <PanelLeft className="w-6 h-6 opacity-20" />
                    </div>
                </div>

                {/* --- CENTER MAIN CONTENT (70%) --- */}
                <main className="flex-1 flex flex-col p-6 gap-6 min-w-0 overflow-hidden">
                    {/* SUPPLY CHAIN MAP (Main Stage) */}
                    <div className="flex-1 min-h-[500px] bg-white rounded-2xl shadow-sm border border-slate-200/60 p-0 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Network className="w-5 h-5" /></div>
                                <div><h2 className="text-lg font-bold text-slate-900 tracking-tight">Supply Chain Network</h2><p className="text-xs text-slate-500">Live Inventory Map</p></div>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                             <SupplyChainMap 
                                selectedItemFromParent={selectedItem} 
                                bomData={bomData} 
                                inventoryData={rawData} 
                                dateRange={dateRange} 
                                onOpenDetails={(node) => {
                                    setSelectedItem({ itemCode: node.id, invOrg: node.invOrg, type: node.type });
                                    setIsDetailOpen(true);
                                }}
                                onNodeSelect={(node) => {
                                    if (node) setSelectedItem({ itemCode: node.id, invOrg: node.invOrg, type: node.type });
                                    else setSelectedItem(null);
                                }}
                            />
                        </div>
                    </div>

                    {/* RISK MONITOR (Bottom) */}
                    <div className="h-[400px] bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                                <div><h2 className="text-lg font-bold text-slate-900 tracking-tight">Risk Monitor</h2><p className="text-xs text-slate-500">Timeline of projected shortages</p></div>
                            </div>
                            {/* Minified Risk Controls */}
                            <div className="flex items-center gap-4">
                                 <div className="flex items-center space-x-2 border-r border-slate-200 pr-4">
                                    <label className="text-[10px] font-bold uppercase text-slate-400">Sort</label>
                                    <select className="text-xs border-none focus:ring-0 text-slate-600 font-medium bg-transparent cursor-pointer" value={ganttSort} onChange={(e) => setGanttSort(e.target.value)}>
                                        <option value="itemCode">Name</option>
                                        <option value="leadTime">Lead Time</option>
                                        <option value="duration">Duration</option>
                                    </select>
                                </div>
                                <div className="flex items-center space-x-3 text-xs font-medium text-slate-600">
                                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={riskFilters.critical} onChange={e => setRiskFilters(p => ({...p, critical: e.target.checked}))} className="rounded text-red-500 focus:ring-red-500 border-slate-300" />Critical</label>
                                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={riskFilters.watchOut} onChange={e => setRiskFilters(p => ({...p, watchOut: e.target.checked}))} className="rounded text-amber-400 focus:ring-amber-400 border-slate-300" />Watch Out</label>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-200">
                            {ganttData.length > 0 ? (
                                ganttData.map((row, idx) => (
                                    <div key={idx} className={`flex items-center border-b border-slate-50 h-12 group transition-all duration-200 ${selectedItem && selectedItem.itemCode === row.itemCode && selectedItem.invOrg === row.invOrg ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                                        <div className="flex-shrink-0 px-6 py-2 border-r border-slate-50 truncate cursor-pointer h-full flex flex-col justify-center" style={{ width: Y_AXIS_WIDTH }} onClick={() => setSelectedItem(row)}>
                                            <div className="font-bold text-slate-700 text-sm truncate group-hover:text-indigo-600 transition-colors">{row.itemCode}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{row.invOrg}</div>
                                        </div>
                                        <div className="flex-1 relative h-full cursor-pointer" style={{ marginLeft: '20px', marginRight: '30px' }} onClick={() => setSelectedItem(row)}>
                                            <div className="absolute inset-0 flex opacity-30 pointer-events-none">
                                                <div className="w-1/4 border-r border-slate-100 h-full"></div><div className="w-1/4 border-r border-slate-100 h-full"></div><div className="w-1/4 border-r border-slate-100 h-full"></div>
                                            </div>
                                            {row.blocks.map((block, bIdx) => {
                                                const style = getGanttStyles(block.start, block.end);
                                                const isCritical = block.status === 'Critical';
                                                const colorClass = isCritical ? 'bg-red-500' : 'bg-amber-400';
                                                return (
                                                    <div key={bIdx} className={`absolute h-4 top-4 rounded-full shadow-sm cursor-pointer hover:scale-y-125 transition-transform ${colorClass}`} style={{...style, minWidth: '8px'}} title={`${block.status}: ${block.days} Days`}></div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : <EmptyState msg="No risks match current filters" />}
                        </div>
                    </div>
                </main>

                {/* --- RIGHT SIDEBAR (20%) --- */}
                <aside className="w-[300px] 2xl:w-[20%] border-l border-slate-200 bg-white h-screen sticky top-0 overflow-y-auto z-30 shadow-xl flex flex-col">
                    {/* 1. Trend Graph (Top Priority) */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-emerald-600" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Trend Analysis</h3>
                        </div>
                        <div className="h-48 w-full bg-white rounded-xl border border-slate-200 shadow-sm p-2">
                             {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>{colors.map((color, index) => (<linearGradient key={index} id={`color${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient>))}</defs>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        {activeMetrics.map((metric, index) => (
                                            <Area key={metric} type="monotone" dataKey={metric} stroke={colors[index % colors.length]} fill={`url(#color${index % colors.length})`} strokeWidth={2} />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No data selected</div>}
                        </div>
                        <div className="mt-2 text-xs text-center font-medium text-slate-600 truncate">
                            {selectedItem ? `${selectedItem.itemCode} (${selectedItem.invOrg})` : "Aggregate View"}
                        </div>
                    </div>

                    {/* 2. Global Filters (Stacked) */}
                    <div className="p-4 flex-1 flex flex-col gap-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Filter className="w-3 h-3" /> Filters</h3>
                            <button onClick={resetFilters} className="text-[10px] text-indigo-600 hover:underline font-medium">Reset All</button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Stacked Vertical Inputs */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Analysis Mode</label>
                                <button onClick={() => setIsLeadTimeMode(!isLeadTimeMode)} className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all ${isLeadTimeMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    <span className="text-xs font-medium flex items-center"><Clock className="w-3 h-3 mr-2" />Lead Time Only</span>
                                    {isLeadTimeMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4 text-slate-300" />}
                                </button>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Range</label>
                                <div className="flex flex-col gap-2">
                                    <input type="date" disabled={isLeadTimeMode} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                    <input type="date" disabled={isLeadTimeMode} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                                </div>
                            </div>

                            <SearchableSelect label="Item Code" value={filters.itemCode} options={options.itemCodes} onChange={(val) => setFilters(prev => ({ ...prev, itemCode: val }))} />
                            <SearchableSelect label="Inv Org" value={filters.invOrg} options={options.invOrgs} onChange={(val) => setFilters(prev => ({ ...prev, invOrg: val }))} />
                            <SearchableSelect label="Item Class" value={filters.itemClass} options={options.itemClasses} onChange={(val) => setFilters(prev => ({ ...prev, itemClass: val }))} />
                            <SearchableSelect label="Strategy" value={filters.strategy} options={options.strategies} onChange={(val) => setFilters(prev => ({ ...prev, strategy: val }))} />
                            
                            <div className="pt-4 border-t border-slate-100">
                                <SearchableSelect label="Visible Metrics" value={filters.metric} options={options.metrics} onChange={(val) => setFilters(prev => ({ ...prev, metric: val }))} multi={true} />
                            </div>
                        </div>
                    </div>
                </aside>

                {selectedItem && selectedItemData && isDetailOpen && (
                    <div className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] transform transition-all duration-300 ease-in-out h-96 flex flex-col animate-in slide-in-from-bottom-10">
                        <div className="px-6 py-4 bg-white/50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="bg-indigo-100 p-2 rounded-lg"><Table className="w-5 h-5 text-indigo-600" /></div>
                                <div><h3 className="font-bold text-slate-900 text-lg tracking-tight">{selectedItem.itemCode}</h3><p className="text-xs text-slate-500 font-medium font-mono uppercase tracking-wider">{selectedItem.invOrg} — Detail View</p></div>
                            </div>
                            <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors group"><X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left border-collapse relative">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50/90 sticky top-0 z-10 font-semibold tracking-wider backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-3 border-b border-slate-200 left-0 sticky z-20 bg-slate-50 border-r shadow-[4px_0_24px_-2px_rgba(0,0,0,0.05)] w-64">Metric</th>
                                        {selectedItemData.dates.map(dateStr => (
                                            <th key={dateStr} className={`px-3 py-3 border-b border-slate-200 text-center min-w-[80px] transition-colors cursor-default ${hoveredDate === dateStr ? 'bg-indigo-50 text-indigo-700' : ''}`} onMouseEnter={() => setHoveredDate(dateStr)} onMouseLeave={() => setHoveredDate(null)}>
                                                <div className="flex flex-col"><span className="text-[10px] opacity-70">{new Date(dateStr).toLocaleString('default', { weekday: 'short' })}</span><span>{new Date(dateStr).getMonth() + 1}/{new Date(dateStr).getDate()}</span></div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedItemData.metrics.map(metric => (
                                        <tr key={metric} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-3 font-medium text-slate-600 sticky left-0 bg-white group-hover:bg-slate-50/80 border-r border-slate-100 z-10 text-xs truncate max-w-[250px]" title={metric}>{metric}</td>
                                            {selectedItemData.dates.map(dateStr => {
                                                const val = selectedItemData.values[metric]?.[dateStr];
                                                let cellClass = "text-slate-400";
                                                if (metric === 'Tot.Inventory (Forecast)' && val < 0) cellClass = "text-red-600 font-bold bg-red-50 ring-1 ring-inset ring-red-100";
                                                else if (val > 0) cellClass = "text-slate-700 font-medium";
                                                return <td key={dateStr} className={`px-3 py-2 text-right border-r border-slate-50 transition-colors font-mono text-xs ${cellClass} ${hoveredDate === dateStr ? 'bg-indigo-50' : ''}`} onMouseEnter={() => setHoveredDate(dateStr)} onMouseLeave={() => setHoveredDate(null)}>{val !== undefined ? val.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-'}</td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <style jsx global>{`@keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: .85; } } .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }`}</style>
        </div>
    );
}

const EmptyState = ({ msg }) => (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <Layers className="w-10 h-10 mb-2 opacity-50" />
        <p>{msg}</p>
    </div>
);
