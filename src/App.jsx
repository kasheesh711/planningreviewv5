import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';
import {
    Upload, Filter, Package, Calendar, ChevronDown, Search, Clock, ToggleLeft, ToggleRight, AlertTriangle, X, Table, SlidersHorizontal, ArrowUpDown, CheckSquare, Square, Share2, GitBranch, Eye, EyeOff, Sparkles
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
                if (!isNaN(value) && value !== '' && (header === 'Value' || header.includes('Qty'))) {
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
NR,RM,BAB250-MR1,THRYPM,MR,LM,NST(MTS),BAB250-MR1/THRYPM/MR/LM/NST(MTS),Indep. Req. (Forecast),0,12/17/2025,150
NR,RM,BAB250-MR1,THRYPM,MR,LM,NST(MTS),BAB250-MR1/THRYPM/MR/LM/NST(MTS),Tot.Inventory (Forecast),0,12/17/2025,100
NR,RM,BAB250-MR1,THRYPM,MR,LM,NST(MTS),BAB250-MR1/THRYPM/MR/LM/NST(MTS),Indep. Req. (Forecast),0,12/18/2025,150
NR,RM,BAB250-MR1,THRYPM,MR,LM,NST(MTS),BAB250-MR1/THRYPM/MR/LM/NST(MTS),Tot.Inventory (Forecast),0,12/18/2025,100`;

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
        <div className="relative" ref={wrapperRef}>
            <label className="block text-sm font-medium text-slate-500 mb-1">{label}</label>
            <button
                className="w-full bg-white rounded-lg border border-slate-300 px-3 py-2 text-sm flex items-center justify-between cursor-pointer hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                onClick={() => {
                    if (!isOpen) setSearchTerm("");
                    setIsOpen(!isOpen);
                }}
            >
                <span className="truncate block text-slate-700 max-w-[180px] text-left">{getDisplayText()}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white rounded-t-lg">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 py-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-slate-700 flex items-center justify-between ${value === opt || (multi && value.includes(opt)) ? 'bg-blue-50 font-medium text-blue-700' : ''}`}
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
                                            ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                            : <Square className="w-4 h-4 text-slate-300" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-slate-400 text-center">No results</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function SupplyChainDashboard() {
    const [rawData, setRawData] = useState([]);
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
    const [activePage, setActivePage] = useState('dashboard'); // dashboard | network
    
    // Interaction States
    const [selectedItem, setSelectedItem] = useState(null);
    const [hoveredDate, setHoveredDate] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    // Network Analysis
    const [networkMetric, setNetworkMetric] = useState('All');
    const [hideOrphans, setHideOrphans] = useState(false);
    const [networkFocus, setNetworkFocus] = useState('itemClass'); // itemClass | strategy

    // Risk/Gantt Filters
    const [riskFilters, setRiskFilters] = useState({
        critical: true,
        watchOut: true,
        minDays: 1
    });
    const [ganttSort, setGanttSort] = useState('itemCode'); // itemCode, leadTime, duration, planning

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

    useEffect(() => {
        if (activePage === 'network') {
            setSelectedItem(null);
        }
    }, [activePage]);

    const handleFileUpload = (event) => {
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

    // Global Filter Data
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

    // --- Chart Data (Updates with Selection) ---
    const chartData = useMemo(() => {
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
    }, [filteredData, filters.metric, selectedItem, rawData, dateRange]);

    // --- Gantt Data & Sorting ---
    const ganttData = useMemo(() => {
        const grouped = {};
        const today = new Date(); // For lead time calc

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
            if (ganttSort === 'itemCode') {
                return a.itemCode.localeCompare(b.itemCode);
            } else if (ganttSort === 'leadTime') {
                if (a.hasInsideLeadTimeRisk !== b.hasInsideLeadTimeRisk) {
                    return a.hasInsideLeadTimeRisk ? -1 : 1; 
                }
                return b.totalShortageDays - a.totalShortageDays;
            } else if (ganttSort === 'duration') {
                return b.totalShortageDays - a.totalShortageDays;
            } else if (ganttSort === 'planning') {
                return a.firstOutsideLeadTimeRiskDate - b.firstOutsideLeadTimeRiskDate;
            }
            return 0;
        });

        return rows;

    }, [filteredData, riskFilters, ganttSort]);


    // --- Selected Item Data ---
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
        if (filters.metric.includes('All')) {
            return Array.from(new Set(filteredData.map(d => d.Metric)));
        }
        return filters.metric;
    }, [filteredData, filters.metric]);

    const networkGraph = useMemo(() => {
        if (!filteredData.length) {
            return { nodes: [], links: [], nodeMap: new Map(), maxValue: 0, maxWeight: 1 };
        }

        const nodesMap = new Map();
        const metaMap = new Map();
        const linkAccumulator = new Map();

        const ensureNode = (id, data) => {
            if (!nodesMap.has(id)) {
                nodesMap.set(id, {
                    id,
                    label: data.label,
                    type: data.type,
                    invOrg: data.invOrg,
                    metricValue: 0,
                    metrics: {}
                });
            }
            return nodesMap.get(id);
        };

        filteredData.forEach(item => {
            const metricKey = item.Metric ? item.Metric.trim() : 'Value';
            if (networkMetric !== 'All' && metricKey !== networkMetric) return;

            const nodeId = `${item['Item Code']}|${item['Inv Org']}`;
            const node = ensureNode(nodeId, { label: item['Item Code'], type: item.Type || 'Item', invOrg: item['Inv Org'] });
            const numericVal = typeof item.Value === 'number' ? item.Value : parseFloat(item.Value) || 0;
            node.metricValue += numericVal;
            node.metrics[metricKey] = (node.metrics[metricKey] || 0) + numericVal;

            metaMap.set(nodeId, { factory: item.Factory, itemClass: item['Item Class'], strategy: item['Strategy'], type: item.Type });

            const dcId = `DC|${item['Inv Org']}`;
            ensureNode(dcId, { label: item['Inv Org'], type: 'DC', invOrg: item['Inv Org'] });

            const dcKey = `${nodeId}|${dcId}|dc`;
            const weight = Math.max(1, Math.abs(numericVal || 1));
            if (linkAccumulator.has(dcKey)) {
                linkAccumulator.get(dcKey).weight += weight;
            } else {
                linkAccumulator.set(dcKey, { source: nodeId, target: dcId, weight, reason: 'DC' });
            }
        });

        const groupings = {};
        metaMap.forEach((meta, id) => {
            const key = networkFocus === 'strategy' ? meta.strategy : meta.itemClass;
            if (!key) return;
            if (!groupings[key]) groupings[key] = [];
            groupings[key].push(id);
        });

        Object.entries(groupings).forEach(([key, ids]) => {
            const uniq = Array.from(new Set(ids));
            if (uniq.length < 2) return;
            const loopLength = Math.min(uniq.length, 8);
            for (let i = 0; i < loopLength; i++) {
                const source = uniq[i];
                const target = uniq[(i + 1) % loopLength];
                const linkKey = `${source}|${target}|bucket:${key}`;
                if (!linkAccumulator.has(linkKey)) {
                    linkAccumulator.set(linkKey, { source, target, weight: 0.8, reason: networkFocus === 'strategy' ? 'Strategy' : 'Item Class' });
                }
            }
        });

        let links = Array.from(linkAccumulator.values());
        const degree = {};
        links.forEach(l => {
            degree[l.source] = (degree[l.source] || 0) + 1;
            degree[l.target] = (degree[l.target] || 0) + 1;
        });

        let nodes = Array.from(nodesMap.values()).map(n => ({ ...n, degree: degree[n.id] || 0 }));
        if (hideOrphans) {
            const allowed = new Set(nodes.filter(n => n.degree > 0).map(n => n.id));
            nodes = nodes.filter(n => allowed.has(n.id));
            links = links.filter(l => allowed.has(l.source) && allowed.has(l.target));
        }

        const maxValue = nodes.reduce((m, n) => Math.max(m, Math.abs(n.metricValue)), 0);
        const maxWeight = links.reduce((m, l) => Math.max(m, l.weight || 1), 1);
        const width = 1000;
        const height = 640;

        const typePosition = (type) => {
            if (type === 'RM') return 0.25;
            if (type === 'FG') return 0.52;
            if (type === 'DC') return 0.78;
            return 0.6;
        };

        const hashString = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return hash;
        };

        const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

        const positionedNodes = nodes.map(node => {
            const hash = Math.abs(hashString(node.id));
            const angle = ((hash % 360) * Math.PI) / 180;
            const drift = 140 + (hash % 120);
            const lane = typePosition(node.type);

            let x = lane * width + Math.cos(angle) * (drift * 0.7);
            let y = (height / 2) + Math.sin(angle) * (drift * 0.5);
            x = clamp(x, 60, width - 60);
            y = clamp(y, 60, height - 60);

            const size = maxValue ? 10 + (Math.min(Math.abs(node.metricValue), maxValue) / maxValue) * 16 : 12;
            const palette = {
                RM: '#f97316',
                FG: '#3b82f6',
                DC: '#22c55e',
                Item: '#a855f7',
                Other: '#a855f7'
            };
            const color = palette[node.type] || palette.Other;

            return { ...node, x, y, radius: size, color };
        });

        const nodeMap = new Map();
        positionedNodes.forEach(n => nodeMap.set(n.id, n));
        const prunedLinks = links.filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));

        return { nodes: positionedNodes, links: prunedLinks, nodeMap, maxValue, maxWeight };
    }, [filteredData, networkMetric, hideOrphans, networkFocus]);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const resetFilters = () => {
        setIsLeadTimeMode(false);
        setFilters({ itemCode: 'All', invOrg: 'All', itemClass: 'All', uom: 'All', strategy: 'All', metric: ['All'] });
        setRiskFilters({ critical: true, watchOut: true, minDays: 1 });
        setSelectedItem(null);
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

    const Y_AXIS_WIDTH = 180; 

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
            <aside className="w-60 bg-slate-900 text-white flex flex-col shadow-2xl shadow-slate-900/30">
                <div className="px-5 pt-6 pb-4 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-500 p-2 rounded-lg">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-slate-300">Supply Chain</div>
                            <div className="font-semibold text-base">Analytics</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-2">
                    <button
                        onClick={() => setActivePage('dashboard')}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                            activePage === 'dashboard' ? 'bg-white/10 border-white/10 text-white shadow-sm' : 'border-transparent text-slate-200 hover:bg-white/5'
                        }`}
                    >
                        <div className="flex items-center space-x-3">
                            <Table className="w-4 h-4" />
                            <span className="text-sm font-medium">Dashboard</span>
                        </div>
                        {activePage === 'dashboard' && <span className="text-[10px] px-2 py-0.5 bg-white/20 rounded-full uppercase tracking-wide">Now</span>}
                    </button>

                    <button
                        onClick={() => setActivePage('network')}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                            activePage === 'network' ? 'bg-white/10 border-white/10 text-white shadow-sm' : 'border-transparent text-slate-200 hover:bg-white/5'
                        }`}
                    >
                        <div className="flex items-center space-x-3">
                            <GitBranch className="w-4 h-4" />
                            <span className="text-sm font-medium">Network Analysis</span>
                        </div>
                        {activePage === 'network' && <span className="text-[10px] px-2 py-0.5 bg-white/20 rounded-full uppercase tracking-wide">Now</span>}
                    </button>
                </nav>
                <div className="px-5 py-4 border-t border-white/10 text-xs text-slate-300">
                    <div className="flex items-start space-x-2">
                        <Sparkles className="w-4 h-4 text-amber-300 mt-0.5" />
                        <span>Use global filters to drive both views and keep the graph lean.</span>
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col pb-20">
                <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-600 p-2 rounded-lg">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Supply Chain Analytics</h1>
                                <p className="text-xs text-slate-500">{activePage === 'dashboard' ? 'Dashboard' : 'Network Analysis'}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <label className="flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors text-sm font-medium">
                                <Upload className="w-4 h-4 mr-2" />
                                Import CSV
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                    {activePage === 'dashboard' && (
                        <>
                            {/* Filters Container */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-2 text-slate-800">
                                        <Filter className="w-5 h-5 text-blue-600" />
                                        <h2 className="font-semibold text-lg">Global Filters</h2>
                                    </div>
                                    <button onClick={resetFilters} className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline">Reset All</button>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6 pb-6 border-b border-slate-100">
                                     <div className="lg:col-span-1 flex flex-col justify-end pb-1">
                                        <button
                                            onClick={() => setIsLeadTimeMode(!isLeadTimeMode)}
                                            className={`flex items-center justify-between w-full px-4 py-2 rounded-lg border transition-all ${isLeadTimeMode ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                        >
                                            <span className="text-sm font-medium flex items-center">
                                                <Clock className={`w-4 h-4 mr-2 ${isLeadTimeMode ? 'text-blue-600' : 'text-slate-400'}`} />
                                                Inside Lead Time ONLY
                                            </span>
                                            {isLeadTimeMode ? <ToggleRight className="w-6 h-6 text-blue-600" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                                        </button>
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="block text-sm font-medium text-slate-500 mb-1">Start Date</label>
                                        <input type="date" disabled={isLeadTimeMode} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="block text-sm font-medium text-slate-500 mb-1">End Date</label>
                                        <input type="date" disabled={isLeadTimeMode} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <SearchableSelect label="Chart Metrics Only" value={filters.metric} options={options.metrics} onChange={(val) => setFilters(prev => ({ ...prev, metric: val }))} multi={true} />
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

                            {/* Chart Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-2 relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {selectedItem ? `Trend: ${selectedItem.itemCode} (${selectedItem.invOrg})` : "Aggregate Trends"}
                                    </h2>
                                </div>
                                <div className="h-64 w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart 
                                                data={chartData} 
                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                onMouseMove={(e) => {
                                                    if (e && e.activeLabel) setHoveredDate(e.activeLabel);
                                                }}
                                                onMouseLeave={() => setHoveredDate(null)}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#64748b"
                                                    fontSize={12}
                                                    tickMargin={10}
                                                    tickFormatter={(str) => {
                                                        const date = new Date(str);
                                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                                    }}
                                                />
                                                <YAxis stroke="#64748b" fontSize={12} width={Y_AXIS_WIDTH - 20} />
                                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                                {hoveredDate && (
                                                    <ReferenceLine x={hoveredDate} stroke="#3b82f6" strokeDasharray="3 3" />
                                                )}
                                                <Legend />
                                                {activeMetrics.map((metric, index) => (
                                                    <Area
                                                        key={metric}
                                                        type="monotone"
                                                        dataKey={metric}
                                                        stroke={colors[index % colors.length]}
                                                        fill={colors[index % colors.length]}
                                                        fillOpacity={0.1}
                                                        strokeWidth={2}
                                                    />
                                                ))}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400">No data for chart</div>
                                    )}
                                </div>
                            </div>

                            {/* Gantt Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col mb-8">
                                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-t-xl">
                                    <div className="flex items-center space-x-2">
                                        <AlertTriangle className="w-5 h-5 text-slate-800" />
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">Risk Monitor</h2>
                                            <p className="text-xs text-slate-500">Visual timeline of critical events</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                        {/* Sorting Dropdown */}
                                        <div className="flex items-center space-x-2 border-r border-slate-200 pr-4">
                                            <ArrowUpDown className="w-4 h-4 text-slate-400" />
                                            <select 
                                                className="text-sm border-none focus:ring-0 text-slate-700 font-medium cursor-pointer bg-transparent"
                                                value={ganttSort}
                                                onChange={(e) => setGanttSort(e.target.value)}
                                            >
                                                <option value="itemCode">Sort by Name</option>
                                                <option value="leadTime">Inside Lead Time First</option>
                                                <option value="duration">Shortage Duration</option>
                                                <option value="planning">Planning Priority (Outside LT)</option>
                                            </select>
                                        </div>

                                        {/* Min Days Input */}
                                         <div className="flex items-center space-x-2 border-r border-slate-200 pr-4">
                                            <label className="text-xs text-slate-500 font-medium">Min Consec. Days:</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={riskFilters.minDays}
                                                onChange={(e) => setRiskFilters(p => ({...p, minDays: parseInt(e.target.value) || 1}))}
                                            />
                                        </div>

                                        <label className="flex items-center space-x-2 cursor-pointer text-sm select-none">
                                            <input type="checkbox" checked={riskFilters.critical} onChange={e => setRiskFilters(p => ({...p, critical: e.target.checked}))} className="rounded text-red-600 focus:ring-red-500" />
                                            <span className="text-slate-700 flex items-center font-medium"><div className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></div>Critical</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer text-sm select-none">
                                            <input type="checkbox" checked={riskFilters.watchOut} onChange={e => setRiskFilters(p => ({...p, watchOut: e.target.checked}))} className="rounded text-yellow-500 focus:ring-yellow-500" />
                                            <span className="text-slate-700 flex items-center font-medium"><div className="w-2 h-2 rounded-full bg-yellow-400 mr-1.5"></div>Watch Out</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex flex-col h-[500px]">
                                    <div className="overflow-y-auto flex-1 relative">
                                        {ganttData.length > 0 ? (
                                            ganttData.map((row, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`flex items-center border-b border-slate-100 h-12 group transition-colors ${
                                                        selectedItem && selectedItem.itemCode === row.itemCode && selectedItem.invOrg === row.invOrg 
                                                        ? 'bg-blue-50 border-blue-200' 
                                                        : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div 
                                                        className="flex-shrink-0 px-4 py-2 border-r border-slate-100 truncate cursor-pointer"
                                                        style={{ width: Y_AXIS_WIDTH }}
                                                        onClick={() => setSelectedItem(row)}
                                                    >
                                                        <div className="font-bold text-slate-700 text-sm truncate group-hover:text-blue-600">{row.itemCode}</div>
                                                        <div className="text-xs text-slate-400">{row.invOrg}</div>
                                                    </div>

                                                    <div 
                                                        className="flex-1 relative h-full cursor-pointer"
                                                        style={{ marginLeft: '20px', marginRight: '30px' }}
                                                        onClick={() => setSelectedItem(row)}
                                                    >
                                                        <div className="absolute inset-0 flex opacity-50">
                                                            <div className="w-1/4 border-r border-slate-50 h-full"></div>
                                                            <div className="w-1/4 border-r border-slate-50 h-full"></div>
                                                            <div className="w-1/4 border-r border-slate-50 h-full"></div>
                                                        </div>

                                                        {row.blocks.map((block, bIdx) => {
                                                            const style = getGanttStyles(block.start, block.end);
                                                            const colorClass = block.status === 'Critical' ? 'bg-red-500/90 border border-red-600' : 'bg-yellow-400/90 border border-yellow-500';
                                                            return (
                                                                <div 
                                                                    key={bIdx}
                                                                    className={`absolute h-5 top-3.5 rounded-sm shadow-sm cursor-pointer group/bar ${colorClass}`}
                                                                    style={style}
                                                                >
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover/bar:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50 shadow-xl">
                                                                        <div className="font-bold">{block.status}</div>
                                                                        <div>{block.days} Days</div>
                                                                        <div className="text-slate-400 text-[10px]">{block.start.toLocaleDateString()} - {block.end.toLocaleDateString()}</div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                                <CheckSquare className="w-10 h-10 mb-2 text-slate-300" />
                                                <p>No risks match the current filters.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activePage === 'network' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                                            <Share2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">Network Analysis</h2>
                                            <p className="text-sm text-slate-500">Obsidian-style graph of RM, FG, and DC relationships.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm text-slate-500">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span>{networkGraph.nodes.length} nodes</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span>{networkGraph.links.length} links</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Metric to relate</label>
                                        <select
                                            value={networkMetric}
                                            onChange={(e) => setNetworkMetric(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            {options.metrics.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">Weights nodes/edges using the selected metric.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Linking dimension</label>
                                        <select
                                            value={networkFocus}
                                            onChange={(e) => setNetworkFocus(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="itemClass">Item Class clusters</option>
                                            <option value="strategy">Strategy clusters</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">Connects like items to mimic the Obsidian brain web.</p>
                                    </div>
                                    <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">Hide orphan nodes</p>
                                            <p className="text-xs text-slate-500">Filter out items with no ties</p>
                                        </div>
                                        <button
                                            onClick={() => setHideOrphans(!hideOrphans)}
                                            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 transition-colors"
                                            title="Toggle orphans"
                                        >
                                            {hideOrphans ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950" />
                                <div className="absolute -left-32 -top-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                                <div className="absolute -right-32 -bottom-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                                <div className="relative px-6 py-4 flex items-center justify-between border-b border-slate-800">
                                    <div className="flex items-center space-x-3 text-white">
                                        <GitBranch className="w-5 h-5" />
                                        <div>
                                            <p className="text-sm font-semibold">Network Brain</p>
                                            <p className="text-xs text-slate-400">Connections across RM, FG, and DC nodes</p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {networkMetric === 'All' ? 'All metrics' : networkMetric} · {hideOrphans ? 'Orphans hidden' : 'All nodes'}
                                    </div>
                                </div>
                                <div className="relative">
                                    <svg viewBox="0 0 1000 640" className="w-full h-[620px]">
                                        <defs>
                                            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.6" />
                                                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.4" />
                                            </linearGradient>
                                        </defs>
                                        {networkGraph.links.map((link, idx) => {
                                            const source = networkGraph.nodeMap.get(link.source);
                                            const target = networkGraph.nodeMap.get(link.target);
                                            if (!source || !target) return null;
                                            const strokeWidth = 0.8 + (link.weight / networkGraph.maxWeight) * 2.5;
                                            const opacity = link.reason === 'DC' ? 0.45 : 0.25;
                                            return (
                                                <line
                                                    key={`${link.source}-${link.target}-${idx}`}
                                                    x1={source.x}
                                                    y1={source.y}
                                                    x2={target.x}
                                                    y2={target.y}
                                                    stroke="url(#edgeGrad)"
                                                    strokeWidth={strokeWidth}
                                                    strokeOpacity={opacity}
                                                />
                                            );
                                        })}
                                        {networkGraph.nodes.map(node => (
                                            <g
                                                key={node.id}
                                                onMouseEnter={() => setHoveredNode(node)}
                                                onMouseMove={() => setHoveredNode(node)}
                                                onMouseLeave={() => setHoveredNode(null)}
                                                className="cursor-pointer transition-transform duration-150"
                                            >
                                                <circle cx={node.x} cy={node.y} r={node.radius + 6} fill={node.color} fillOpacity="0.12" />
                                                <circle cx={node.x} cy={node.y} r={node.radius} fill={node.color} stroke="#0f172a" strokeWidth="1.5" />
                                                <text
                                                    x={node.x}
                                                    y={node.y + node.radius + 12}
                                                    textAnchor="middle"
                                                    className="text-[10px] uppercase tracking-wide"
                                                    fill="#cdd6f4"
                                                >
                                                    {node.label}
                                                </text>
                                            </g>
                                        ))}
                                    </svg>

                                    {hoveredNode && (
                                        <div
                                            className="absolute pointer-events-none bg-white text-slate-800 text-xs rounded-lg shadow-xl px-3 py-2"
                                            style={{
                                                left: `${(hoveredNode.x / 1000) * 100}%`,
                                                top: `${(hoveredNode.y / 640) * 100}%`,
                                                transform: 'translate(-50%, -120%)'
                                            }}
                                        >
                                            <div className="font-semibold text-sm text-slate-900 flex items-center space-x-2">
                                                <span>{hoveredNode.label}</span>
                                                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{hoveredNode.type}</span>
                                            </div>
                                            <div className="text-slate-500 mt-1">Inv Org: {hoveredNode.invOrg || 'n/a'}</div>
                                            <div className="text-slate-500">Metric total: {hoveredNode.metricValue !== 0 ? hoveredNode.metricValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</div>
                                            <div className="flex space-x-2 mt-2">
                                                <span className="text-[10px] font-medium text-slate-600">Degree {hoveredNode.degree}</span>
                                                <span className="text-[10px] font-medium text-slate-600">{hoveredNode.metrics ? Object.keys(hoveredNode.metrics).length : 0} metrics</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Legend</h3>
                                    <div className="space-y-2 text-sm text-slate-600">
                                        <div className="flex items-center space-x-2">
                                            <span className="w-3 h-3 rounded-full bg-[#f97316]" />
                                            <span>Raw Material (RM)</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                                            <span>Finished Good (FG)</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
                                            <span>Distribution Center (DC)</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="w-3 h-3 rounded-full bg-[#a855f7]" />
                                            <span>Other / Unknown type</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Filters in play</h3>
                                    <p className="text-sm text-slate-600">Metric: <span className="font-semibold text-slate-800">{networkMetric}</span></p>
                                    <p className="text-sm text-slate-600">Linking by <span className="font-semibold text-slate-800">{networkFocus === 'strategy' ? 'Strategy' : 'Item Class'}</span></p>
                                    <p className="text-sm text-slate-600 mt-2">Global filters stay active; change them on the Dashboard tab.</p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Tips</h3>
                                    <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                                        <li>Toggle orphans to surface only connected assets.</li>
                                        <li>Switch metrics to resize/weight nodes by that signal.</li>
                                        <li>Use strategy vs item-class linking to change graph shape.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {activePage === 'dashboard' && selectedItem && selectedItemData && (
                    <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t shadow-2xl transform transition-transform duration-300 ease-in-out h-96 flex flex-col">
                        <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Table className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">{selectedItem.itemCode}</h3>
                                    <p className="text-xs text-slate-500">{selectedItem.invOrg} — {selectedItemData.dates.length} Days Visible</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left border-collapse relative">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 border-b bg-slate-50 left-0 sticky z-20 border-r w-48 shadow-sm">Metric</th>
                                        {selectedItemData.dates.map(dateStr => {
                                            const d = new Date(dateStr);
                                            return (
                                                <th 
                                                    key={dateStr} 
                                                    className={`px-2 py-3 border-b text-center min-w-[60px] font-medium transition-colors cursor-default ${hoveredDate === dateStr ? 'bg-blue-100 text-blue-700' : ''}`}
                                                    onMouseEnter={() => setHoveredDate(dateStr)}
                                                    onMouseLeave={() => setHoveredDate(null)}
                                                >
                                                    {d.getMonth() + 1}/{d.getDate()}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedItemData.metrics.map(metric => (
                                        <tr key={metric} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-4 py-2 font-medium text-slate-700 sticky left-0 bg-white border-r z-10 text-xs truncate max-w-[200px]" title={metric}>
                                                {metric}
                                            </td>
                                            {selectedItemData.dates.map(dateStr => {
                                                const val = selectedItemData.values[metric]?.[dateStr];
                                                let cellClass = "text-slate-500";
                                                if (metric === 'Tot.Inventory (Forecast)' && val < 0) cellClass = "text-red-600 font-bold bg-red-50";
                                                else if (val > 0) cellClass = "text-slate-800 font-medium";

                                                return (
                                                    <td 
                                                        key={dateStr} 
                                                        className={`px-2 py-2 text-right border-r border-slate-50 transition-colors ${cellClass} ${hoveredDate === dateStr ? 'bg-blue-50' : ''}`}
                                                        onMouseEnter={() => setHoveredDate(dateStr)}
                                                        onMouseLeave={() => setHoveredDate(null)}
                                                    >
                                                        {val !== undefined ? val.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
