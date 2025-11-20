import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine, ComposedChart
} from 'recharts';
import {
    Upload, Filter, Package, Calendar, ChevronDown, Search, Clock, ToggleLeft, ToggleRight, AlertTriangle, X, Table, SlidersHorizontal, ArrowUpDown, CheckSquare, Square, Activity, Layers, Factory, Network, FileSpreadsheet
} from 'lucide-react';

// --- Helper for CSV Parsing ---
const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                let value = currentLine[index].trim();
                if (!isNaN(value) && value !== '' && (header === 'Value' || header.includes('Qty') || header.includes('Ratio'))) {
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

// --- Lead Time Helper ---
const getLeadTimeWeeks = (invOrg) => {
    if (invOrg === 'IDCKDM') return 6;
    if (invOrg === 'VNHCDM' || invOrg === 'VNHNDM') return 7;
    if (invOrg === 'THBNDM' || invOrg === 'MYBGPM') return 5;
    return 4; // Default
};

// --- Sample Data ---
const SAMPLE_CSV = `Factory,Type,Item Code,Inv Org,Item Class,UOM,Strategy,Original Item String,Metric,Start,Date,Value
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/19/2025,9910.16
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/19/2025,5000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/20/2025,500.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/20/2025,400.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/21/2025,0
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/21/2025,400.00
SF,RM,BAB250-MR1,MYBGPM,MR,KG,MTS,BAB250-MR1/MYBGPM/MR/KG/MTS,Tot.Inventory (Forecast),0,11/19/2025,2500.00
SF,RM,BAB250-MR1,MYBGPM,MR,KG,MTS,BAB250-MR1/MYBGPM/MR/KG/MTS,Tot.Inventory (Forecast),0,11/20/2025,2400.00
NR,RM,BAB250-MR1,THRYPM,MR,LM,NST(MTS),BAB250-MR1/THRYPM/MR/LM/NST(MTS),Indep. Req. (Forecast),0,12/17/2025,150
NR,RM,BAB250-MR1,THRYPM,MR,LM,NST(MTS),BAB250-MR1/THRYPM/MR/LM/NST(MTS),Tot.Inventory (Forecast),0,12/17/2025,100`;

// --- Sample BOM (Default State) ---
const DEFAULT_BOM = [
    { parent: 'AAG620-MR2', child: 'BAB250-MR1', ratio: 0.5 }, 
];

// --- Custom Tooltip Component ---
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

// --- Components ---

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
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
            <button
                className={`w-full bg-white rounded-xl border px-4 py-2.5 text-sm flex items-center justify-between cursor-pointer transition-all duration-200 ease-in-out
                    ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-md' : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
                onClick={() => {
                    if (!isOpen) setSearchTerm("");
                    setIsOpen(!isOpen);
                }}
            >
                <span className={`truncate block max-w-[180px] text-left font-medium ${value === 'All' || (multi && value.includes('All')) ? 'text-slate-500' : 'text-slate-800'}`}>
                    {getDisplayText()}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
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
                                    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors
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
                                            ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                                            : <Square className="w-4 h-4 text-slate-300" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center italic">No results</div>
                        )}
                    </div>
                </div>
            )}
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
    const [viewMode, setViewMode] = useState('risk'); // 'risk' | 'manufacturing'

    // Interaction States
    const [selectedItem, setSelectedItem] = useState(null);
    const [hoveredDate, setHoveredDate] = useState(null);

    // Risk/Gantt Filters
    const [riskFilters, setRiskFilters] = useState({
        critical: true,
        watchOut: true,
        minDays: 1
    });
    const [ganttSort, setGanttSort] = useState('itemCode');

    // --- Loaders ---
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

    useEffect(() => {
        const parsed = parseCSV(SAMPLE_CSV);
        handleDataLoad(parsed);
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
            
            // Robust mapping for BOM columns
            const processedBom = rawParsed.map(row => ({
                parent: row['Parent'] || row['Parent Item'] || row['parent'],
                child: row['Child'] || row['Child Item'] || row['child'],
                ratio: parseFloat(row['Ratio'] || row['Quantity Per'] || row['qty'] || 0)
            })).filter(row => row.parent && row.child);

            setBomData(processedBom);
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

    // --- 1. MAIN CHART DATA (Risk View) ---
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
            if (!grouped[item.Date]) {
                grouped[item.Date] = { date: item.Date, _dateObj: item._dateObj };
            }
            if (!grouped[item.Date][item.Metric]) {
                grouped[item.Date][item.Metric] = 0;
            }
            grouped[item.Date][item.Metric] += (item.Value || 0);
        });
        return Object.values(grouped).sort((a, b) => a._dateObj - b._dateObj);
    }, [filteredData, filters.metric, selectedItem, rawData, dateRange, viewMode]);

    // --- 2. PRODUCTION DATA (Manufacturing View) ---
    const productionData = useMemo(() => {
        if (viewMode !== 'manufacturing' || !selectedItem) return [];

        // Use bomData state instead of hardcoded constant
        const ingredients = bomData.filter(b => b.parent === selectedItem.itemCode);
        if (ingredients.length === 0) return [];

        const fgData = rawData.filter(d => 
            d['Item Code'] === selectedItem.itemCode && 
            d['Inv Org'] === selectedItem.invOrg &&
            (!dateRange.start || d._dateObj >= new Date(dateRange.start)) &&
            (!dateRange.end || d._dateObj <= new Date(dateRange.end))
        );

        const grouped = {};
        fgData.forEach(d => {
            if (!grouped[d.Date]) grouped[d.Date] = { date: d.Date, _dateObj: d._dateObj };
            grouped[d.Date][d.Metric] = (grouped[d.Date][d.Metric] || 0) + d.Value;
        });

        ingredients.forEach(ing => {
            const rmData = rawData.filter(d => 
                d['Item Code'] === ing.child && 
                d['Inv Org'] === selectedItem.invOrg &&
                d.Metric === 'Tot.Inventory (Forecast)' &&
                (!dateRange.start || d._dateObj >= new Date(dateRange.start)) &&
                (!dateRange.end || d._dateObj <= new Date(dateRange.end))
            );
            
            rmData.forEach(rm => {
                if (grouped[rm.Date]) {
                    const possibleUnits = rm.Value / ing.ratio;
                    grouped[rm.Date][`Max Prod (${ing.child})`] = possibleUnits;
                }
            });
        });

        return Object.values(grouped).sort((a,b) => a._dateObj - b._dateObj);
    }, [viewMode, selectedItem, rawData, dateRange, bomData]);


    // --- Gantt Data Logic ---
    const ganttData = useMemo(() => {
        const grouped = {};
        const today = new Date();

        filteredData.forEach(item => {
            const key = `${item['Item Code']}|${item['Inv Org']}`;
            if (!grouped[key]) {
                grouped[key] = {
                    itemCode: item['Item Code'],
                    invOrg: item['Inv Org'],
                    days: {}
                };
            }
            if (!grouped[key].days[item.Date]) {
                grouped[key].days[item.Date] = { _dateObj: item._dateObj, metrics: {} };
            }
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
                if ((totReq + indepReq) > inventory) {
                     status = 'Critical';
                } else if (inventory < targetInv && (totReq + indepReq) <= 0.001) {
                    status = 'Watch Out';
                }

                if (status) {
                    if (day._dateObj <= leadTimeDate) hasInsideLeadTimeRisk = true;
                    else {
                        if (day._dateObj.getTime() < firstOutsideLeadTimeRiskDate) {
                            firstOutsideLeadTimeRiskDate = day._dateObj.getTime();
                        }
                    }

                    if (currentBlock && currentBlock.status === status && 
                        (day._dateObj.getTime() - currentBlock.end.getTime() <= 86400000 + 10000)) {
                        currentBlock.end = day._dateObj;
                        currentBlock.days += 1;
                    } else {
                        if (currentBlock) blocks.push(currentBlock);
                        currentBlock = {
                            start: day._dateObj,
                            end: day._dateObj,
                            status: status,
                            days: 1
                        };
                    }
                } else {
                    if (currentBlock) {
                        blocks.push(currentBlock);
                        currentBlock = null;
                    }
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
                    itemCode: group.itemCode,
                    invOrg: group.invOrg,
                    blocks: filteredBlocks,
                    totalShortageDays,
                    hasInsideLeadTimeRisk,
                    firstOutsideLeadTimeRiskDate
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

    // --- Pivot Data (Detail View) ---
    const selectedItemData = useMemo(() => {
        if (!selectedItem) return null;
        const itemsData = rawData.filter(d => 
            d['Item Code'] === selectedItem.itemCode && 
            d['Inv Org'] === selectedItem.invOrg
        );
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
        setGanttSort('itemCode');
        setHoveredDate(null);
        setViewMode('risk');
        // Reset Date logic...
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
            setDateRange({
                start: toInputDate(new Date(minTime)),
                end: toInputDate(new Date(maxTime))
            });
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
                        {/* View Mode Switcher */}
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button 
                                onClick={() => setViewMode('risk')}
                                className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'risk' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Activity className="w-3.5 h-3.5 mr-1.5" />
                                Risk Monitor
                            </button>
                            <button 
                                onClick={() => setViewMode('manufacturing')}
                                className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'manufacturing' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Factory className="w-3.5 h-3.5 mr-1.5" />
                                Manufacturing
                            </button>
                        </div>

                        <label className="group flex items-center px-4 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm">
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600 group-hover:-translate-y-0.5 transition-transform" />
                            Import BOM
                            <input type="file" accept=".csv" onChange={handleBomUpload} className="hidden" />
                        </label>

                        <label className="group flex items-center px-4 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm">
                            <Upload className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                            Import CSV
                            <input type="file" accept=".csv" onChange={handleInventoryUpload} className="hidden" />
                        </label>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Filters Container */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8 transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3 text-slate-800">
                            <div className="p-2 bg-blue-50 rounded-lg"><Filter className="w-5 h-5 text-indigo-600" /></div>
                            <div><h2 className="font-bold text-lg tracking-tight">Global Filters</h2><p className="text-sm text-slate-500">Refine data points across all charts</p></div>
                        </div>
                        <button onClick={resetFilters} className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-colors">Reset Defaults</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 pb-8 border-b border-slate-100">
                         <div className="lg:col-span-3 flex flex-col justify-end">
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Analysis Mode</label>
                            <button onClick={() => setIsLeadTimeMode(!isLeadTimeMode)} className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl border transition-all duration-200 ${isLeadTimeMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                <span className="text-sm font-medium flex items-center"><Clock className={`w-4 h-4 mr-2.5 ${isLeadTimeMode ? 'text-indigo-600' : 'text-slate-400'}`} />Inside Lead Time ONLY</span>
                                {isLeadTimeMode ? <ToggleRight className="w-6 h-6 text-indigo-600" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                            </button>
                        </div>
                        <div className="lg:col-span-3">
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                            <input type="date" disabled={isLeadTimeMode} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                        </div>
                        <div className="lg:col-span-3">
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">End Date</label>
                            <input type="date" disabled={isLeadTimeMode} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                        </div>
                        <div className="lg:col-span-3">
                            <SearchableSelect label="Displayed Metrics" value={filters.metric} options={options.metrics} onChange={(val) => setFilters(prev => ({ ...prev, metric: val }))} multi={true} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <SearchableSelect label="Item Code" value={filters.itemCode} options={options.itemCodes} onChange={(val) => setFilters(prev => ({ ...prev, itemCode: val }))} />
                        <SearchableSelect label="Inv Org" value={filters.invOrg} options={options.invOrgs} onChange={(val) => setFilters(prev => ({ ...prev, invOrg: val }))} />
                        <SearchableSelect label="Item Class" value={filters.itemClass} options={options.itemClasses} onChange={(val) => setFilters(prev => ({ ...prev, itemClass: val }))} />
                        <SearchableSelect label="UOM" value={filters.uom} options={options.uoms} onChange={(val) => setFilters(prev => ({ ...prev, uom: val }))} />
                        <SearchableSelect label="Strategy" value={filters.strategy} options={options.strategies} onChange={(val) => setFilters(prev => ({ ...prev, strategy: val }))} />
                    </div>
                </div>

                {/* MAIN VISUALIZATION AREA */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8 relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${viewMode === 'risk' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                {viewMode === 'risk' ? <Activity className="w-5 h-5" /> : <Network className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                                    {viewMode === 'risk' 
                                        ? (selectedItem ? `Trend: ${selectedItem.itemCode}` : "Aggregate Trends")
                                        : (selectedItem ? `Production Feasibility: ${selectedItem.itemCode}` : "Select an Item in the Gantt below")
                                    }
                                </h2>
                                {selectedItem && <p className="text-sm text-slate-500">{selectedItem.invOrg}</p>}
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                        {/* CONDITIONAL CHART RENDER */}
                        {viewMode === 'risk' ? (
                            // 1. RISK CHART (Area)
                            riskChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={riskChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onMouseMove={(e) => e && e.activeLabel && setHoveredDate(e.activeLabel)} onMouseLeave={() => setHoveredDate(null)}>
                                        <defs>
                                            {colors.map((color, index) => (
                                                <linearGradient key={index} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/><stop offset="95%" stopColor={color} stopOpacity={0}/>
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={15} tickLine={false} axisLine={false} tickFormatter={(str) => `${new Date(str).getMonth() + 1}/${new Date(str).getDate()}`} />
                                        <YAxis stroke="#94a3b8" fontSize={12} width={60} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}}/>
                                        {activeMetrics.map((metric, index) => (
                                            <Area key={metric} type="monotone" dataKey={metric} stroke={colors[index % colors.length]} fill={`url(#color${index % colors.length})`} fillOpacity={1} strokeWidth={2} activeDot={{ r: 6, strokeWidth: 0 }} />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <EmptyState msg="No trend data available" />
                        ) : (
                            // 2. PRODUCTION CHART (Bar)
                            selectedItem ? (
                                productionData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={productionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={15} tickLine={false} axisLine={false} tickFormatter={(str) => `${new Date(str).getMonth() + 1}/${new Date(str).getDate()}`} />
                                            <YAxis stroke="#94a3b8" fontSize={12} width={60} tickLine={false} axisLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}}/>
                                            {/* Target FG Inventory */}
                                            <Bar dataKey="Tot.Inventory (Forecast)" name="FG Inventory" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                            {/* Max Production from RM */}
                                            <Line type="monotone" dataKey="Max Prod (BAB250-MR1)" name="Max Prod from RM" stroke="#10b981" strokeWidth={2} dot={{r: 4}} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyState msg="No BOM data or Ingredients found for this item." />
                            ) : <EmptyState msg="Select an item from the list below to view production feasibility." />
                        )}
                    </div>
                </div>

                {/* Gantt Section (Always Visible for Selection) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                            <div><h2 className="text-lg font-bold text-slate-900 tracking-tight">Risk Monitor & Selection</h2><p className="text-sm text-slate-500">Select items here to update charts above</p></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center space-x-2 border-r border-slate-100 pr-4 pl-2">
                                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                <select className="text-sm border-none focus:ring-0 text-slate-600 font-medium cursor-pointer bg-transparent py-1 pr-8" value={ganttSort} onChange={(e) => setGanttSort(e.target.value)}>
                                    <option value="itemCode">Sort by Name</option>
                                    <option value="leadTime">Inside Lead Time First</option>
                                    <option value="duration">Shortage Duration</option>
                                    <option value="planning">Planning Priority</option>
                                </select>
                            </div>
                            <div className="flex items-center space-x-2 border-r border-slate-100 pr-4">
                                <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Min Days</label>
                                <input type="number" min="1" className="w-14 px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-center font-medium" value={riskFilters.minDays} onChange={(e) => setRiskFilters(p => ({...p, minDays: parseInt(e.target.value) || 1}))} />
                            </div>
                            <div className="flex items-center space-x-4 px-2">
                                <label className="flex items-center space-x-2 cursor-pointer group"><input type="checkbox" checked={riskFilters.critical} onChange={e => setRiskFilters(p => ({...p, critical: e.target.checked}))} className="rounded text-red-500 focus:ring-red-500 border-slate-300" /><span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Critical</span></label>
                                <label className="flex items-center space-x-2 cursor-pointer group"><input type="checkbox" checked={riskFilters.watchOut} onChange={e => setRiskFilters(p => ({...p, watchOut: e.target.checked}))} className="rounded text-amber-400 focus:ring-amber-400 border-slate-300" /><span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Watch Out</span></label>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col h-[500px] bg-white">
                        <div className="overflow-y-auto flex-1 relative scrollbar-thin scrollbar-thumb-slate-200">
                            {ganttData.length > 0 ? (
                                ganttData.map((row, idx) => (
                                    <div key={idx} className={`flex items-center border-b border-slate-50 h-14 group transition-all duration-200 ${selectedItem && selectedItem.itemCode === row.itemCode && selectedItem.invOrg === row.invOrg ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
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
                                                const colorClass = isCritical ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-200' : 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-amber-200';
                                                return (
                                                    <div key={bIdx} className={`absolute h-6 top-4 rounded-full shadow-md cursor-pointer group/bar transition-transform hover:scale-y-110 hover:z-10 ${colorClass} ${isCritical ? 'animate-pulse-slow' : ''}`} style={{...style, minWidth: '12px'}}>
                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/bar:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 shadow-xl">
                                                            <div className="font-bold flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-400' : 'bg-amber-400'}`}></div>{block.status}</div>
                                                            <div className="text-slate-300 mt-1">{block.days} Days Shortage</div>
                                                            <div className="text-slate-500 text-[10px] mt-1 font-mono pt-1 border-t border-slate-700">{block.start.toLocaleDateString()} - {block.end.toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : <EmptyState msg="No risks match the current filters." />}
                        </div>
                    </div>
                </div>

                {/* --- DETAIL VIEW (Floating Panel - Only for Risk Mode or General Info) --- */}
                {selectedItem && selectedItemData && viewMode === 'risk' && (
                    <div className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] transform transition-all duration-300 ease-in-out h-96 flex flex-col animate-in slide-in-from-bottom-10">
                        <div className="px-6 py-4 bg-white/50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="bg-indigo-100 p-2 rounded-lg"><Table className="w-5 h-5 text-indigo-600" /></div>
                                <div><h3 className="font-bold text-slate-900 text-lg tracking-tight">{selectedItem.itemCode}</h3><p className="text-xs text-slate-500 font-medium font-mono uppercase tracking-wider">{selectedItem.invOrg} — Detail View</p></div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors group"><X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" /></button>
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
            </main>
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
