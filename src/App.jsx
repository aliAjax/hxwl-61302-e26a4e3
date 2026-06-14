import { Fragment, useMemo, useState, useRef, useEffect } from 'react';
import { Sprout, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, BookOpen, ChevronDown, ChevronUp, ArrowRight, FileText, Calculator, Droplets, Beaker, Scale, Info, RefreshCw, GitCompareArrows, Grid3X3, Flower2, X, Layers, Archive, ShieldAlert, TrendingDown, TrendingUp, Copy, Download, Upload, Database, HardDriveUpload, HardDriveDownload, Calendar, FlaskConical, Leaf, Eye, CheckCircle, History, LeafyGreen, Bug, Activity, Building2, Settings, Pencil, ChevronRight, Save } from 'lucide-react';
import './App.css';
import { recipeTemplates, cropOptions, cropStageRanges, getAllTemplates, addCustomTemplate, deleteCustomTemplate, getAllCropOptions, loadCustomTemplates, saveCustomTemplates } from './recipeTemplates';
import RecipeCalendar from './RecipeCalendar';
import {
  exportGreenhouseData,
  exportFullBackup,
  downloadJSON,
  generateExportFilename,
  parseImportFile,
  validateImportData,
  applyImportMode,
  EXPORT_TYPES,
  IMPORT_MODES,
  detectImportType,
} from './dataImportExport';
import {
  loadMultiGreenhouseState,
  saveMultiGreenhouseState,
  createGreenhouse,
  renameGreenhouse,
  deleteGreenhouse,
  setActiveGreenhouse,
  getGreenhouseData,
  saveGreenhouseData,
  copyRecipeToGreenhouse,
  createEmptyGreenhouseData,
  ensureVersions
} from './greenhouseManager';

const appConfig = {
  "id": "hxwl-61302",
  "port": 61302,
  "title": "温室营养液配方管理",
  "subtitle": "作物生长期配方、历史版本与复制调整闭环",
  "domain": "温室种植",
  "icon": "Sprout",
  "storage": "hxwl-61302-greenhouse-nutrient",
  "accent": "#15803d",
  "statuses": [
    "试配",
    "使用中",
    "已归档"
  ],
  "primaryStatus": "试配",
  "fields": [
    {
      "key": "crop",
      "label": "作物",
      "type": "input",
      "placeholder": "番茄",
      "options": []
    },
    {
      "key": "stage",
      "label": "生长期",
      "type": "select",
      "placeholder": "开花期",
      "options": [
        "育苗期",
        "营养生长期",
        "开花期",
        "结球期",
        "结果期"
      ]
    },
    {
      "key": "ec",
      "label": "EC",
      "type": "number",
      "placeholder": "2.2",
      "options": []
    },
    {
      "key": "ph",
      "label": "pH",
      "type": "number",
      "placeholder": "5.8",
      "options": []
    },
    {
      "key": "npk",
      "label": "氮磷钾比例",
      "type": "input",
      "placeholder": "15-5-30",
      "options": []
    },
    {
      "key": "memo",
      "label": "配方备注",
      "type": "textarea",
      "placeholder": "高钾配方，夜温低时降低浓度",
      "options": []
    }
  ],
  "seed": [
    {
      "crop": "番茄",
      "stage": "开花期",
      "ec": "2.2",
      "ph": "5.8",
      "npk": "15-5-30",
      "memo": "高钾配方，夜温低时降低浓度",
      "status": "使用中"
    },
    {
      "crop": "生菜",
      "stage": "营养生长期",
      "ec": "1.4",
      "ph": "6.0",
      "npk": "8-15-36",
      "memo": "适合水培槽第3周",
      "status": "试配"
    },
    {
      "crop": "草莓",
      "stage": "结果期",
      "ec": "1.8",
      "ph": "5.7",
      "npk": "12-6-28",
      "memo": "补钙镁，观察叶缘",
      "status": "已归档"
    }
  ],
  "metrics": [
    [
      "作物数",
      "new Set(records.map((item) => item.crop)).size"
    ],
    [
      "使用中",
      "records.filter((item) => item.status === '使用中').length"
    ],
    [
      "平均EC",
      "avg(records.map((item) => Number(item.ec))).toFixed(1)"
    ]
  ],
  "filters": [
    {
      "key": "query",
      "label": "作物搜索",
      "type": "search",
      "match": "(item.crop || '').includes(filters.query)"
    },
    {
      "key": "status",
      "label": "配方状态",
      "type": "status"
    }
  ],
  "cardTitle": "item.crop",
  "cardMeta": "`${item.stage} · EC ${item.ec} · pH ${item.ph}`",
  "cardDetail": "`${item.npk}｜${item.memo}`",
  "action": "copyRecipe",
  "note": "复制某个配方后可以作为新版本继续编辑。",
  "defaultValues": {
    "crop": "番茄",
    "stage": "开花期",
    "ec": "2.2",
    "ph": "5.8",
    "npk": "15-5-30",
    "memo": "高钾配方，夜温低时降低浓度",
    "status": "试配"
  }
};

const today = new Date().toISOString().slice(0, 10);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds(items) {
  return ensureVersions(items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item })));
}

function loadLegacySeed() {
  return withIds(appConfig.seed);
}

const TRIAL_STATUSES = ['试配中', '观察中', '已采用', '已归档'];

const LEAF_COLOR_OPTIONS = ['浓绿', '翠绿', '浅绿', '黄绿', '黄化', '紫红叶', '白化'];
const GROWTH_OPTIONS = ['健壮旺盛', '生长正常', '长势偏弱', '徒长', '僵苗'];
const ROOT_OPTIONS = ['根系发达白根多', '根系正常', '根少色黄', '烂根黑根', '沤根'];
const YIELD_ESTIMATE_OPTIONS = ['远超预期', '优于预期', '符合预期', '低于预期', '严重减产'];

function avg(numbers) {
  const valid = numbers.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function money(value) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}

function inNextDays(dateText, days) {
  if (!dateText) return false;
  const date = new Date(dateText);
  const now = new Date(today);
  const diff = (date.getTime() - now.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function latestTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps[temps.length - 1];
}

function hasHotTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps.some((value) => Number(value) > 2);
}

function priorityRank(value) {
  return { 危急: 0, 加急: 1, 常规: 2, 高: 0, 中: 1, 低: 2 }[value] ?? 9;
}

function hasOverlap(target, records) {
  if (!target.bed || !target.date || !target.start || !target.end) return false;
  return records.some((item) => item.id !== target.id && item.bed === target.bed && item.date === target.date && target.start < item.end && target.end > item.start);
}

function statusClass(status) {
  const index = appConfig.statuses.indexOf(status);
  return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
}

function App() {
  const [ghState, setGhState] = useState(loadMultiGreenhouseState);
  const activeGhId = ghState.activeGreenhouseId;
  const activeGreenhouse = ghState.greenhouses[activeGhId];
  const greenhouses = Object.values(ghState.greenhouses);

  const ghData = useMemo(() => getGreenhouseData(ghState, activeGhId), [ghState, activeGhId]);

  const [records, setRecords] = useState(ghData.records);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(true);
  const [templateCrop, setTemplateCrop] = useState('全部');
  const [adjRecords, setAdjRecords] = useState(ghData.adjRecords);
  const [adjForm, setAdjForm] = useState({ sourceId: '', reason: '', adjustments: '', observations: '' });
  const [adjFilters, setAdjFilters] = useState({ crop: '全部', stage: '全部' });
  const [adjFormVisible, setAdjFormVisible] = useState(false);

  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ startDate: '', endDate: '' });

  const [calcForm, setCalcForm] = useState({
    waterVolume: '100',
    stockMultiplier: '100',
    targetEc: '1.8',
    npkRatio: '15-5-30'
  });
  const [calcResult, setCalcResult] = useState(null);
  const [calcNote, setCalcNote] = useState('');

  const [cmpCrop, setCmpCrop] = useState('全部');
  const [cmpStage, setCmpStage] = useState('全部');
  const [cmpLeft, setCmpLeft] = useState('');
  const [cmpRight, setCmpRight] = useState('');

  const [crossCmpGhLeft, setCrossCmpGhLeft] = useState('');
  const [crossCmpGhRight, setCrossCmpGhRight] = useState('');
  const [crossCmpCrop, setCrossCmpCrop] = useState('全部');
  const [crossCmpStage, setCrossCmpStage] = useState('全部');

  const [boardFilter, setBoardFilter] = useState({ crop: null, stage: null });
  const [warningFilter, setWarningFilter] = useState({ crop: '全部', severity: '全部' });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importFileInfo, setImportFileInfo] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importMode, setImportMode] = useState(IMPORT_MODES.MERGE_CURRENT);
  const [importTargetGhId, setImportTargetGhId] = useState('');
  const [importSourceGhId, setImportSourceGhId] = useState('');
  const [importNewGhName, setImportNewGhName] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState(EXPORT_TYPES.GREENHOUSE_DATA);
  const importFileInputRef = useRef(null);

  const [trials, setTrials] = useState(ghData.trials);
  const [observations, setObservations] = useState(ghData.observations);
  const [selectedTrial, setSelectedTrial] = useState(null);
  const [trialForm, setTrialForm] = useState({ recipeId: '', goal: '', initialMemo: '' });
  const [trialFormVisible, setTrialFormVisible] = useState(false);
  const [obsForm, setObsForm] = useState({
    trialId: '', date: today, leafColor: '', growth: '', rootSystem: '',
    yieldEstimate: '', anomaly: '', memo: ''
  });
  const [obsFormVisible, setObsFormVisible] = useState(false);
  const [trialFilters, setTrialFilters] = useState({ crop: '全部', status: '全部' });
  const [adoptModalOpen, setAdoptModalOpen] = useState(false);
  const [adoptTrialId, setAdoptTrialId] = useState(null);

  const [ghManagerOpen, setGhManagerOpen] = useState(false);
  const [ghRenameId, setGhRenameId] = useState(null);
  const [ghRenameName, setGhRenameName] = useState('');
  const [ghNewName, setGhNewName] = useState('');
  const [copyRecipeModalOpen, setCopyRecipeModalOpen] = useState(false);
  const [copyRecipeTarget, setCopyRecipeTarget] = useState(null);
  const [copyTargetGhId, setCopyTargetGhId] = useState('');

  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [saveTemplateForm, setSaveTemplateForm] = useState({ name: '', crop: '', stage: '' });
  const [customTemplatesVersion, setCustomTemplatesVersion] = useState(0);

  const boardStages = ['育苗期', '营养生长期', '开花期', '结果期'];

  useEffect(() => {
    setRecords(ghData.records);
    setAdjRecords(ghData.adjRecords);
    setTrials(ghData.trials);
    setObservations(ghData.observations);
    setSelected(null);
    setSelectedTrial(null);
    setBoardFilter({ crop: null, stage: null });
    setFilters({ query: '', status: '全部' });
  }, [ghData]);

  function persistAll(nextRecords, nextAdj, nextTrials, nextObs) {
    const finalRecords = ensureVersions(nextRecords || records);
    const data = {
      records: finalRecords,
      adjRecords: nextAdj || adjRecords,
      trials: nextTrials || trials,
      observations: nextObs || observations
    };
    setRecords(data.records);
    setAdjRecords(data.adjRecords);
    setTrials(data.trials);
    setObservations(data.observations);
    const nextState = saveGreenhouseData(ghState, activeGhId, data);
    setGhState(nextState);
  }

  function persist(next) {
    persistAll(next, adjRecords, trials, observations);
  }

  function persistAdj(next) {
    persistAll(records, next, trials, observations);
  }

  function persistTrials(next) {
    persistAll(records, adjRecords, next, observations);
  }

  function persistObservations(next) {
    persistAll(records, adjRecords, trials, next);
  }

  function handleSwitchGreenhouse(ghId) {
    if (ghId === activeGhId) return;
    const nextState = setActiveGreenhouse(ghId);
    setGhState(nextState);
  }

  function handleCreateGreenhouse() {
    const name = ghNewName.trim() || `温室 ${greenhouses.length + 1} 号`;
    const nextState = createGreenhouse(name);
    setGhState(nextState);
    setGhNewName('');
  }

  function handleRenameGreenhouse(ghId) {
    const name = ghRenameName.trim();
    if (!name) return;
    const nextState = renameGreenhouse(ghId, name);
    setGhState(nextState);
    setGhRenameId(null);
    setGhRenameName('');
  }

  function handleDeleteGreenhouse(ghId) {
    if (greenhouses.length <= 1) return;
    const gh = ghState.greenhouses[ghId];
    if (!confirm(`确定要删除温室「${gh?.name}」吗？该温室的所有配方数据将被永久删除。`)) return;
    const nextState = deleteGreenhouse(ghId);
    setGhState(nextState);
  }

  function openCopyRecipeModal(recipe) {
    setCopyRecipeTarget(recipe);
    const otherGhs = greenhouses.filter((g) => g.id !== activeGhId);
    setCopyTargetGhId(otherGhs.length > 0 ? otherGhs[0].id : '');
    setCopyRecipeModalOpen(true);
  }

  function handleCopyRecipeToGreenhouse() {
    if (!copyRecipeTarget || !copyTargetGhId) return;
    const nextState = copyRecipeToGreenhouse(ghState, activeGhId, copyTargetGhId, copyRecipeTarget, '试配');
    setGhState(nextState);
    const targetGh = nextState.greenhouses[copyTargetGhId];
    alert(`已将配方复制到温室「${targetGh?.name}」作为试配版本。`);
    setCopyRecipeModalOpen(false);
    setCopyRecipeTarget(null);
    setCopyTargetGhId('');
  }

  const boardData = useMemo(() => {
    const result = {};
    cropOptions.forEach((crop) => {
      result[crop] = {};
      boardStages.forEach((stage) => {
        const groupRecipes = records.filter((r) => r.crop === crop && r.stage === stage);
        const inUse = groupRecipes.filter((r) => r.status === '使用中').sort((a, b) => (b.version || 0) - (a.version || 0));
        const trial = groupRecipes.filter((r) => r.status === '试配');
        const archived = groupRecipes.filter((r) => r.status === '已归档');
        result[crop][stage] = {
          recipes: groupRecipes,
          inUse: inUse[0] || null,
          inUseCount: inUse.length,
          trialCount: trial.length,
          archivedCount: archived.length,
          total: groupRecipes.length
        };
      });
    });
    return result;
  }, [records]);

  const warningList = useMemo(() => {
    const warnings = [];
    records.forEach((item) => {
      const key = `${item.crop}||${item.stage}`;
      const range = cropStageRanges[key];
      if (!range) return;
      const ec = Number(item.ec);
      const ph = Number(item.ph);
      const issues = [];
      if (Number.isFinite(ec) && ec > range.ecMax) {
        issues.push({ field: 'EC', value: ec, limit: range.ecMax, direction: 'high', suggestion: `EC 偏高（当前 ${ec}，推荐上限 ${range.ecMax}），建议降低 EC 浓度，防止烧苗或盐害` });
      }
      if (Number.isFinite(ec) && ec < range.ecMin) {
        issues.push({ field: 'EC', value: ec, limit: range.ecMin, direction: 'low', suggestion: `EC 偏低（当前 ${ec}，推荐下限 ${range.ecMin}），建议提高 EC 浓度，确保营养供应充足` });
      }
      if (Number.isFinite(ph) && ph > range.phMax) {
        issues.push({ field: 'pH', value: ph, limit: range.phMax, direction: 'high', suggestion: `pH 偏高（当前 ${ph}，推荐上限 ${range.phMax}），建议降低 pH，防止微量元素沉淀吸收障碍` });
      }
      if (Number.isFinite(ph) && ph < range.phMin) {
        issues.push({ field: 'pH', value: ph, limit: range.phMin, direction: 'low', suggestion: `pH 偏低（当前 ${ph}，推荐下限 ${range.phMin}），建议提高 pH，防止酸害和根系受损` });
      }
      if (issues.length > 0) {
        warnings.push({ record: item, issues, range, severity: issues.some((i) => i.direction === 'high' && i.field === 'EC') ? 'high' : 'medium' });
      }
    });
    return warnings.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
    });
  }, [records]);

  const filteredWarnings = useMemo(() => {
    return warningList
      .filter((w) => warningFilter.crop === '全部' || w.record.crop === warningFilter.crop)
      .filter((w) => warningFilter.severity === '全部' || w.severity === warningFilter.severity);
  }, [warningList, warningFilter]);

  const warningCropOptions = useMemo(() => [...new Set(records.map((r) => r.crop))], [records]);

  function handleBoardCellClick(crop, stage) {
    const cell = boardData[crop]?.[stage];
    setBoardFilter({ crop, stage });
    setFilters({ ...filters, query: '', status: '全部' });
    if (cell?.inUse) {
      setSelected(cell.inUse);
    } else if (cell?.recipes.length > 0) {
      const latest = cell.recipes.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
      setSelected(latest);
    } else {
      const template = recipeTemplates.find((t) => t.crop === crop && t.stage === stage);
      if (template) {
        setForm({
          ...form,
          crop: template.crop,
          stage: template.stage,
          ec: template.ec,
          ph: template.ph,
          npk: template.npk,
          memo: template.memo,
          status: appConfig.primaryStatus
        });
      } else {
        setForm({
          ...form,
          crop,
          stage,
          status: appConfig.primaryStatus
        });
      }
      setSelected(null);
    }
  }

  function clearBoardFilter() {
    setBoardFilter({ crop: null, stage: null });
  }

  function applyTemplate(template) {
    setForm({
      ...form,
      crop: template.crop,
      stage: template.stage,
      ec: template.ec,
      ph: template.ph,
      npk: template.npk,
      memo: template.memo,
      status: form.status || appConfig.primaryStatus
    });
  }

  const allCropOptions = useMemo(() => getAllCropOptions(), [customTemplatesVersion]);

  const filteredTemplates = useMemo(() => {
    const allTpls = getAllTemplates();
    return allTpls.filter((t) => templateCrop === '全部' || t.crop === templateCrop);
  }, [templateCrop, customTemplatesVersion]);

  function openSaveTemplateModal() {
    setSaveTemplateForm({
      name: form.crop && form.stage ? `${form.crop} · ${form.stage}` : '',
      crop: form.crop || '',
      stage: form.stage || ''
    });
    setSaveTemplateModalOpen(true);
  }

  function handleSaveTemplate(event) {
    event.preventDefault();
    if (!saveTemplateForm.name.trim() || !saveTemplateForm.crop.trim() || !saveTemplateForm.stage.trim()) {
      alert('请填写模板名称、作物和生长期');
      return;
    }
    const newTemplate = {
      name: saveTemplateForm.name.trim(),
      crop: saveTemplateForm.crop.trim(),
      stage: saveTemplateForm.stage.trim(),
      ec: form.ec || '',
      ph: form.ph || '',
      npk: form.npk || '',
      memo: form.memo || ''
    };
    addCustomTemplate(newTemplate);
    setCustomTemplatesVersion((v) => v + 1);
    setSaveTemplateModalOpen(false);
    alert('自定义模板已保存！');
  }

  function handleDeleteCustomTemplate(templateId, templateName) {
    if (!confirm(`确定要删除自定义模板「${templateName}」吗？此操作不可恢复。`)) return;
    deleteCustomTemplate(templateId);
    setCustomTemplatesVersion((v) => v + 1);
  }

  function addRecord(event) {
    event.preventDefault();
    const sameGroup = records.filter((r) => r.crop === form.crop && r.stage === form.stage);
    const nextVer = sameGroup.length > 0 ? Math.max(...sameGroup.map((r) => r.version || 0)) + 1 : 1;
    const nextRecord = {
      id: uid(),
      ...form,
      version: nextVer,
      status: form.status || appConfig.primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入' }]
    };

    if (appConfig.conflict === 'date-slot' && records.some((item) => item.date === nextRecord.date && item.slot === nextRecord.slot)) {
      nextRecord.conflict = true;
    }
    if (appConfig.conflict === 'bed-time' && hasOverlap(nextRecord, records)) {
      nextRecord.conflict = true;
    }
    if (appConfig.chart) {
      const temp = Number(nextRecord.temperature || 0);
      nextRecord.temps = [temp];
      if (temp > 2) nextRecord.status = '异常';
    }

    persist([nextRecord, ...records]);
    setForm(appConfig.defaultValues);
    setSelected(nextRecord);
  }

  function updateStatus(id, status) {
    const next = records.map((item) => item.id === id ? {
      ...item,
      status,
      timeline: [...(item.timeline || []), { status, at: today, by: '操作员' }]
    } : item);
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function updateSchedule(id, startDate, endDate) {
    const next = records.map((item) => item.id === id ? {
      ...item,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    } : item);
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function handleSaveSchedule() {
    if (selected) {
      updateSchedule(selected.id, scheduleForm.startDate, scheduleForm.endDate);
      setScheduleFormOpen(false);
    }
  }

  function handleClearSchedule() {
    if (selected) {
      updateSchedule(selected.id, '', '');
      setScheduleFormOpen(false);
    }
  }

  function handleOpenSchedule(recipe) {
    setSelected(recipe);
    setScheduleForm({
      startDate: recipe.startDate || '',
      endDate: recipe.endDate || ''
    });
    setScheduleFormOpen(true);
  }

  function removeRecord(id) {
    const next = records.filter((item) => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(null);
  }

  function duplicateRecord(item) {
    const sameGroup = records.filter((r) => r.crop === item.crop && r.stage === item.stage);
    const nextVer = sameGroup.length > 0 ? Math.max(...sameGroup.map((r) => r.version || 0)) + 1 : 1;
    const copied = { ...item, id: uid(), version: nextVer, status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] };
    persist([copied, ...records]);
    setSelected(copied);
  }

  function addTemperature(item) {
    const value = Number(prompt('录入新的温度读数'));
    if (!Number.isFinite(value)) return;
    const next = records.map((record) => record.id === item.id ? {
      ...record,
      temps: [...(record.temps || []), value],
      temperature: String(value),
      status: value > 2 ? '异常' : record.status
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === item.id));
  }

  function trialStatusClass(status) {
    const index = TRIAL_STATUSES.indexOf(status);
    return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
  }

  function getRecipeTrial(recipeId) {
    return trials.find((t) => t.recipeId === recipeId) || null;
  }

  function getTrialObservations(trialId) {
    return observations
      .filter((o) => o.trialId === trialId)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  function createTrial(event) {
    event.preventDefault();
    if (!trialForm.recipeId) return;
    const recipe = records.find((r) => r.id === trialForm.recipeId);
    if (!recipe) return;

    const newTrial = {
      id: uid(),
      recipeId: trialForm.recipeId,
      crop: recipe.crop,
      stage: recipe.stage,
      goal: trialForm.goal || '试验新配方',
      initialMemo: trialForm.initialMemo || '',
      status: '试配中',
      adoptedRecipeId: null,
      createdAt: new Date().toISOString(),
      timeline: [{ status: '试配中', at: today, by: '创建试验' }]
    };
    persistTrials([newTrial, ...trials]);
    setTrialForm({ recipeId: '', goal: '', initialMemo: '' });
    setTrialFormVisible(false);
    setSelectedTrial(newTrial);
  }

  function updateTrialStatus(trialId, newStatus) {
    const next = trials.map((t) => t.id === trialId ? {
      ...t,
      status: newStatus,
      timeline: [...(t.timeline || []), { status: newStatus, at: today, by: '操作员' }]
    } : t);
    persistTrials(next);
    if (selectedTrial?.id === trialId) {
      setSelectedTrial(next.find((t) => t.id === trialId));
    }
  }

  function addObservation(event) {
    event.preventDefault();
    if (!obsForm.trialId) return;
    const newObs = {
      id: uid(),
      trialId: obsForm.trialId,
      date: obsForm.date || today,
      leafColor: obsForm.leafColor,
      growth: obsForm.growth,
      rootSystem: obsForm.rootSystem,
      yieldEstimate: obsForm.yieldEstimate,
      anomaly: obsForm.anomaly,
      memo: obsForm.memo,
      createdAt: new Date().toISOString()
    };
    const nextObservations = [newObs, ...observations];
    const trial = trials.find((t) => t.id === obsForm.trialId);
    let nextTrials = trials;
    if (trial?.status === '试配中') {
      nextTrials = trials.map((t) => t.id === trial.id ? {
        ...t,
        status: '观察中',
        timeline: [...(t.timeline || []), { status: '观察中', at: today, by: '操作员' }]
      } : t);
      if (selectedTrial?.id === trial.id) {
        setSelectedTrial(nextTrials.find((t) => t.id === trial.id));
      }
    }
    persistAll(records, adjRecords, nextTrials, nextObservations);
    setObsForm({ trialId: '', date: today, leafColor: '', growth: '', rootSystem: '', yieldEstimate: '', anomaly: '', memo: '' });
    setObsFormVisible(false);
  }

  function removeObservation(id) {
    persistObservations(observations.filter((o) => o.id !== id));
  }

  function adoptTrial(trialId) {
    const trial = trials.find((t) => t.id === trialId);
    if (!trial) return;
    const sourceRecipe = records.find((r) => r.id === trial.recipeId);
    if (!sourceRecipe) return;

    const sameGroup = records.filter((r) => r.crop === sourceRecipe.crop && r.stage === sourceRecipe.stage);
    const nextVer = sameGroup.length > 0 ? Math.max(...sameGroup.map((r) => r.version || 0)) + 1 : 1;

    const adoptedRecipe = {
      id: uid(),
      crop: sourceRecipe.crop,
      stage: sourceRecipe.stage,
      ec: sourceRecipe.ec,
      ph: sourceRecipe.ph,
      npk: sourceRecipe.npk,
      memo: sourceRecipe.memo,
      status: '使用中',
      version: nextVer,
      createdAt: new Date().toISOString(),
      timeline: [{ status: '使用中', at: today, by: `试验采用（源试验: ${trial.id.slice(0, 6)}）` }],
      fromTrialId: trial.id
    };

    const allInUseIds = sameGroup
      .filter((r) => r.status === '使用中')
      .map((r) => r.id);

    let nextRecords = [adoptedRecipe, ...records];

    if (allInUseIds.length > 0) {
      nextRecords = nextRecords.map((r) =>
        allInUseIds.includes(r.id)
          ? { ...r, status: '已归档', timeline: [...(r.timeline || []), { status: '已归档', at: today, by: `新版本 v${nextVer} 采用自动归档` }] }
          : r
      );
    }

    const nextTrials = trials.map((t) => t.id === trialId ? {
      ...t,
      status: '已采用',
      adoptedRecipeId: adoptedRecipe.id,
      timeline: [...(t.timeline || []), { status: '已采用', at: today, by: `生成正式配方 v${nextVer}` }]
    } : t);

    persistAll(ensureVersions(nextRecords), adjRecords, nextTrials, observations);

    if (selectedTrial?.id === trialId) {
      setSelectedTrial(nextTrials.find((t) => t.id === trialId));
    }
    setSelected(adoptedRecipe);
    setAdoptModalOpen(false);
    setAdoptTrialId(null);
  }

  function openTrialForRecipe(recipe) {
    const existing = trials.find((t) => t.recipeId === recipe.id);
    if (existing) {
      setSelectedTrial(existing);
      return;
    }
    setTrialForm({ recipeId: recipe.id, goal: '', initialMemo: recipe.memo || '' });
    setTrialFormVisible(true);
  }

  function addAdjRecord(event) {
    event.preventDefault();
    if (!selected || !adjForm.sourceId) return;
    const sourceRecipe = records.find((r) => r.id === adjForm.sourceId);
    const newAdj = {
      id: uid(),
      recipeId: selected.id,
      recipeName: `${selected.crop} · ${selected.stage}`,
      sourceId: adjForm.sourceId,
      sourceName: sourceRecipe ? `${sourceRecipe.crop} · ${sourceRecipe.stage}` : '',
      crop: selected.crop,
      stage: selected.stage,
      reason: adjForm.reason,
      adjustments: adjForm.adjustments,
      observations: adjForm.observations,
      createdAt: new Date().toISOString()
    };
    persistAdj([newAdj, ...adjRecords]);
    setAdjForm({ sourceId: '', reason: '', adjustments: '', observations: '' });
    setAdjFormVisible(false);
  }

  function removeAdjRecord(id) {
    persistAdj(adjRecords.filter((r) => r.id !== id));
  }

  function handleExport() {
    setExportMode(EXPORT_TYPES.GREENHOUSE_DATA);
    setExportModalOpen(true);
  }

  function handleExportConfirm() {
    let jsonStr, filename;
    const greenhouseInfo = { id: activeGhId, name: activeGreenhouse?.name || '未知温室' };

    if (exportMode === EXPORT_TYPES.FULL_BACKUP) {
      const customTemplates = loadCustomTemplates();
      jsonStr = exportFullBackup(ghState, appConfig, customTemplates);
      filename = generateExportFilename(appConfig, EXPORT_TYPES.FULL_BACKUP);
    } else {
      jsonStr = exportGreenhouseData(records, adjRecords, appConfig, trials, observations, greenhouseInfo);
      filename = generateExportFilename(appConfig, EXPORT_TYPES.GREENHOUSE_DATA, greenhouseInfo);
    }

    downloadJSON(jsonStr, filename);
    setExportModalOpen(false);
  }

  function handleImportFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    setImportFileInfo({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    });
    setImportError(null);
    setImportProcessing(true);

    parseImportFile(file)
      .then((data) => {
        const importType = detectImportType(data);
        const targetGhId = importTargetGhId || activeGhId;
        const validation = validateImportData(data, records, adjRecords, appConfig, trials, observations, ghState, targetGhId);

        if (importType === EXPORT_TYPES.FULL_BACKUP) {
          setImportMode(IMPORT_MODES.OVERWRITE);
          const firstGhId = Object.keys(validation.cleanData.data || {})[0];
          setImportSourceGhId(validation.cleanData.activeGreenhouseId || firstGhId || '');
        } else {
          setImportMode(IMPORT_MODES.MERGE_CURRENT);
        }

        setImportPreview(validation);
        setImportProcessing(false);
      })
      .catch((err) => {
        setImportError(err.message);
        setImportProcessing(false);
        setImportPreview(null);
      });
  }

  function triggerImportFileSelect() {
    setImportModalOpen(true);
    setImportPreview(null);
    setImportError(null);
    setImportFileInfo(null);
    setImportMode(IMPORT_MODES.MERGE_CURRENT);
    setImportTargetGhId(activeGhId);
    setImportSourceGhId('');
    setImportNewGhName('');
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  }

  function handleImportConfirm() {
    if (!importPreview || !importPreview.valid) return;

    const importType = importPreview.importType;
    const options = {
      appConfig,
      targetGhId: importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE ? (importTargetGhId || activeGhId) : activeGhId,
      sourceGhId: importSourceGhId,
      newGreenhouseName: importNewGhName.trim() || undefined,
    };

    const newState = applyImportMode(importMode, ghState, importPreview.cleanData, importType, options);

    if (importMode === IMPORT_MODES.OVERWRITE && importPreview.cleanData.customTemplates) {
      saveCustomTemplates(importPreview.cleanData.customTemplates);
      setCustomTemplatesVersion((v) => v + 1);
    }

    Object.keys(newState.data || {}).forEach((ghId) => {
      if (newState.data[ghId]?.records) {
        newState.data[ghId].records = ensureVersions(newState.data[ghId].records);
      }
    });

    saveMultiGreenhouseState(newState);
    setGhState(newState);

    let successMessage = '';
    if (importMode === IMPORT_MODES.OVERWRITE) {
      successMessage = `已覆盖整个应用数据！\n\n`;
      const ghCount = Object.keys(newState.greenhouses || {}).length;
      successMessage += `共导入 ${ghCount} 个温室\n`;
      if (importPreview.preview.customTemplateCount > 0) {
        successMessage += `自定义模板：${importPreview.preview.customTemplateCount} 个\n`;
      }
    } else if (importMode === IMPORT_MODES.NEW_GREENHOUSE) {
      const newGhId = newState.activeGreenhouseId;
      const newGhName = newState.greenhouses?.[newGhId]?.name || '新温室';
      successMessage = `已新建温室「${newGhName}」并导入数据！\n\n`;
      const ghData = newState.data?.[newGhId];
      successMessage += `配方记录：${ghData?.records?.length || 0} 条\n`;
      successMessage += `调整记录：${ghData?.adjRecords?.length || 0} 条\n`;
      successMessage += `试验记录：${ghData?.trials?.length || 0} 条\n`;
      successMessage += `观察记录：${ghData?.observations?.length || 0} 条`;
    } else {
      const targetGhId = importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE ? (importTargetGhId || activeGhId) : activeGhId;
      const targetGhName = ghState.greenhouses?.[targetGhId]?.name || '当前温室';
      successMessage = `已导入到温室「${targetGhName}」！\n\n`;

      const preview = importPreview.importType === EXPORT_TYPES.FULL_BACKUP && importSourceGhId
        ? importPreview.preview.impactByGh?.[importSourceGhId]?.preview
        : importPreview.preview;

      if (preview) {
        successMessage += `配方记录：新增 ${preview.records?.newCount || 0} 条，覆盖 ${preview.records?.overwriteCount || 0} 条\n`;
        successMessage += `调整记录：新增 ${preview.adjRecords?.newCount || 0} 条，覆盖 ${preview.adjRecords?.overwriteCount || 0} 条\n`;
        if (preview.trials) {
          successMessage += `试验记录：新增 ${preview.trials.newCount || 0} 条，覆盖 ${preview.trials.overwriteCount || 0} 条\n`;
        }
        if (preview.observations) {
          successMessage += `观察记录：新增 ${preview.observations.newCount || 0} 条，覆盖 ${preview.observations.overwriteCount || 0} 条`;
        }
      }
    }

    setImportModalOpen(false);
    setImportPreview(null);
    setImportFileInfo(null);
    setImportMode(IMPORT_MODES.MERGE_CURRENT);
    setImportTargetGhId('');
    setImportSourceGhId('');
    setImportNewGhName('');

    alert(successMessage);
  }

  function handleImportCancel() {
    setImportModalOpen(false);
    setImportPreview(null);
    setImportError(null);
    setImportFileInfo(null);
    setImportMode(IMPORT_MODES.MERGE_CURRENT);
    setImportTargetGhId('');
    setImportSourceGhId('');
    setImportNewGhName('');
  }

  function applySelectedNpkToCalc() {
    if (selected && selected.npk) {
      setCalcForm({ ...calcForm, npkRatio: selected.npk, targetEc: selected.ec });
    }
  }

  function calculateMixing(event) {
    event?.preventDefault();
    const water = Number(calcForm.waterVolume) || 0;
    const multiplier = Number(calcForm.stockMultiplier) || 1;
    const ec = Number(calcForm.targetEc) || 0;
    const npkStr = calcForm.npkRatio || '';
    const npkParts = npkStr.split('-').map((v) => Number(v.trim()) || 0);
    const n = npkParts[0] || 0;
    const p = npkParts[1] || 0;
    const k = npkParts[2] || 0;
    const npkSum = n + p + k;

    const factor = 1.0;
    const totalFertilizer = ec * water * factor;

    const nAmount = npkSum > 0 ? (totalFertilizer * n) / npkSum : 0;
    const pAmount = npkSum > 0 ? (totalFertilizer * p) / npkSum : 0;
    const kAmount = npkSum > 0 ? (totalFertilizer * k) / npkSum : 0;

    const stockVolumeMl = (water / multiplier) * 1000;
    const cleanWater = water - stockVolumeMl / 1000;
    const workingDilutionRatio = multiplier;

    const warnings = [];
    if (multiplier < 1) warnings.push('母液倍数不能小于 1');
    if (multiplier > 500) warnings.push('母液倍数过高，建议不超过 500 倍');
    if (ec < 0.4) warnings.push('目标 EC 偏低，苗期请逐步提高');
    if (ec > 3.0) warnings.push('目标 EC 偏高，注意防止烧苗');
    if (npkSum === 0) warnings.push('NPK 比例格式异常，应为如「15-5-30」');
    if (water <= 0) warnings.push('水量必须大于 0');

    setCalcResult({
      water,
      multiplier,
      ec,
      npk: { n, p, k, sum: npkSum },
      totalFertilizer: Number(totalFertilizer.toFixed(2)),
      nAmount: Number(nAmount.toFixed(2)),
      pAmount: Number(pAmount.toFixed(2)),
      kAmount: Number(kAmount.toFixed(2)),
      stockVolumeMl: Number(stockVolumeMl.toFixed(0)),
      cleanWater: Number(cleanWater.toFixed(2)),
      workingDilutionRatio,
      warnings,
      calculatedAt: new Date().toLocaleString('zh-CN')
    });
  }

  function saveCalcAsAdjRecord() {
    if (!selected) {
      alert('请先在右侧列表中选择一个配方，将计算结果保存到该配方的调整记录中。');
      return;
    }
    if (!calcResult) {
      alert('请先完成营养液混配计算，然后再保存。');
      return;
    }

    const adjustmentsParts = [];
    adjustmentsParts.push(`水量：${calcResult.water} L`);
    adjustmentsParts.push(`母液倍数：${calcResult.multiplier}×`);
    adjustmentsParts.push(`目标 EC：${calcResult.ec} mS/cm`);
    adjustmentsParts.push(`NPK 比例：${calcResult.npk.n}-${calcResult.npk.p}-${calcResult.npk.k}`);
    adjustmentsParts.push(`总肥料估算：${calcResult.totalFertilizer} g`);
    adjustmentsParts.push(`N 用量：${calcResult.nAmount} g`);
    adjustmentsParts.push(`P 用量：${calcResult.pAmount} g`);
    adjustmentsParts.push(`K 用量：${calcResult.kAmount} g`);
    adjustmentsParts.push(`母液量：${calcResult.stockVolumeMl} mL`);
    adjustmentsParts.push(`清水量：${calcResult.cleanWater} L`);

    const observationsParts = [];
    if (calcResult.warnings.length > 0) {
      observationsParts.push('计算警告：');
      calcResult.warnings.forEach((w, i) => {
        observationsParts.push(`${i + 1}. ${w}`);
      });
    }
    if (calcNote.trim()) {
      if (observationsParts.length > 0) observationsParts.push('');
      observationsParts.push(`备注：${calcNote.trim()}`);
    }

    const newAdj = {
      id: uid(),
      recipeId: selected.id,
      recipeName: `${selected.crop} · ${selected.stage}`,
      sourceId: selected.id,
      sourceName: `${selected.crop} · ${selected.stage}（当前配方）`,
      crop: selected.crop,
      stage: selected.stage,
      reason: '营养液混配计算',
      adjustments: adjustmentsParts.join('\n'),
      observations: observationsParts.join('\n'),
      calcData: {
        water: calcResult.water,
        multiplier: calcResult.multiplier,
        ec: calcResult.ec,
        npk: calcResult.npk,
        totalFertilizer: calcResult.totalFertilizer,
        nAmount: calcResult.nAmount,
        pAmount: calcResult.pAmount,
        kAmount: calcResult.kAmount,
        stockVolumeMl: calcResult.stockVolumeMl,
        cleanWater: calcResult.cleanWater,
        warnings: calcResult.warnings,
        calculatedAt: calcResult.calculatedAt,
        note: calcNote.trim() || undefined
      },
      createdAt: new Date().toISOString()
    };
    persistAdj([newAdj, ...adjRecords]);
    alert(`已将本次营养液混配计算结果保存为「${selected.crop} · ${selected.stage}」的调整记录。`);
  }

  const filteredAdjRecords = useMemo(() => {
    return adjRecords
      .filter((r) => adjFilters.crop === '全部' || r.crop === adjFilters.crop)
      .filter((r) => adjFilters.stage === '全部' || r.stage === adjFilters.stage);
  }, [adjRecords, adjFilters]);

  const adjCropOptions = useMemo(() => [...new Set(adjRecords.map((r) => r.crop))], [adjRecords]);
  const adjStageOptions = useMemo(() => [...new Set(adjRecords.map((r) => r.stage))], [adjRecords]);

  const cmpCropOptions = useMemo(() => [...new Set(records.map((r) => r.crop))], [records]);
  const cmpStageOptions = useMemo(() => {
    if (cmpCrop === '全部') return [...new Set(records.map((r) => r.stage))];
    return [...new Set(records.filter((r) => r.crop === cmpCrop).map((r) => r.stage))];
  }, [records, cmpCrop]);
  const cmpSameGroup = cmpCrop !== '全部' && cmpStage !== '全部';
  const cmpCandidates = useMemo(() => {
    return records.filter((r) => {
      if (cmpCrop !== '全部' && r.crop !== cmpCrop) return false;
      if (cmpStage !== '全部' && r.stage !== cmpStage) return false;
      return true;
    }).sort((a, b) => (a.version || 0) - (b.version || 0));
  }, [records, cmpCrop, cmpStage]);
  const cmpLeftRecord = useMemo(() => records.find((r) => r.id === cmpLeft), [records, cmpLeft]);
  const cmpRightRecord = useMemo(() => records.find((r) => r.id === cmpRight), [records, cmpRight]);

  function timelineKey(step) {
    return `${step.status}||${step.at}||${step.by}`;
  }

  const cmpTimelineDiff = useMemo(() => {
    if (!cmpLeftRecord || !cmpRightRecord) return null;
    const leftKeys = new Set((cmpLeftRecord.timeline || []).map(timelineKey));
    const rightKeys = new Set((cmpRightRecord.timeline || []).map(timelineKey));
    const leftUnique = (cmpLeftRecord.timeline || []).filter((s) => !rightKeys.has(timelineKey(s)));
    const rightUnique = (cmpRightRecord.timeline || []).filter((s) => !leftKeys.has(timelineKey(s)));
    return {
      leftUnique: new Set(leftUnique.map(timelineKey)),
      rightUnique: new Set(rightUnique.map(timelineKey)),
      leftCount: leftUnique.length,
      rightCount: rightUnique.length,
    };
  }, [cmpLeftRecord, cmpRightRecord]);

  const crossCmpLeftGhData = useMemo(() => {
    if (!crossCmpGhLeft) return null;
    return getGreenhouseData(ghState, crossCmpGhLeft);
  }, [ghState, crossCmpGhLeft]);

  const crossCmpRightGhData = useMemo(() => {
    if (!crossCmpGhRight) return null;
    return getGreenhouseData(ghState, crossCmpGhRight);
  }, [ghState, crossCmpGhRight]);

  const crossCmpLeftGreenhouse = useMemo(() => {
    return ghState.greenhouses[crossCmpGhLeft] || null;
  }, [ghState, crossCmpGhLeft]);

  const crossCmpRightGreenhouse = useMemo(() => {
    return ghState.greenhouses[crossCmpGhRight] || null;
  }, [ghState, crossCmpGhRight]);

  const crossCmpAllCropOptions = useMemo(() => {
    const crops = new Set();
    if (crossCmpLeftGhData?.records) {
      crossCmpLeftGhData.records.forEach((r) => crops.add(r.crop));
    }
    if (crossCmpRightGhData?.records) {
      crossCmpRightGhData.records.forEach((r) => crops.add(r.crop));
    }
    return [...crops].sort();
  }, [crossCmpLeftGhData, crossCmpRightGhData]);

  const crossCmpStageOptions = useMemo(() => {
    const stages = new Set();
    const leftRecords = crossCmpLeftGhData?.records || [];
    const rightRecords = crossCmpRightGhData?.records || [];
    [...leftRecords, ...rightRecords].forEach((r) => {
      if (crossCmpCrop === '全部' || r.crop === crossCmpCrop) {
        stages.add(r.stage);
      }
    });
    return [...stages].sort();
  }, [crossCmpLeftGhData, crossCmpRightGhData, crossCmpCrop]);

  function getInUseRecipes(records, crop, stage) {
    return records
      .filter((r) => {
        if (crop !== '全部' && r.crop !== crop) return false;
        if (stage !== '全部' && r.stage !== stage) return false;
        if (r.status !== '使用中') return false;
        return true;
      })
      .sort((a, b) => (b.version || 0) - (a.version || 0));
  }

  const crossCmpLeftInUse = useMemo(() => {
    if (!crossCmpLeftGhData?.records) return [];
    return getInUseRecipes(crossCmpLeftGhData.records, crossCmpCrop, crossCmpStage);
  }, [crossCmpLeftGhData, crossCmpCrop, crossCmpStage]);

  const crossCmpRightInUse = useMemo(() => {
    if (!crossCmpRightGhData?.records) return [];
    return getInUseRecipes(crossCmpRightGhData.records, crossCmpCrop, crossCmpStage);
  }, [crossCmpRightGhData, crossCmpCrop, crossCmpStage]);

  const crossCmpPairs = useMemo(() => {
    const pairs = [];
    const keys = new Set();
    const leftMap = {};
    const rightMap = {};

    crossCmpLeftInUse.forEach((r) => {
      const key = `${r.crop}||${r.stage}`;
      keys.add(key);
      leftMap[key] = r;
    });

    crossCmpRightInUse.forEach((r) => {
      const key = `${r.crop}||${r.stage}`;
      keys.add(key);
      rightMap[key] = r;
    });

    [...keys].sort().forEach((key) => {
      const [crop, stage] = key.split('||');
      pairs.push({
        key,
        crop,
        stage,
        left: leftMap[key] || null,
        right: rightMap[key] || null,
      });
    });

    return pairs;
  }, [crossCmpLeftInUse, crossCmpRightInUse]);

  function hasTrialSource(recipe, trials) {
    if (!recipe || !trials) return false;
    if (recipe.fromTrialId) {
      return trials.some((t) => t.id === recipe.fromTrialId);
    }
    return trials.some((t) => t.recipeId === recipe.id);
  }

  function getRecipeDiff(left, right) {
    if (!left || !right) return null;
    const diffFields = [];
    const fields = [
      { key: 'version', label: '版本' },
      { key: 'ec', label: 'EC' },
      { key: 'ph', label: 'pH' },
      { key: 'npk', label: 'NPK' },
      { key: 'memo', label: '备注' },
      { key: 'status', label: '状态' },
    ];
    fields.forEach((f) => {
      const leftVal = String(left[f.key] || '');
      const rightVal = String(right[f.key] || '');
      if (leftVal !== rightVal) {
        diffFields.push(f.key);
      }
    });
    return diffFields;
  }

  const filteredRecords = useMemo(() => {
    return records
      .filter((item) => !filters.query || (item.crop || '').includes(filters.query))
      .filter((item) => filters.status === '全部' || item.status === filters.status)
      .sort((a, b) => {
        if (appConfig.sort === 'priority') {
          const rank = priorityRank(a.priority) - priorityRank(b.priority);
          if (rank !== 0) return rank;
        }
        const aDate = a[appConfig.dateKey] || a.sentAt || a.createdAt || '';
        const bDate = b[appConfig.dateKey] || b.sentAt || b.createdAt || '';
        return String(aDate).localeCompare(String(bDate));
      });
  }, [records, filters]);

  const boardFilteredRecords = useMemo(() => {
    if (!boardFilter.crop && !boardFilter.stage) return filteredRecords;
    return filteredRecords.filter((r) => {
      if (boardFilter.crop && r.crop !== boardFilter.crop) return false;
      if (boardFilter.stage && r.stage !== boardFilter.stage) return false;
      return true;
    });
  }, [filteredRecords, boardFilter]);

  const metrics = [
    { label: "作物数", value: new Set(records.map((item) => item.crop)).size },
    { label: "使用中", value: records.filter((item) => item.status === '使用中').length },
    { label: "平均EC", value: avg(records.map((item) => Number(item.ec))).toFixed(1) },
    { label: "异常预警", value: warningList.length },
  ];

  const filteredTrials = useMemo(() => {
    return trials
      .filter((t) => trialFilters.crop === '全部' || t.crop === trialFilters.crop)
      .filter((t) => trialFilters.status === '全部' || t.status === trialFilters.status)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [trials, trialFilters]);

  const trialCropOptions = useMemo(() => [...new Set(trials.map((t) => t.crop))], [trials]);
  const trialMetrics = useMemo(() => ({
    total: trials.length,
    inProgress: trials.filter((t) => t.status === '试配中' || t.status === '观察中').length,
    adopted: trials.filter((t) => t.status === '已采用').length,
    archived: trials.filter((t) => t.status === '已归档').length,
  }), [trials]);

  const selectedTrialObservations = useMemo(() => {
    if (!selectedTrial) return [];
    return getTrialObservations(selectedTrial.id);
  }, [selectedTrial, observations]);

  const selectedTrialRecipe = useMemo(() => {
    if (!selectedTrial) return null;
    return records.find((r) => r.id === selectedTrial.recipeId) || null;
  }, [selectedTrial, records]);

  const selectedTrialAdoptedRecipe = useMemo(() => {
    if (!selectedTrial?.adoptedRecipeId) return null;
    return records.find((r) => r.id === selectedTrial.adoptedRecipeId) || null;
  }, [selectedTrial, records]);

  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, item) => {
      const key = item[appConfig.dateKey] || item.date || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords]);

  const directory = useMemo(() => {
    return records.reduce((acc, item) => {
      const key = item.issue || '未分类';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [records]);

  return (
    <main className="shell" style={{ '--accent': appConfig.accent }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><Sprout size={18} />{appConfig.domain}</div>
          <h1>{appConfig.title}</h1>
          <p>{appConfig.subtitle}</p>
          <div className="greenhouse-switcher">
            <div className="gh-switcher-label">
              <Building2 size={14} />
              <span>当前温室</span>
            </div>
            <div className="gh-switcher-tabs">
              {greenhouses.map((gh) => (
                <button
                  key={gh.id}
                  type="button"
                  className={'gh-tab ' + (gh.id === activeGhId ? 'gh-tab-active' : '')}
                  onClick={() => handleSwitchGreenhouse(gh.id)}
                  title={gh.name}
                >
                  <Building2 size={12} />
                  <span className="gh-tab-name">{gh.name}</span>
                  <span className="gh-tab-count">
                    {ghState.data[gh.id]?.records?.length || 0} 配方
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="gh-tab gh-tab-manage"
                onClick={() => setGhManagerOpen(true)}
                title="管理温室"
              >
                <Settings size={14} />
                <span>管理</span>
              </button>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="hero-action-btn" onClick={handleExport}>
            <HardDriveDownload size={16} />
            <span>导出数据</span>
          </button>
          <button type="button" className="hero-action-btn hero-action-btn-primary" onClick={triggerImportFileSelect}>
            <HardDriveUpload size={16} />
            <span>导入数据</span>
          </button>
          <div className="port-card">
            <span>Local Port</span>
            <strong>{appConfig.port}</strong>
          </div>
        </div>
      </section>

      <section className="metrics metrics-5">
        {metrics.map((metric) => (
          <article className={'metric ' + (metric.label === '异常预警' && metric.value > 0 ? 'metric-warning' : '')} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
        <article className="metric metric-trial">
          <span>进行中试验</span>
          <strong>{trialMetrics.inProgress}</strong>
        </article>
      </section>

      <section className="board-section">
        <div className="panel board-panel">
          <div className="panel-title">
            <Grid3X3 size={18} />
            <h2>作物生长期配方看板</h2>
            {boardFilter.crop || boardFilter.stage ? (
              <button type="button" className="board-clear-filter" onClick={clearBoardFilter}>
                <X size={14} />
                <span>清除筛选（{boardFilter.crop || '全部作物'} · {boardFilter.stage || '全部生长期'}）</span>
              </button>
            ) : null}
            <span className="board-tip">点击格子筛选配方，空格子可快速新建</span>
          </div>

          <div className="board-grid">
            <div className="board-corner"></div>
            {boardStages.map((stage) => (
              <div className="board-stage-head" key={stage}>
                <Flower2 size={14} />
                <span>{stage}</span>
              </div>
            ))}

            {cropOptions.map((crop) => (
              <Fragment key={crop}>
                <div className="board-crop-head">
                  <Sprout size={14} />
                  <span>{crop}</span>
                </div>
                {boardStages.map((stage) => {
                  const cell = boardData[crop][stage];
                  const isFiltered = boardFilter.crop === crop && boardFilter.stage === stage;
                  const isEmpty = cell.total === 0;

                  if (isEmpty) {
                    return (
                      <button
                        key={`cell-${crop}-${stage}`}
                        className={'board-cell board-cell-empty ' + (isFiltered ? 'board-cell-active' : '')}
                        onClick={() => handleBoardCellClick(crop, stage)}
                      >
                        <div className="board-cell-empty-icon">
                          <Plus size={20} />
                        </div>
                        <span className="board-cell-empty-text">暂无配方</span>
                        <div className="board-cell-stats board-cell-stats-empty">
                          <span className="board-stat board-stat-trial">
                            <Layers size={11} />
                            试配 0
                          </span>
                          <span className="board-stat board-stat-archived">
                            <Archive size={11} />
                            归档 0
                          </span>
                        </div>
                        <span className="board-cell-empty-action">点击快速新建</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={`cell-${crop}-${stage}`}
                      className={'board-cell ' + (isFiltered ? 'board-cell-active' : '')}
                      onClick={() => handleBoardCellClick(crop, stage)}
                    >
                      {cell.inUse ? (
                        <div className="board-cell-main">
                          <div className="board-cell-title">
                            <strong>EC {cell.inUse.ec}</strong>
                            <span className="board-cell-ph">pH {cell.inUse.ph}</span>
                          </div>
                          <div className="board-cell-npk">{cell.inUse.npk}</div>
                          <div className="board-cell-memo">{cell.inUse.memo}</div>
                        </div>
                      ) : (
                        <div className="board-cell-main">
                          <div className="board-cell-no-use">暂无使用中配方</div>
                        </div>
                      )}
                      <div className="board-cell-stats">
                        <span className="board-stat board-stat-trial">
                          <Layers size={11} />
                          试配 {cell.trialCount}
                        </span>
                        <span className="board-stat board-stat-archived">
                          <Archive size={11} />
                          归档 {cell.archivedCount}
                        </span>
                      </div>
                      {cell.inUse?.version && <span className="board-cell-version">v{cell.inUse.version}</span>}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <RecipeCalendar
        records={records}
        onSelectRecipe={setSelected}
        onOpenSchedule={handleOpenSchedule}
        selectedRecord={selected}
      />

      <section className="warning-section">
        <div className="panel warning-panel">
          <div className="panel-title">
            <ShieldAlert size={18} />
            <h2>EC/pH 异常预警中心</h2>
            {warningList.length > 0 && (
              <span className="warning-badge">{warningList.length} 项异常</span>
            )}
          </div>
          <div className="warning-toolbar">
            <label>
              <span>作物</span>
              <select value={warningFilter.crop} onChange={(e) => setWarningFilter({ ...warningFilter, crop: e.target.value })}>
                <option>全部</option>
                {warningCropOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span>严重程度</span>
              <select value={warningFilter.severity} onChange={(e) => setWarningFilter({ ...warningFilter, severity: e.target.value })}>
                <option>全部</option>
                <option value="high">高危</option>
                <option value="medium">中等</option>
              </select>
            </label>
            <span className="warning-filter-count">筛选后 {filteredWarnings.length} 项</span>
          </div>

          {filteredWarnings.length > 0 ? (
            <div className="warning-list">
              {filteredWarnings.map((w) => (
                <article className={'warning-card warning-card-' + w.severity} key={w.record.id}>
                  <div className="warning-card-head">
                    <div className="warning-card-title">
                      <span className={'warning-severity warning-severity-' + w.severity}>
                        {w.severity === 'high' ? '高危' : '中等'}
                      </span>
                      <strong>{w.record.crop}</strong>
                      <span className="warning-stage">{w.record.stage}</span>
                      <span className="warning-version">v{w.record.version || '?'}</span>
                      <span className={'status ' + statusClass(w.record.status)}>{w.record.status}</span>
                    </div>
                    <div className="warning-card-values">
                      <span className="warning-value warning-value-ec">
                        EC <strong>{w.record.ec}</strong>
                        <span className="warning-range">推荐 {w.range.ecMin}–{w.range.ecMax}</span>
                      </span>
                      <span className="warning-value warning-value-ph">
                        pH <strong>{w.record.ph}</strong>
                        <span className="warning-range">推荐 {w.range.phMin}–{w.range.phMax}</span>
                      </span>
                    </div>
                  </div>
                  <div className="warning-card-issues">
                    {w.issues.map((issue, idx) => (
                      <div className="warning-issue" key={idx}>
                        <span className={'warning-issue-icon ' + (issue.direction === 'high' ? 'warning-issue-high' : 'warning-issue-low')}>
                          {issue.direction === 'high' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </span>
                        <div className="warning-issue-content">
                          <strong>{issue.field} {issue.direction === 'high' ? '偏高' : '偏低'}</strong>
                          <p>{issue.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="warning-card-actions">
                    <button type="button" className="warning-copy-btn" onClick={() => duplicateRecord(w.record)}>
                      <Copy size={14} />
                      <span>复制为试配版本</span>
                    </button>
                    {greenhouses.length > 1 && (
                      <button type="button" className="warning-copy-btn" style={{ borderColor: '#6366f1', background: '#eef2ff', color: '#3730a3' }} onClick={() => openCopyRecipeModal(w.record)}>
                        <Building2 size={14} />
                        <span>复制到其他温室</span>
                      </button>
                    )}
                    <button type="button" className="warning-locate-btn" onClick={() => setSelected(w.record)}>
                      <ArrowRight size={14} />
                      <span>定位到配方</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="warning-empty">
              <ShieldAlert size={36} />
              <p>{warningList.length === 0 ? '当前所有配方 EC/pH 均在推荐范围内，暂无异常预警。' : '当前筛选条件下无异常配方。'}</p>
            </div>
          )}
        </div>
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={addRecord}>
          <div className="panel-title">
            <ClipboardList size={18} />
            <h2>新增记录</h2>
          </div>

          <div className="template-library">
            <button type="button" className="template-toggle" onClick={() => setTemplateOpen(!templateOpen)}>
              <BookOpen size={16} />
              <span>配方模板库</span>
              {templateOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {templateOpen && (
              <div className="template-body">
                <div className="template-toolbar">
                  <span className="template-count">共 {filteredTemplates.length} 个模板（内置 + 自定义）</span>
                  <div className="template-toolbar-actions">
                    <button type="button" className="template-save-btn" onClick={openSaveTemplateModal}>
                      <Plus size={14} />
                      <span>保存当前配方为模板</span>
                    </button>
                    <select value={templateCrop} onChange={(e) => setTemplateCrop(e.target.value)}>
                      <option>全部</option>
                      {allCropOptions.map((crop) => <option key={crop}>{crop}</option>)}
                    </select>
                  </div>
                </div>
                <div className="template-grid">
                  {filteredTemplates.map((template) => (
                    <div type="button" key={template.id} className={'template-card ' + (template.isCustom ? 'template-card-custom' : '')}>
                      <button type="button" className="template-card-main" onClick={() => applyTemplate(template)}>
                        <div className="template-card-head">
                          <strong>{template.crop}</strong>
                          <span className="template-stage">{template.stage}</span>
                          {template.isCustom && <span className="template-badge">自定义</span>}
                        </div>
                        <div className="template-card-name">{template.name}</div>
                        <div className="template-card-params">
                          <span>EC {template.ec}</span>
                          <span>pH {template.ph}</span>
                          <span>NPK {template.npk}</span>
                        </div>
                        <p className="template-card-memo">{template.memo}</p>
                        <div className="template-card-action">
                          <ArrowRight size={14} />
                          <span>一键带入</span>
                        </div>
                      </button>
                      {template.isCustom && (
                        <button
                          type="button"
                          className="template-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomTemplate(template.id, template.name);
                          }}
                          title="删除自定义模板"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-grid">
            {appConfig.fields.map((field) => (
              <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>
                <span>{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                ) : field.type === 'select' ? (
                  <select value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                )}
              </label>
            ))}
            <label>
              <span>当前状态</span>
              <select value={form.status || appConfig.primaryStatus} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <button className="primary" type="submit"><Plus size={18} />新增</button>
          <p className="hint">{appConfig.note}</p>
        </form>

        <section className="panel list-panel">
          {(boardFilter.crop || boardFilter.stage) && (
            <div className="board-filter-banner">
              <Grid3X3 size={14} />
              <span>看板筛选：<strong>{boardFilter.crop || '全部作物'}</strong> · <strong>{boardFilter.stage || '全部生长期'}</strong></span>
              <button type="button" onClick={clearBoardFilter}>
                <X size={13} />清除
              </button>
            </div>
          )}
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder={appConfig.filters[0]?.label || '搜索'} />
            </div>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option>全部</option>
              {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          <div className="records">
            {(boardFilter.crop || boardFilter.stage ? boardFilteredRecords : filteredRecords).map((item) => (
              <article className={'record ' + (item.conflict || hasOverlap(item, records) ? 'conflict' : '')} key={item.id} onClick={() => setSelected(item)}>
                <div className="record-head">
                  <div>
                    <h3>{item.crop}<span className="version-tag">v{item.version || '?'}</span></h3>
                    <p>{`${item.stage} · EC ${item.ec} · pH ${item.ph}`}</p>
                  </div>
                  <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                </div>
                <p className="record-detail">{`${item.npk}｜${item.memo}`}</p>
                {(item.conflict || hasOverlap(item, records)) && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  {appConfig.statuses.map((status) => (
                    <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                  ))}
                  {appConfig.action === 'copyRecipe' && <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>}
                  {greenhouses.length > 1 && <button type="button" onClick={() => openCopyRecipeModal(item)}><Building2 size={14} />复制到温室</button>}
                  {appConfig.chart && <button type="button" onClick={() => addTemperature(item)}>加温度</button>}
                  <button className="ghost-danger" type="button" onClick={() => removeRecord(item.id)}><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="insights">
        <div className="panel">
          <div className="panel-title">
            <CalendarDays size={18} />
            <h2>{appConfig.directory ? '证据目录预览' : appConfig.board ? '床位看板' : '分组视图'}</h2>
          </div>
          {appConfig.directory ? (
            <div className="directory">
              {Object.entries(directory).map(([issue, items]) => (
                <div key={issue} className="directory-group">
                  <strong>{issue}</strong>
                  {items.map((item, index) => <span key={item.id}>{index + 1}. {item.evidence}｜{item.purpose}</span>)}
                </div>
              ))}
            </div>
          ) : (
            <div className="date-groups">
              {Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date} className="date-group">
                  <strong>{date}</strong>
                  <span>{items.length}条记录</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="panel detail-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>详情</h2>
          </div>
          {selected ? (
            <div className="detail">
              <h3>{selected.crop}</h3>
              <p>{`${selected.stage} · EC ${selected.ec} · pH ${selected.ph}`}</p>
              <p>{`${selected.npk}｜${selected.memo}`}</p>
              {selected.temps && (
                <div className="temp-chart">
                  {selected.temps.map((value, index) => <i key={index} style={{ height: Math.max(10, 56 + Number(value) * 8) }} title={String(value)} />)}
                </div>
              )}
              <div className="timeline">
                {(selected.timeline || []).map((step, index) => (
                  <span key={index}>{step.at} · {step.status} · {step.by}</span>
                ))}
              </div>
              <div className="schedule-section">
                <div className="schedule-info">
                  <Calendar size={14} />
                  <span className="schedule-label">使用排期：</span>
                  {selected.startDate ? (
                    <span className="schedule-date">
                      {selected.startDate} ~ {selected.endDate || '至今'}
                    </span>
                  ) : (
                    <span className="schedule-none">未排期</span>
                  )}
                </div>
                <button
                  type="button"
                  className="schedule-btn"
                  onClick={() => {
                    setScheduleForm({
                      startDate: selected.startDate || '',
                      endDate: selected.endDate || ''
                    });
                    setScheduleFormOpen(true);
                  }}
                >
                  <CalendarDays size={14} />
                  {selected.startDate ? '修改排期' : '安排日期'}
                </button>
              </div>
              <div className="trial-link-section">
                {(() => {
                  const linkedTrial = getRecipeTrial(selected.id);
                  const sourceTrial = selected.fromTrialId ? trials.find((t) => t.id === selected.fromTrialId) : null;
                  if (linkedTrial) {
                    return (
                      <div className="trial-link-card trial-link-active">
                        <div className="trial-link-head">
                          <FlaskConical size={16} />
                          <strong>已绑定试验</strong>
                          <span className={'status ' + trialStatusClass(linkedTrial.status)}>{linkedTrial.status}</span>
                        </div>
                        <p className="trial-link-goal">{linkedTrial.goal}</p>
                        <button type="button" className="trial-link-btn" onClick={() => setSelectedTrial(linkedTrial)}>
                          <Activity size={13} />
                          查看试验详情
                        </button>
                      </div>
                    );
                  }
                  if (sourceTrial) {
                    return (
                      <div className="trial-link-card trial-link-source">
                        <div className="trial-link-head">
                          <History size={16} />
                          <strong>来自试验配方</strong>
                          <span className={'status ' + trialStatusClass(sourceTrial.status)}>{sourceTrial.status}</span>
                        </div>
                        <p className="trial-link-goal">{sourceTrial.goal}</p>
                        <button type="button" className="trial-link-btn" onClick={() => setSelectedTrial(sourceTrial)}>
                          <Activity size={13} />
                          追溯试验过程
                        </button>
                      </div>
                    );
                  }
                  return (
                    <button type="button" className="trial-init-btn" onClick={() => openTrialForRecipe(selected)}>
                      <FlaskConical size={16} />
                      <span>为此配方发起试验</span>
                    </button>
                  );
                })()}
              </div>

              <div className="adj-section">
                <button type="button" className="adj-toggle" onClick={() => { setAdjFormVisible(!adjFormVisible); setAdjForm({ sourceId: '', reason: '', adjustments: '', observations: '' }); }}>
                  <FileText size={16} />
                  <span>{adjFormVisible ? '取消填写调整记录' : '填写调整记录'}</span>
                </button>
                {adjFormVisible && (
                  <form className="adj-form" onSubmit={addAdjRecord}>
                    <label>
                      <span>原配方</span>
                      <select value={adjForm.sourceId} onChange={(e) => setAdjForm({ ...adjForm, sourceId: e.target.value })} required>
                        <option value="">请选择原配方</option>
                        {records.filter((r) => r.id !== selected.id).map((r) => (
                          <option key={r.id} value={r.id}>{r.crop} · {r.stage}（EC {r.ec} / pH {r.ph}）</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>调整原因</span>
                      <input type="text" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="如：高温期EC偏高烧苗" required />
                    </label>
                    <label className="wide">
                      <span>调整项</span>
                      <textarea value={adjForm.adjustments} onChange={(e) => setAdjForm({ ...adjForm, adjustments: e.target.value })} placeholder="如：EC 2.2→1.8，NPK 15-5-30→12-8-24" required />
                    </label>
                    <label className="wide">
                      <span>观察结果</span>
                      <textarea value={adjForm.observations} onChange={(e) => setAdjForm({ ...adjForm, observations: e.target.value })} placeholder="如：调整后3天新叶无烧尖，生长正常" />
                    </label>
                    <button className="primary" type="submit"><Plus size={16} />生成调整记录</button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <p className="empty">点击任意记录查看详情和状态流转。</p>
          )}
        </aside>
      </section>

      {scheduleFormOpen && selected && (
        <div className="modal-overlay" onClick={() => setScheduleFormOpen(false)}>
          <div className="modal schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Calendar size={18} />
                <h3>安排使用日期</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setScheduleFormOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="schedule-form-info">
                <strong>{selected.crop} · {selected.stage}</strong>
                <span className="version-tag">v{selected.version || '?'}</span>
                <span className={'status ' + statusClass(selected.status)}>{selected.status}</span>
              </div>
              <div className="schedule-form-grid">
                <label>
                  <span>开始日期</span>
                  <input
                    type="date"
                    value={scheduleForm.startDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })}
                  />
                </label>
                <label>
                  <span>结束日期（可选）</span>
                  <input
                    type="date"
                    value={scheduleForm.endDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endDate: e.target.value })}
                  />
                </label>
              </div>
              <p className="schedule-hint">
                <Layers size={12} />
                设置使用周期后，配方将在日历视图中对应日期显示。
              </p>
            </div>
            <div className="modal-footer">
              {selected.startDate && (
                <button type="button" className="ghost-danger" onClick={handleClearSchedule}>
                  清除排期
                </button>
              )}
              <button type="button" className="ghost" onClick={() => setScheduleFormOpen(false)}>
                取消
              </button>
              <button type="button" className="primary" onClick={handleSaveSchedule}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="calc-section">
        <div className="panel calc-form-panel">
          <div className="panel-title">
            <Calculator size={18} />
            <h2>营养液混配计算器</h2>
            {selected && (
              <button type="button" className="calc-autofill" onClick={applySelectedNpkToCalc}>
                <RefreshCw size={13} />
                <span>带入当前配方</span>
              </button>
            )}
          </div>

          <form className="calc-form" onSubmit={calculateMixing}>
            <div className="calc-grid">
              <label>
                <span className="calc-label-head"><Droplets size={13} />目标水量</span>
                <div className="calc-input-wrap">
                  <input type="number" step="1" min="0" value={calcForm.waterVolume} onChange={(e) => setCalcForm({ ...calcForm, waterVolume: e.target.value })} placeholder="如 100" />
                  <span className="calc-unit">L</span>
                </div>
              </label>
              <label>
                <span className="calc-label-head"><Beaker size={13} />母液倍数</span>
                <div className="calc-input-wrap">
                  <input type="number" step="1" min="1" value={calcForm.stockMultiplier} onChange={(e) => setCalcForm({ ...calcForm, stockMultiplier: e.target.value })} placeholder="如 100" />
                  <span className="calc-unit">×</span>
                </div>
              </label>
              <label>
                <span className="calc-label-head"><Scale size={13} />目标 EC</span>
                <div className="calc-input-wrap">
                  <input type="number" step="0.1" min="0" value={calcForm.targetEc} onChange={(e) => setCalcForm({ ...calcForm, targetEc: e.target.value })} placeholder="如 2.0" />
                  <span className="calc-unit">mS/cm</span>
                </div>
              </label>
              <label>
                <span className="calc-label-head">氮磷钾比例 N-P-K</span>
                <input type="text" value={calcForm.npkRatio} onChange={(e) => setCalcForm({ ...calcForm, npkRatio: e.target.value })} placeholder="如 15-5-30" />
              </label>
            </div>

            <div className="calc-form-foot">
              <button className="primary" type="submit"><Calculator size={16} />开始计算</button>
              <p className="hint">
                <Info size={13} />按简化模型估算：总肥量 ≈ EC × 水量，按 NPK 比例拆分各元素。母液按倍数稀释，最终建议量请结合实际 EC 校准。
              </p>
            </div>
          </form>
        </div>

        <div className="panel calc-result-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>本次混配建议</h2>
          </div>

          {calcResult ? (
            <div className="calc-result">
              {calcResult.warnings.length > 0 && (
                <div className="calc-warnings">
                  {calcResult.warnings.map((w, i) => (
                    <div className="calc-warning" key={i}><AlertTriangle size={14} />{w}</div>
                  ))}
                </div>
              )}

              <div className="calc-summary">
                <div className="calc-summary-item">
                  <span>配置总水量</span>
                  <strong>{calcResult.water} L</strong>
                </div>
                <div className="calc-summary-item">
                  <span>稀释倍数</span>
                  <strong>1 : {calcResult.workingDilutionRatio}</strong>
                </div>
                <div className="calc-summary-item">
                  <span>目标 EC</span>
                  <strong>{calcResult.ec} mS/cm</strong>
                </div>
                <div className="calc-summary-item calc-highlight">
                  <span>总肥料估算</span>
                  <strong>{calcResult.totalFertilizer} g</strong>
                </div>
              </div>

              <div className="calc-divider"><span>元素用量拆分</span></div>

              <div className="calc-elements">
                <div className="calc-element calc-element-n">
                  <div className="calc-element-head">
                    <strong>N 氮</strong>
                    <span className="calc-element-ratio">{calcResult.npk.n} 份</span>
                  </div>
                  <div className="calc-element-amount">
                    <span>建议用量</span>
                    <strong>{calcResult.nAmount} <em>g</em></strong>
                  </div>
                  <div className="calc-element-bar"><i style={{ width: calcResult.npk.sum > 0 ? `${(calcResult.npk.n / calcResult.npk.sum) * 100}%` : '0%' }} /></div>
                </div>
                <div className="calc-element calc-element-p">
                  <div className="calc-element-head">
                    <strong>P 磷</strong>
                    <span className="calc-element-ratio">{calcResult.npk.p} 份</span>
                  </div>
                  <div className="calc-element-amount">
                    <span>建议用量</span>
                    <strong>{calcResult.pAmount} <em>g</em></strong>
                  </div>
                  <div className="calc-element-bar"><i style={{ width: calcResult.npk.sum > 0 ? `${(calcResult.npk.p / calcResult.npk.sum) * 100}%` : '0%' }} /></div>
                </div>
                <div className="calc-element calc-element-k">
                  <div className="calc-element-head">
                    <strong>K 钾</strong>
                    <span className="calc-element-ratio">{calcResult.npk.k} 份</span>
                  </div>
                  <div className="calc-element-amount">
                    <span>建议用量</span>
                    <strong>{calcResult.kAmount} <em>g</em></strong>
                  </div>
                  <div className="calc-element-bar"><i style={{ width: calcResult.npk.sum > 0 ? `${(calcResult.npk.k / calcResult.npk.sum) * 100}%` : '0%' }} /></div>
                </div>
              </div>

              <div className="calc-divider"><span>操作步骤</span></div>

              <div className="calc-steps">
                <div className="calc-step">
                  <span className="calc-step-index">1</span>
                  <div>
                    <strong>取母液</strong>
                    <p>量取浓缩母液 <em>{calcResult.stockVolumeMl} mL</em>（按 {calcResult.multiplier}× 浓缩母液计）</p>
                  </div>
                </div>
                <div className="calc-step">
                  <span className="calc-step-index">2</span>
                  <div>
                    <strong>加清水</strong>
                    <p>注入清水约 <em>{calcResult.cleanWater} L</em>，搅拌均匀</p>
                  </div>
                </div>
                <div className="calc-step">
                  <span className="calc-step-index">3</span>
                  <div>
                    <strong>测 EC / pH</strong>
                    <p>使用仪器检测实际 EC 和 pH，必要时微调补肥或补水</p>
                  </div>
                </div>
              </div>

              <div className="calc-note-section">
                <label>
                  <span className="calc-label-head"><FileText size={13} />备注区</span>
                  <textarea value={calcNote} onChange={(e) => setCalcNote(e.target.value)} placeholder="记录本次混配的批次号、实际测得 EC、操作人员、特殊调整说明……" />
                </label>
              </div>

              <div className="calc-save-section">
                <button
                  type="button"
                  className="calc-save-btn"
                  onClick={saveCalcAsAdjRecord}
                  disabled={!selected}
                  title={selected ? '将本次计算结果保存为当前配方的调整记录' : '请先在右侧列表中选择一个配方'}
                >
                  <Save size={16} />
                  <span>保存为调整记录</span>
                  {!selected && <em className="calc-save-hint">（请先选择配方）</em>}
                </button>
                {selected && (
                  <span className="calc-save-target">
                    将保存至：<strong>{selected.crop} · {selected.stage}</strong>
                    <span className="version-tag">v{selected.version || '?'}</span>
                  </span>
                )}
              </div>

              <div className="calc-foot">
                <span className="calc-time">计算时间：{calcResult.calculatedAt}</span>
                <span className="calc-tag">简化模型 · 仅供参考</span>
              </div>
            </div>
          ) : (
            <div className="calc-empty">
              <Calculator size={40} />
              <p>填写左侧参数后点击「开始计算」，即可得到本次混配的建议用量与操作步骤。</p>
              <p className="calc-empty-subtip">如果已在右侧列表选中某个配方，可以直接点击「带入当前配方」快速填入 NPK 和 EC。</p>
            </div>
          )}
        </div>
      </section>

      <section className="adj-records-section">
        <div className="panel">
          <div className="panel-title">
            <FileText size={18} />
            <h2>配方调整记录</h2>
            <span className="adj-count">共 {filteredAdjRecords.length} 条</span>
          </div>
          <div className="adj-toolbar">
            <label>
              <span>作物</span>
              <select value={adjFilters.crop} onChange={(e) => setAdjFilters({ ...adjFilters, crop: e.target.value })}>
                <option>全部</option>
                {adjCropOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span>生长期</span>
              <select value={adjFilters.stage} onChange={(e) => setAdjFilters({ ...adjFilters, stage: e.target.value })}>
                <option>全部</option>
                {adjStageOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          {filteredAdjRecords.length > 0 ? (
            <div className="adj-list">
              {filteredAdjRecords.map((r) => {
                const isCalcRecord = !!r.calcData;
                return (
                  <article className={'adj-card ' + (isCalcRecord ? 'adj-card-calc' : '')} key={r.id}>
                    <div className="adj-card-head">
                      <div>
                        <strong>{r.recipeName}</strong>
                        {isCalcRecord && (
                          <span className="adj-type-tag adj-type-tag-calc">
                            <Calculator size={12} />混配计算
                          </span>
                        )}
                        <span className="adj-source">源：{r.sourceName}</span>
                      </div>
                      <button className="ghost-danger" type="button" onClick={() => removeAdjRecord(r.id)}><Trash2 size={14} /></button>
                    </div>
                    <div className="adj-card-body">
                      <div className="adj-field"><span className="adj-label">调整原因</span><p>{r.reason}</p></div>
                      {isCalcRecord && r.calcData ? (
                        <>
                          <div className="adj-calc-summary">
                            <div className="adj-calc-summary-item">
                              <Droplets size={12} />
                              <span>水量</span>
                              <strong>{r.calcData.water} L</strong>
                            </div>
                            <div className="adj-calc-summary-item">
                              <Beaker size={12} />
                              <span>母液</span>
                              <strong>{r.calcData.multiplier}×</strong>
                            </div>
                            <div className="adj-calc-summary-item">
                              <Scale size={12} />
                              <span>目标 EC</span>
                              <strong>{r.calcData.ec} mS/cm</strong>
                            </div>
                            <div className="adj-calc-summary-item adj-calc-summary-highlight">
                              <span>总肥量</span>
                              <strong>{r.calcData.totalFertilizer} g</strong>
                            </div>
                          </div>
                          <div className="adj-field">
                            <span className="adj-label">NPK 元素用量拆分</span>
                            <div className="adj-calc-elements">
                              <div className="adj-calc-element adj-calc-element-n">
                                <strong>N 氮</strong>
                                <span>{r.calcData.npk?.n} 份 · {r.calcData.nAmount} g</span>
                              </div>
                              <div className="adj-calc-element adj-calc-element-p">
                                <strong>P 磷</strong>
                                <span>{r.calcData.npk?.p} 份 · {r.calcData.pAmount} g</span>
                              </div>
                              <div className="adj-calc-element adj-calc-element-k">
                                <strong>K 钾</strong>
                                <span>{r.calcData.npk?.k} 份 · {r.calcData.kAmount} g</span>
                              </div>
                            </div>
                          </div>
                          <div className="adj-field">
                            <span className="adj-label">操作步骤</span>
                            <div className="adj-calc-steps">
                              <div className="adj-calc-step">
                                <span className="adj-calc-step-index">1</span>
                                <p>量取浓缩母液 <em>{r.calcData.stockVolumeMl} mL</em></p>
                              </div>
                              <div className="adj-calc-step">
                                <span className="adj-calc-step-index">2</span>
                                <p>注入清水约 <em>{r.calcData.cleanWater} L</em>，搅拌均匀</p>
                              </div>
                              <div className="adj-calc-step">
                                <span className="adj-calc-step-index">3</span>
                                <p>检测实际 EC / pH，必要时微调</p>
                              </div>
                            </div>
                          </div>
                          {r.calcData.warnings && r.calcData.warnings.length > 0 && (
                            <div className="adj-field">
                              <span className="adj-label">计算警告</span>
                              <div className="adj-calc-warnings">
                                {r.calcData.warnings.map((w, i) => (
                                  <div className="adj-calc-warning" key={i}><AlertTriangle size={12} />{w}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {r.calcData.note && (
                            <div className="adj-field"><span className="adj-label">备注</span><p>{r.calcData.note}</p></div>
                          )}
                          {r.calcData.calculatedAt && (
                            <div className="adj-calc-time">计算时间：{r.calcData.calculatedAt}</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="adj-field"><span className="adj-label">调整项</span><p>{r.adjustments}</p></div>
                          {r.observations && <div className="adj-field"><span className="adj-label">观察结果</span><p>{r.observations}</p></div>}
                        </>
                      )}
                    </div>
                    <div className="adj-card-foot">
                      <span className="adj-crop-stage">{r.crop} · {r.stage}</span>
                      <span className="adj-date">{r.createdAt?.slice(0, 10)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty">暂无调整记录。在详情面板中选择配方后可填写调整记录，或在混配计算器中保存计算结果。</p>
          )}
        </div>
      </section>

      <section className="cmp-section">
        <div className="panel">
          <div className="panel-title">
            <GitCompareArrows size={18} />
            <h2>配方版本对比</h2>
          </div>
          <div className="cmp-toolbar">
            <label>
              <span>作物</span>
              <select value={cmpCrop} onChange={(e) => { setCmpCrop(e.target.value); setCmpStage('全部'); setCmpLeft(''); setCmpRight(''); }}>
                <option>全部</option>
                {cmpCropOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span>生长期</span>
              <select value={cmpStage} onChange={(e) => { setCmpStage(e.target.value); setCmpLeft(''); setCmpRight(''); }}>
                <option>全部</option>
                {cmpStageOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <span className="cmp-count">{cmpSameGroup ? `同组共 ${cmpCandidates.length} 个版本` : '请选择同组'}</span>
          </div>

          {!cmpSameGroup ? (
            <div className="cmp-group-hint">
              <Info size={20} />
              <p>请先选择具体的<strong>作物</strong>和<strong>生长期</strong>，版本对比仅在同一作物同一生长期下进行。</p>
            </div>
          ) : cmpCandidates.length < 2 ? (
            <p className="cmp-hint">该分组下只有 {cmpCandidates.length} 个版本，至少需要 2 个版本才能进行对比。</p>
          ) : (
            <div className="cmp-selectors">
              <label>
                <span>版本 A</span>
                <select value={cmpLeft} onChange={(e) => setCmpLeft(e.target.value)}>
                  <option value="">选择配方版本</option>
                  {cmpCandidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      v{r.version || '?'} — {r.crop} · {r.stage}（EC {r.ec} / pH {r.ph}）{r.status}
                    </option>
                  ))}
                </select>
              </label>
              <span className="cmp-vs">VS</span>
              <label>
                <span>版本 B</span>
                <select value={cmpRight} onChange={(e) => setCmpRight(e.target.value)}>
                  <option value="">选择配方版本</option>
                  {cmpCandidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      v{r.version || '?'} — {r.crop} · {r.stage}（EC {r.ec} / pH {r.ph}）{r.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {cmpLeftRecord && cmpRightRecord && cmpSameGroup && (
            <div className="cmp-result">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th>对比项</th>
                    <th>版本 A（v{cmpLeftRecord.version || '?'}）</th>
                    <th>版本 B（v{cmpRightRecord.version || '?'}）</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const fields = [
                      { label: 'EC', left: cmpLeftRecord.ec, right: cmpRightRecord.ec },
                      { label: 'pH', left: cmpLeftRecord.ph, right: cmpRightRecord.ph },
                      { label: '氮磷钾比例', left: cmpLeftRecord.npk, right: cmpRightRecord.npk },
                      { label: '备注', left: cmpLeftRecord.memo, right: cmpRightRecord.memo },
                      { label: '当前状态', left: cmpLeftRecord.status, right: cmpRightRecord.status },
                    ];
                    return fields.map((f) => {
                      const diff = String(f.left || '') !== String(f.right || '');
                      return (
                        <tr key={f.label} className={diff ? 'cmp-diff' : ''}>
                          <td className="cmp-field-label">{f.label}</td>
                          <td>{f.left || '—'}{diff && <span className="cmp-badge">差异</span>}</td>
                          <td>{f.right || '—'}{diff && <span className="cmp-badge">差异</span>}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              <div className="cmp-divider">
                <span>状态时间线对比</span>
                {cmpTimelineDiff && (cmpTimelineDiff.leftCount > 0 || cmpTimelineDiff.rightCount > 0) && (
                  <span className="cmp-timeline-diff-count">
                    共 {cmpTimelineDiff.leftCount + cmpTimelineDiff.rightCount} 处差异
                  </span>
                )}
              </div>

              <div className="cmp-timeline-pair">
                <div className="cmp-timeline-col">
                  <strong>
                    v{cmpLeftRecord.version || '?'} 时间线
                    {cmpTimelineDiff && cmpTimelineDiff.leftCount > 0 && (
                      <span className="cmp-badge cmp-badge-sm">独有 {cmpTimelineDiff.leftCount}</span>
                    )}
                  </strong>
                  {(cmpLeftRecord.timeline || []).length > 0 ? (
                    <div className="cmp-timeline-list">
                      {(cmpLeftRecord.timeline || []).map((step, i) => {
                        const isUnique = cmpTimelineDiff?.leftUnique?.has(timelineKey(step));
                        return (
                          <span key={i} className={'cmp-timeline-step ' + (isUnique ? 'cmp-timeline-unique' : '')}>
                            {step.at} · {step.status} · {step.by}
                            {isUnique && <em className="cmp-unique-tag">独有</em>}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="cmp-timeline-empty">无时间线记录</span>
                  )}
                </div>
                <div className="cmp-timeline-col">
                  <strong>
                    v{cmpRightRecord.version || '?'} 时间线
                    {cmpTimelineDiff && cmpTimelineDiff.rightCount > 0 && (
                      <span className="cmp-badge cmp-badge-sm">独有 {cmpTimelineDiff.rightCount}</span>
                    )}
                  </strong>
                  {(cmpRightRecord.timeline || []).length > 0 ? (
                    <div className="cmp-timeline-list">
                      {(cmpRightRecord.timeline || []).map((step, i) => {
                        const isUnique = cmpTimelineDiff?.rightUnique?.has(timelineKey(step));
                        return (
                          <span key={i} className={'cmp-timeline-step ' + (isUnique ? 'cmp-timeline-unique' : '')}>
                            {step.at} · {step.status} · {step.by}
                            {isUnique && <em className="cmp-unique-tag">独有</em>}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="cmp-timeline-empty">无时间线记录</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="cmp-section cross-cmp-section">
        <div className="panel">
          <div className="panel-title">
            <Building2 size={18} />
            <h2>跨温室配方对比</h2>
            <span className="cross-cmp-subtitle">对比两个温室的「使用中」配方差异</span>
          </div>

          <div className="cross-cmp-gh-selector">
            <div className="cross-cmp-gh-col">
              <label>
                <span>温室 A</span>
                <select
                  value={crossCmpGhLeft}
                  onChange={(e) => { setCrossCmpGhLeft(e.target.value); }}
                >
                  <option value="">请选择温室</option>
                  {greenhouses.map((gh) => (
                    <option key={gh.id} value={gh.id}>{gh.name}</option>
                  ))}
                </select>
              </label>
              {crossCmpLeftGreenhouse && (
                <span className="cross-cmp-gh-meta">
                  {ghState.data[crossCmpGhLeft]?.records?.length || 0} 条配方 · {crossCmpLeftInUse.length} 个使用中
                </span>
              )}
            </div>
            <span className="cross-cmp-vs">VS</span>
            <div className="cross-cmp-gh-col">
              <label>
                <span>温室 B</span>
                <select
                  value={crossCmpGhRight}
                  onChange={(e) => { setCrossCmpGhRight(e.target.value); }}
                >
                  <option value="">请选择温室</option>
                  {greenhouses.map((gh) => (
                    <option key={gh.id} value={gh.id}>{gh.name}</option>
                  ))}
                </select>
              </label>
              {crossCmpRightGreenhouse && (
                <span className="cross-cmp-gh-meta">
                  {ghState.data[crossCmpGhRight]?.records?.length || 0} 条配方 · {crossCmpRightInUse.length} 个使用中
                </span>
              )}
            </div>
          </div>

          {crossCmpGhLeft && crossCmpGhRight ? (
            <>
              <div className="cmp-toolbar cross-cmp-toolbar">
                <label>
                  <span>作物</span>
                  <select
                    value={crossCmpCrop}
                    onChange={(e) => { setCrossCmpCrop(e.target.value); setCrossCmpStage('全部'); }}
                  >
                    <option>全部</option>
                    {crossCmpAllCropOptions.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  <span>生长期</span>
                  <select
                    value={crossCmpStage}
                    onChange={(e) => setCrossCmpStage(e.target.value)}
                  >
                    <option>全部</option>
                    {crossCmpStageOptions.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <span className="cmp-count">
                  共 {crossCmpPairs.length} 组使用中配方
                </span>
              </div>

              {crossCmpPairs.length === 0 ? (
                <div className="cmp-group-hint">
                  <Info size={20} />
                  <p>当前筛选条件下，两个温室均无「使用中」状态的配方。</p>
                </div>
              ) : (
                <div className="cross-cmp-list">
                  {crossCmpPairs.map((pair) => {
                    const diffs = getRecipeDiff(pair.left, pair.right);
                    const leftHasTrial = hasTrialSource(pair.left, crossCmpLeftGhData?.trials);
                    const rightHasTrial = hasTrialSource(pair.right, crossCmpRightGhData?.trials);
                    const hasDiff = diffs && diffs.length > 0;
                    const leftOnly = !pair.right;
                    const rightOnly = !pair.left;

                    return (
                      <div
                        key={pair.key}
                        className={'cross-cmp-card ' + (hasDiff ? 'cross-cmp-card-diff' : '') + (leftOnly || rightOnly ? ' cross-cmp-card-missing' : '')}
                      >
                        <div className="cross-cmp-card-head">
                          <div className="cross-cmp-card-title">
                            <strong>{pair.crop}</strong>
                            <span className="cross-cmp-stage-tag">{pair.stage}</span>
                            {hasDiff && <span className="cmp-badge">有差异</span>}
                            {leftOnly && <span className="cmp-badge cmp-badge-warn">仅温室 A</span>}
                            {rightOnly && <span className="cmp-badge cmp-badge-warn">仅温室 B</span>}
                          </div>
                        </div>

                        <div className="cross-cmp-card-body">
                          <div className={'cross-cmp-recipe-col ' + (leftOnly ? 'cross-cmp-col-only' : '')}>
                            <div className="cross-cmp-col-head">
                              <span className="cross-cmp-col-label">温室 A · {crossCmpLeftGreenhouse?.name || '?'}</span>
                              {leftHasTrial && (
                                <span className="cross-cmp-trial-tag">
                                  <FlaskConical size={12} />
                                  有试验来源
                                </span>
                              )}
                            </div>
                            {pair.left ? (
                              <>
                                <div className="cross-cmp-params">
                                  <div className={'cross-cmp-param ' + (diffs?.includes('version') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">版本</span>
                                    <strong>v{pair.left.version || '?'}</strong>
                                  </div>
                                  <div className={'cross-cmp-param ' + (diffs?.includes('ec') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">EC</span>
                                    <strong>{pair.left.ec}</strong>
                                  </div>
                                  <div className={'cross-cmp-param ' + (diffs?.includes('ph') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">pH</span>
                                    <strong>{pair.left.ph}</strong>
                                  </div>
                                  <div className={'cross-cmp-param ' + (diffs?.includes('npk') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">NPK</span>
                                    <strong>{pair.left.npk}</strong>
                                  </div>
                                </div>
                                {pair.left.memo && (
                                  <div className={'cross-cmp-memo ' + (diffs?.includes('memo') ? 'cross-cmp-memo-diff' : '')}>
                                    <span className="cross-cmp-memo-label">备注</span>
                                    <p>{pair.left.memo}</p>
                                  </div>
                                )}
                                {(pair.left.timeline || []).length > 0 && (
                                  <div className="cross-cmp-timeline">
                                    <span className="cross-cmp-timeline-label">最近状态</span>
                                    <div className="cross-cmp-timeline-list">
                                      {(pair.left.timeline || []).slice(-3).reverse().map((step, i) => (
                                        <span key={i} className="cross-cmp-timeline-step">
                                          {step.at} · {step.status} · {step.by}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="cross-cmp-empty">
                                <span>该温室暂无使用中配方</span>
                              </div>
                            )}
                          </div>

                          <div className="cross-cmp-col-divider">
                            {hasDiff ? <span className="cross-cmp-diff-icon">≠</span> : <span className="cross-cmp-same-icon">=</span>}
                          </div>

                          <div className={'cross-cmp-recipe-col ' + (rightOnly ? 'cross-cmp-col-only' : '')}>
                            <div className="cross-cmp-col-head">
                              <span className="cross-cmp-col-label">温室 B · {crossCmpRightGreenhouse?.name || '?'}</span>
                              {rightHasTrial && (
                                <span className="cross-cmp-trial-tag">
                                  <FlaskConical size={12} />
                                  有试验来源
                                </span>
                              )}
                            </div>
                            {pair.right ? (
                              <>
                                <div className="cross-cmp-params">
                                  <div className={'cross-cmp-param ' + (diffs?.includes('version') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">版本</span>
                                    <strong>v{pair.right.version || '?'}</strong>
                                  </div>
                                  <div className={'cross-cmp-param ' + (diffs?.includes('ec') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">EC</span>
                                    <strong>{pair.right.ec}</strong>
                                  </div>
                                  <div className={'cross-cmp-param ' + (diffs?.includes('ph') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">pH</span>
                                    <strong>{pair.right.ph}</strong>
                                  </div>
                                  <div className={'cross-cmp-param ' + (diffs?.includes('npk') ? 'cross-cmp-param-diff' : '')}>
                                    <span className="cross-cmp-param-label">NPK</span>
                                    <strong>{pair.right.npk}</strong>
                                  </div>
                                </div>
                                {pair.right.memo && (
                                  <div className={'cross-cmp-memo ' + (diffs?.includes('memo') ? 'cross-cmp-memo-diff' : '')}>
                                    <span className="cross-cmp-memo-label">备注</span>
                                    <p>{pair.right.memo}</p>
                                  </div>
                                )}
                                {(pair.right.timeline || []).length > 0 && (
                                  <div className="cross-cmp-timeline">
                                    <span className="cross-cmp-timeline-label">最近状态</span>
                                    <div className="cross-cmp-timeline-list">
                                      {(pair.right.timeline || []).slice(-3).reverse().map((step, i) => (
                                        <span key={i} className="cross-cmp-timeline-step">
                                          {step.at} · {step.status} · {step.by}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="cross-cmp-empty">
                                <span>该温室暂无使用中配方</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="cmp-group-hint">
              <Info size={20} />
              <p>请选择两个<strong>温室</strong>进行跨温室配方对比，系统将自动对比各温室「使用中」的配方差异。</p>
            </div>
          )}
        </div>
      </section>

      <section className="trial-loop-section">
        <div className="panel trial-list-panel">
          <div className="panel-title">
            <FlaskConical size={18} />
            <h2>配方试验闭环</h2>
            <span className="trial-meta">共 {trialMetrics.total} 个试验 · 进行中 {trialMetrics.inProgress} · 已采用 {trialMetrics.adopted}</span>
            {!trialFormVisible && (
              <button
                type="button"
                className="trial-create-btn"
                onClick={() => {
                  setTrialForm({ recipeId: selected?.id || '', goal: '', initialMemo: selected?.memo || '' });
                  setTrialFormVisible(true);
                }}
              >
                <Plus size={14} />
                <span>创建试验</span>
              </button>
            )}
          </div>

          <div className="trial-toolbar">
            <label>
              <span>作物</span>
              <select value={trialFilters.crop} onChange={(e) => setTrialFilters({ ...trialFilters, crop: e.target.value })}>
                <option>全部</option>
                {trialCropOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span>试验状态</span>
              <select value={trialFilters.status} onChange={(e) => setTrialFilters({ ...trialFilters, status: e.target.value })}>
                <option>全部</option>
                {TRIAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {trialFormVisible && (
            <form className="trial-create-form" onSubmit={createTrial}>
              <div className="panel-title trial-form-title">
                <FlaskConical size={16} />
                <h3>创建新试验</h3>
                <button type="button" className="modal-close" onClick={() => setTrialFormVisible(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="trial-form-grid">
                <label className="wide">
                  <span>绑定配方</span>
                  <select value={trialForm.recipeId} onChange={(e) => setTrialForm({ ...trialForm, recipeId: e.target.value })} required>
                    <option value="">请选择要试验的配方</option>
                    {records.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.crop} · {r.stage} — EC {r.ec} / pH {r.ph}（{r.status}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  <span>试验目标</span>
                  <input type="text" value={trialForm.goal} onChange={(e) => setTrialForm({ ...trialForm, goal: e.target.value })} placeholder="如：验证高温期高钾配方的实际表现" />
                </label>
                <label className="wide">
                  <span>初始备注</span>
                  <textarea value={trialForm.initialMemo} onChange={(e) => setTrialForm({ ...trialForm, initialMemo: e.target.value })} placeholder="试验起始条件、区域、种植密度等说明" />
                </label>
              </div>
              <div className="trial-form-actions">
                <button type="button" className="ghost" onClick={() => setTrialFormVisible(false)}>取消</button>
                <button className="primary" type="submit"><Plus size={16} />创建试验</button>
              </div>
            </form>
          )}

          {filteredTrials.length > 0 ? (
            <div className="trial-list">
              {filteredTrials.map((trial) => {
                const trialRecipe = records.find((r) => r.id === trial.recipeId);
                const trialObs = observations.filter((o) => o.trialId === trial.id);
                const isSelected = selectedTrial?.id === trial.id;
                return (
                  <article
                    key={trial.id}
                    className={'trial-card ' + (isSelected ? 'trial-card-active' : '')}
                    onClick={() => setSelectedTrial(trial)}
                  >
                    <div className="trial-card-head">
                      <div className="trial-card-title">
                        <strong>{trial.crop}</strong>
                        <span className="trial-stage-tag">{trial.stage}</span>
                        <span className={'status ' + trialStatusClass(trial.status)}>{trial.status}</span>
                      </div>
                      <span className="trial-id">#{trial.id.slice(0, 6)}</span>
                    </div>
                    <div className="trial-card-body">
                      <p className="trial-goal">{trial.goal}</p>
                      {trialRecipe && (
                        <div className="trial-recipe-mini">
                          <span>EC {trialRecipe.ec}</span>
                          <span>pH {trialRecipe.ph}</span>
                          <span>NPK {trialRecipe.npk}</span>
                        </div>
                      )}
                    </div>
                    <div className="trial-card-foot">
                      <span className="trial-obs-count">
                        <Eye size={12} />
                        观察记录 {trialObs.length}
                      </span>
                      <span className="trial-date">{trial.createdAt?.slice(0, 10)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="trial-empty">
              <FlaskConical size={40} />
              <p>暂无试验记录。点击「创建试验」开始配方试验闭环流程。</p>
              <p className="trial-empty-sub">旧的普通配方记录可在「配方详情」中发起试验。</p>
            </div>
          )}
        </div>

        <div className="panel trial-detail-panel">
          <div className="panel-title">
            <Activity size={18} />
            <h2>试验详情</h2>
          </div>

          {selectedTrial ? (
            <div className="trial-detail">
              <div className="trial-detail-head">
                <div className="trial-detail-title">
                  <strong>{selectedTrial.crop} · {selectedTrial.stage}</strong>
                  <span className={'status ' + trialStatusClass(selectedTrial.status)}>{selectedTrial.status}</span>
                </div>
                <span className="trial-detail-id">#{selectedTrial.id.slice(0, 6)}</span>
              </div>

              <div className="trial-detail-section">
                <div className="trial-section-title"><FlaskConical size={14} />试验目标</div>
                <p className="trial-goal-text">{selectedTrial.goal}</p>
                {selectedTrial.initialMemo && <p className="trial-memo-text">{selectedTrial.initialMemo}</p>}
              </div>

              {selectedTrialRecipe && (
                <div className="trial-detail-section">
                  <div className="trial-section-title"><ClipboardList size={14} />试验配方</div>
                  <div className="trial-recipe-card">
                    <div className="trial-recipe-row">
                      <span>EC <strong>{selectedTrialRecipe.ec}</strong></span>
                      <span>pH <strong>{selectedTrialRecipe.ph}</strong></span>
                      <span>NPK <strong>{selectedTrialRecipe.npk}</strong></span>
                    </div>
                    {selectedTrialRecipe.memo && <p className="trial-recipe-memo">{selectedTrialRecipe.memo}</p>}
                    <button type="button" className="trial-locate-btn" onClick={() => setSelected(selectedTrialRecipe)}>
                      <ArrowRight size={13} />
                      查看配方详情
                    </button>
                  </div>
                </div>
              )}

              {selectedTrialAdoptedRecipe && (
                <div className="trial-detail-section">
                  <div className="trial-section-title"><CheckCircle size={14} />已生成正式配方</div>
                  <div className="trial-adopted-card">
                    <div className="trial-adopted-head">
                      <strong>v{selectedTrialAdoptedRecipe.version}</strong>
                      <span className={'status ' + statusClass(selectedTrialAdoptedRecipe.status)}>{selectedTrialAdoptedRecipe.status}</span>
                    </div>
                    <div className="trial-recipe-row">
                      <span>EC <strong>{selectedTrialAdoptedRecipe.ec}</strong></span>
                      <span>pH <strong>{selectedTrialAdoptedRecipe.ph}</strong></span>
                      <span>NPK <strong>{selectedTrialAdoptedRecipe.npk}</strong></span>
                    </div>
                    <button type="button" className="trial-locate-btn" onClick={() => setSelected(selectedTrialAdoptedRecipe)}>
                      <ArrowRight size={13} />
                      查看正式配方
                    </button>
                  </div>
                </div>
              )}

              <div className="trial-detail-section">
                <div className="trial-section-title">
                  <Eye size={14} />
                  观察记录
                  <span className="trial-obs-badge">{selectedTrialObservations.length} 条</span>
                  {!obsFormVisible && selectedTrial.status !== '已采用' && selectedTrial.status !== '已归档' && (
                    <button
                      type="button"
                      className="trial-add-obs-btn"
                      onClick={() => {
                        setObsForm({ trialId: selectedTrial.id, date: today, leafColor: '', growth: '', rootSystem: '', yieldEstimate: '', anomaly: '', memo: '' });
                        setObsFormVisible(true);
                      }}
                    >
                      <Plus size={12} />
                      添加观察
                    </button>
                  )}
                </div>

                {obsFormVisible && (
                  <form className="obs-form" onSubmit={addObservation}>
                    <div className="obs-form-grid">
                      <label>
                        <span>观察日期</span>
                        <input type="date" value={obsForm.date} onChange={(e) => setObsForm({ ...obsForm, date: e.target.value })} required />
                      </label>
                      <label>
                        <span><Leaf size={12} /> 叶色</span>
                        <select value={obsForm.leafColor} onChange={(e) => setObsForm({ ...obsForm, leafColor: e.target.value })}>
                          <option value="">请选择</option>
                          {LEAF_COLOR_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </label>
                      <label>
                        <span><LeafyGreen size={12} /> 长势</span>
                        <select value={obsForm.growth} onChange={(e) => setObsForm({ ...obsForm, growth: e.target.value })}>
                          <option value="">请选择</option>
                          {GROWTH_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </label>
                      <label>
                        <span><Sprout size={12} /> 根系</span>
                        <select value={obsForm.rootSystem} onChange={(e) => setObsForm({ ...obsForm, rootSystem: e.target.value })}>
                          <option value="">请选择</option>
                          {ROOT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </label>
                      <label>
                        <span><Scale size={12} /> 产量预估</span>
                        <select value={obsForm.yieldEstimate} onChange={(e) => setObsForm({ ...obsForm, yieldEstimate: e.target.value })}>
                          <option value="">请选择</option>
                          {YIELD_ESTIMATE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </label>
                      <label className="wide">
                        <span><Bug size={12} /> 异常描述</span>
                        <textarea value={obsForm.anomaly} onChange={(e) => setObsForm({ ...obsForm, anomaly: e.target.value })} placeholder="如：叶缘焦枯、新叶黄化、根腐等异常现象及位置" />
                      </label>
                      <label className="wide">
                        <span>备注</span>
                        <textarea value={obsForm.memo} onChange={(e) => setObsForm({ ...obsForm, memo: e.target.value })} placeholder="处理措施、天气、水肥操作等补充说明" />
                      </label>
                    </div>
                    <div className="obs-form-actions">
                      <button type="button" className="ghost" onClick={() => setObsFormVisible(false)}>取消</button>
                      <button className="primary" type="submit"><Plus size={14} />保存观察记录</button>
                    </div>
                  </form>
                )}

                {selectedTrialObservations.length > 0 ? (
                  <div className="obs-list">
                    {selectedTrialObservations.map((obs, idx) => (
                      <article className="obs-card" key={obs.id}>
                        <div className="obs-card-head">
                          <span className="obs-index">观察 #{idx + 1}</span>
                          <span className="obs-date">{obs.date}</span>
                          <button type="button" className="ghost-danger obs-delete" onClick={() => removeObservation(obs.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="obs-tags">
                          {obs.leafColor && <span className="obs-tag obs-tag-leaf"><Leaf size={11} />{obs.leafColor}</span>}
                          {obs.growth && <span className="obs-tag obs-tag-growth"><LeafyGreen size={11} />{obs.growth}</span>}
                          {obs.rootSystem && <span className="obs-tag obs-tag-root"><Sprout size={11} />{obs.rootSystem}</span>}
                          {obs.yieldEstimate && <span className="obs-tag obs-tag-yield"><Scale size={11} />{obs.yieldEstimate}</span>}
                        </div>
                        {obs.anomaly && (
                          <div className="obs-anomaly">
                            <Bug size={12} />
                            <p>{obs.anomaly}</p>
                          </div>
                        )}
                        {obs.memo && <p className="obs-memo">{obs.memo}</p>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty">暂无观察记录，点击「添加观察」开始记录试验表现。</p>
                )}
              </div>

              <div className="trial-detail-section">
                <div className="trial-section-title"><History size={14} />试验时间线</div>
                <div className="timeline">
                  {(selectedTrial.timeline || []).map((step, index) => (
                    <span key={index}>{step.at} · {step.status} · {step.by}</span>
                  ))}
                </div>
              </div>

              <div className="trial-actions">
                {selectedTrial.status === '试配中' || selectedTrial.status === '观察中' ? (
                  <>
                    <button
                      type="button"
                      className="trial-adopt-btn"
                      onClick={() => { setAdoptTrialId(selectedTrial.id); setAdoptModalOpen(true); }}
                    >
                      <CheckCircle size={16} />
                      采用为正式配方
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => updateTrialStatus(selectedTrial.id, '已归档')}
                    >
                      <Archive size={14} />
                      归档试验
                    </button>
                  </>
                ) : selectedTrial.status === '已采用' ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => updateTrialStatus(selectedTrial.id, '已归档')}
                  >
                    <Archive size={14} />
                    归档试验
                  </button>
                ) : (
                  <span className="trial-archived-tip">该试验已归档</span>
                )}
              </div>
            </div>
          ) : (
            <p className="empty">从左侧选择一个试验查看详情，或点击「创建试验」开始新的试验流程。</p>
          )}
        </div>
      </section>

      {adoptModalOpen && adoptTrialId && (
        <div className="modal-overlay" onClick={() => { setAdoptModalOpen(false); setAdoptTrialId(null); }}>
          <div className="modal adopt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <CheckCircle size={18} />
                <h3>采用试验为正式配方</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => { setAdoptModalOpen(false); setAdoptTrialId(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="adopt-hint">
                <Info size={20} />
                <div>
                  <p>采用此试验将：</p>
                  <ul>
                    <li>基于试验配方自动生成新版本的正式配方（状态为「使用中」）</li>
                    <li>同组旧的「使用中」配方将自动转为「已归档」</li>
                    <li>试验状态标记为「已采用」，完整试验记录保留可追溯</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost" onClick={() => { setAdoptModalOpen(false); setAdoptTrialId(null); }}>
                取消
              </button>
              <button type="button" className="primary" onClick={() => adoptTrial(adoptTrialId)}>
                <CheckCircle size={16} />
                确认采用
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="import-modal-overlay" onClick={handleImportCancel}>
          <div className="import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="import-modal-header">
              <div className="import-modal-title">
                <Database size={20} />
                <h2>本地数据导入</h2>
              </div>
              <button type="button" className="import-modal-close" onClick={handleImportCancel}>
                <X size={20} />
              </button>
            </div>

            <div className="import-modal-body">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFileSelect}
                className="import-file-input"
              />

              {!importFileInfo && !importProcessing && !importError && (
                <div className="import-drop-zone" onClick={() => importFileInputRef.current?.click()}>
                  <Upload size={48} />
                  <h3>点击选择 JSON 文件</h3>
                  <p>或拖拽文件到此处</p>
                  <p className="import-hint">支持导入配方记录、状态时间线和调整记录</p>
                </div>
              )}

              {importProcessing && (
                <div className="import-processing">
                  <RefreshCw size={32} className="spin" />
                  <p>正在解析文件...</p>
                </div>
              )}

              {importError && (
                <div className="import-error">
                  <AlertTriangle size={24} />
                  <h3>导入失败</h3>
                  <p>{importError}</p>
                  <button type="button" className="primary" onClick={triggerImportFileSelect}>
                    重新选择文件
                  </button>
                </div>
              )}

              {importFileInfo && !importProcessing && (
                <div className="import-file-info">
                  <div className="import-file-meta">
                    <FileText size={18} />
                    <div>
                      <strong>{importFileInfo.name}</strong>
                      <span>{(importFileInfo.size / 1024).toFixed(2)} KB</span>
                    </div>
                  </div>
                  <button type="button" className="ghost" onClick={triggerImportFileSelect}>
                    重新选择
                  </button>
                </div>
              )}

              {importPreview && importPreview.importType && (
                <div className="import-type-indicator">
                  {importPreview.importType === EXPORT_TYPES.FULL_BACKUP ? (
                    <>
                      <Database size={16} />
                      <span className="import-type-label">完整备份文件</span>
                      <span className="import-type-desc">
                        包含 {importPreview.preview.sourceGreenhouses.length} 个温室
                        {importPreview.preview.customTemplateCount > 0 && `，${importPreview.preview.customTemplateCount} 个自定义模板`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Building2 size={16} />
                      <span className="import-type-label">单温室数据</span>
                      {importPreview.preview.sourceGreenhouse?.name && (
                        <span className="import-type-desc">
                          来自「{importPreview.preview.sourceGreenhouse.name}」
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {importPreview && importPreview.availableModes && (
                <div className="import-mode-selector">
                  <div className="import-mode-selector-title">
                    <Settings size={16} />
                    <strong>导入模式</strong>
                  </div>
                  <div className="import-mode-options">
                    {importPreview.availableModes.includes(IMPORT_MODES.OVERWRITE) && (
                      <label className="import-mode-option">
                        <input
                          type="radio"
                          name="importMode"
                          value={IMPORT_MODES.OVERWRITE}
                          checked={importMode === IMPORT_MODES.OVERWRITE}
                          onChange={(e) => setImportMode(e.target.value)}
                        />
                        <div className="import-mode-content">
                          <div className="import-mode-title">
                            <ShieldAlert size={16} />
                            <strong>覆盖整个应用</strong>
                          </div>
                          <p className="import-mode-desc">
                            删除所有现有数据，用备份文件中的内容完全替换。包括所有温室、配方和自定义模板。
                          </p>
                          <div className="import-mode-danger">
                            <AlertTriangle size={14} />
                            <span>此操作不可恢复，建议先导出当前数据备份</span>
                          </div>
                        </div>
                      </label>
                    )}

                    {importPreview.availableModes.includes(IMPORT_MODES.MERGE_CURRENT) && (
                      <label className="import-mode-option">
                        <input
                          type="radio"
                          name="importMode"
                          value={IMPORT_MODES.MERGE_CURRENT}
                          checked={importMode === IMPORT_MODES.MERGE_CURRENT}
                          onChange={(e) => setImportMode(e.target.value)}
                        />
                        <div className="import-mode-content">
                          <div className="import-mode-title">
                            <RefreshCw size={16} />
                            <strong>合并到当前温室</strong>
                          </div>
                          <p className="import-mode-desc">
                            将导入的数据合并到「{activeGreenhouse?.name || '当前温室'}」。ID 相同的记录将被覆盖，新增记录将被添加。
                          </p>
                        </div>
                      </label>
                    )}

                    {importPreview.availableModes.includes(IMPORT_MODES.SPECIFIC_GREENHOUSE) && (
                      <label className="import-mode-option">
                        <input
                          type="radio"
                          name="importMode"
                          value={IMPORT_MODES.SPECIFIC_GREENHOUSE}
                          checked={importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE}
                          onChange={(e) => setImportMode(e.target.value)}
                        />
                        <div className="import-mode-content">
                          <div className="import-mode-title">
                            <Building2 size={16} />
                            <strong>导入到指定温室</strong>
                          </div>
                          <p className="import-mode-desc">
                            选择一个现有的温室，将数据合并到该温室中。
                          </p>
                          {importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE && (
                            <div className="import-target-selector">
                              <label>
                                <span>目标温室</span>
                                <select
                                  value={importTargetGhId || activeGhId}
                                  onChange={(e) => setImportTargetGhId(e.target.value)}
                                >
                                  {greenhouses.map((gh) => (
                                    <option key={gh.id} value={gh.id}>
                                      {gh.name}（{ghState.data[gh.id]?.records?.length || 0} 条配方）
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                        </div>
                      </label>
                    )}

                    {importPreview.availableModes.includes(IMPORT_MODES.NEW_GREENHOUSE) && (
                      <label className="import-mode-option">
                        <input
                          type="radio"
                          name="importMode"
                          value={IMPORT_MODES.NEW_GREENHOUSE}
                          checked={importMode === IMPORT_MODES.NEW_GREENHOUSE}
                          onChange={(e) => setImportMode(e.target.value)}
                        />
                        <div className="import-mode-content">
                          <div className="import-mode-title">
                            <Plus size={16} />
                            <strong>新建温室承接数据</strong>
                          </div>
                          <p className="import-mode-desc">
                            创建一个新的温室，所有导入的数据将自动重新生成 ID 以避免冲突。
                          </p>
                          {importMode === IMPORT_MODES.NEW_GREENHOUSE && (
                            <div className="import-target-selector">
                              <label>
                                <span>新温室名称</span>
                                <input
                                  type="text"
                                  value={importNewGhName}
                                  onChange={(e) => setImportNewGhName(e.target.value)}
                                  placeholder={`导入温室 ${greenhouses.length + 1} 号`}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {importPreview && importPreview.importType === EXPORT_TYPES.FULL_BACKUP && importMode !== IMPORT_MODES.OVERWRITE && (
                <div className="import-source-selector">
                  <div className="import-source-selector-title">
                    <Building2 size={16} />
                    <strong>选择源温室</strong>
                  </div>
                  <div className="import-source-options">
                    {importPreview.preview.sourceGreenhouses.map((gh) => (
                      <label key={gh.id} className="import-source-option">
                        <input
                          type="radio"
                          name="importSourceGh"
                          value={gh.id}
                          checked={importSourceGhId === gh.id}
                          onChange={(e) => setImportSourceGhId(e.target.value)}
                        />
                        <div className="import-source-content">
                          <strong>{gh.name}</strong>
                          {gh.id === importPreview.preview.sourceActiveGhId && (
                            <span className="import-source-active">原激活温室</span>
                          )}
                          <span className="import-source-stats">
                            {importPreview.preview.impactByGh?.[gh.id]?.preview?.records?.newCount || 0} 条配方，
                            {importPreview.preview.impactByGh?.[gh.id]?.preview?.adjRecords?.newCount || 0} 条调整
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {importPreview && (
                <div className="import-preview">
                  {importPreview.warnings.length > 0 && (
                    <div className="import-warnings">
                      <AlertTriangle size={16} />
                      <div>
                        {importPreview.warnings.map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {importPreview.importType === EXPORT_TYPES.FULL_BACKUP && importMode === IMPORT_MODES.OVERWRITE ? (
                    <div className="import-full-backup-preview">
                      <div className="import-preview-section-title">
                        <Database size={16} />
                        <strong>导入影响范围（覆盖整个应用）</strong>
                      </div>
                      <div className="import-backup-summary">
                        <div className="import-backup-summary-item">
                          <span>将删除现有温室数</span>
                          <strong>{greenhouses.length} 个</strong>
                        </div>
                        <div className="import-backup-summary-item">
                          <span>将导入温室数</span>
                          <strong>{importPreview.preview.sourceGreenhouses.length} 个</strong>
                        </div>
                        {importPreview.preview.customTemplateCount > 0 && (
                          <div className="import-backup-summary-item">
                            <span>将导入自定义模板</span>
                            <strong>{importPreview.preview.customTemplateCount} 个</strong>
                          </div>
                        )}
                      </div>

                      <div className="import-backup-greenhouses">
                        {importPreview.preview.sourceGreenhouses.map((gh) => {
                          const impact = importPreview.preview.impactByGh?.[gh.id];
                          const data = importPreview.cleanData.data?.[gh.id];
                          const isActive = gh.id === importPreview.preview.sourceActiveGhId;
                          return (
                            <div key={gh.id} className="import-backup-gh-card">
                              <div className="import-backup-gh-head">
                                <Building2 size={16} />
                                <strong>{gh.name}</strong>
                                {isActive && <span className="import-gh-active-tag">激活</span>}
                              </div>
                              <div className="import-backup-gh-stats">
                                <span>配方 {data?.records?.length || 0} 条</span>
                                <span>调整 {data?.adjRecords?.length || 0} 条</span>
                                <span>试验 {data?.trials?.length || 0} 条</span>
                                <span>观察 {data?.observations?.length || 0} 条</span>
                              </div>
                              {impact?.willOverwrite && (
                                <div className="import-backup-gh-overwrite">
                                  <AlertTriangle size={12} />
                                  <span>将覆盖现有同名温室</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const isFullBackup = importPreview.importType === EXPORT_TYPES.FULL_BACKUP;
                      const impact = isFullBackup && importSourceGhId
                        ? importPreview.preview.impactByGh?.[importSourceGhId]?.preview
                        : importPreview.preview;
                      const sourceGhName = isFullBackup && importSourceGhId
                        ? importPreview.preview.sourceGreenhouses.find(g => g.id === importSourceGhId)?.name
                        : importPreview.preview.sourceGreenhouse?.name;

                      const targetGhName = importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE
                        ? ghState.greenhouses?.[importTargetGhId]?.name
                        : activeGreenhouse?.name;

                      return impact ? (
                        <>
                          <div className="import-preview-section-title">
                            <Activity size={16} />
                            <strong>
                              导入影响范围
                              {sourceGhName && <> · 源：{sourceGhName}</>}
                              {importMode === IMPORT_MODES.NEW_GREENHOUSE && <> · 目标：新建温室</>}
                              {importMode !== IMPORT_MODES.NEW_GREENHOUSE && targetGhName && <> · 目标：{targetGhName}</>}
                            </strong>
                          </div>

                          <div className="import-preview-stats import-preview-stats-4">
                            <div className="import-preview-stat">
                              <div className="import-preview-stat-header">
                                <strong>配方记录</strong>
                              </div>
                              <div className="import-preview-stat-numbers">
                                <span className="import-preview-number import-preview-new">
                                  <Plus size={14} />
                                  新增 {importMode === IMPORT_MODES.NEW_GREENHOUSE ? impact.records.newCount + impact.records.overwriteCount : impact.records.newCount}
                                </span>
                                {importMode !== IMPORT_MODES.NEW_GREENHOUSE && (
                                  <span className="import-preview-number import-preview-overwrite">
                                    <RefreshCw size={14} />
                                    覆盖 {impact.records.overwriteCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="import-preview-stat">
                              <div className="import-preview-stat-header">
                                <strong>调整记录</strong>
                              </div>
                              <div className="import-preview-stat-numbers">
                                <span className="import-preview-number import-preview-new">
                                  <Plus size={14} />
                                  新增 {importMode === IMPORT_MODES.NEW_GREENHOUSE ? impact.adjRecords.newCount + impact.adjRecords.overwriteCount : impact.adjRecords.newCount}
                                </span>
                                {importMode !== IMPORT_MODES.NEW_GREENHOUSE && (
                                  <span className="import-preview-number import-preview-overwrite">
                                    <RefreshCw size={14} />
                                    覆盖 {impact.adjRecords.overwriteCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            {impact.trials && (
                              <div className="import-preview-stat">
                                <div className="import-preview-stat-header">
                                  <strong>试验记录</strong>
                                </div>
                                <div className="import-preview-stat-numbers">
                                  <span className="import-preview-number import-preview-new">
                                    <Plus size={14} />
                                    新增 {importMode === IMPORT_MODES.NEW_GREENHOUSE ? impact.trials.newCount + impact.trials.overwriteCount : impact.trials.newCount}
                                  </span>
                                  {importMode !== IMPORT_MODES.NEW_GREENHOUSE && (
                                    <span className="import-preview-number import-preview-overwrite">
                                      <RefreshCw size={14} />
                                      覆盖 {impact.trials.overwriteCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {impact.observations && (
                              <div className="import-preview-stat">
                                <div className="import-preview-stat-header">
                                  <strong>观察记录</strong>
                                </div>
                                <div className="import-preview-stat-numbers">
                                  <span className="import-preview-number import-preview-new">
                                    <Plus size={14} />
                                    新增 {importMode === IMPORT_MODES.NEW_GREENHOUSE ? impact.observations.newCount + impact.observations.overwriteCount : impact.observations.newCount}
                                  </span>
                                  {importMode !== IMPORT_MODES.NEW_GREENHOUSE && (
                                    <span className="import-preview-number import-preview-overwrite">
                                      <RefreshCw size={14} />
                                      覆盖 {impact.observations.overwriteCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {importMode !== IMPORT_MODES.NEW_GREENHOUSE && impact.records.overwriteItems.length > 0 && (
                            <div className="import-overwrite-preview">
                              <div className="import-overwrite-preview-header">
                                <AlertTriangle size={16} />
                                <strong>将覆盖的配方记录（{impact.records.overwriteItems.length} 条）</strong>
                              </div>
                              <div className="import-overwrite-list">
                                {impact.records.overwriteItems.slice(0, 5).map((item) => (
                                  <div key={item.id} className="import-overwrite-item">
                                    <span className="import-overwrite-crop">{item.crop}</span>
                                    <span className="import-overwrite-stage">{item.stage}</span>
                                    <span className="import-overwrite-version">v{item.version || '?'}</span>
                                    <span className="import-overwrite-status">{item.status}</span>
                                  </div>
                                ))}
                                {impact.records.overwriteItems.length > 5 && (
                                  <p className="import-more-errors">
                                    ...还有 {impact.records.overwriteItems.length - 5} 条记录将被覆盖
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="import-preview-footer">
                            <div className="import-preview-total">
                              <Database size={16} />
                              <span>
                                {importMode === IMPORT_MODES.NEW_GREENHOUSE ? '将创建' : '共导入'} {impact.records.newCount + impact.records.overwriteCount} 条配方，
                                {impact.adjRecords.newCount + impact.adjRecords.overwriteCount} 条调整记录
                                {impact.trials && `，${impact.trials.newCount + impact.trials.overwriteCount} 条试验`}
                                {impact.observations && `，${impact.observations.newCount + impact.observations.overwriteCount} 条观察记录`}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : null;
                    })()
                  )}

                  {importPreview.preview.formatErrors.length > 0 && (
                    <div className="import-format-errors">
                      <div className="import-format-errors-header">
                        <AlertTriangle size={16} />
                        <strong>格式错误（{importPreview.preview.formatErrors.length} 项，将被跳过）</strong>
                      </div>
                      <div className="import-format-errors-list">
                        {importPreview.preview.formatErrors.slice(0, 10).map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                        {importPreview.preview.formatErrors.length > 10 && (
                          <p className="import-more-errors">
                            ...还有 {importPreview.preview.formatErrors.length - 10} 项错误
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {importPreview && importPreview.valid && (
              <div className="import-modal-footer">
                <button type="button" className="ghost" onClick={handleImportCancel}>
                  取消
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleImportConfirm}
                  disabled={!importPreview.valid}
                >
                  <CheckCircle2 size={16} />
                  确认导入
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {exportModalOpen && (
        <div className="modal-overlay" onClick={() => setExportModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <HardDriveDownload size={20} />
                <h3>导出数据</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setExportModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="export-mode-selector">
                <label className="export-mode-option">
                  <input
                    type="radio"
                    name="exportMode"
                    value={EXPORT_TYPES.GREENHOUSE_DATA}
                    checked={exportMode === EXPORT_TYPES.GREENHOUSE_DATA}
                    onChange={(e) => setExportMode(e.target.value)}
                  />
                  <div className="export-mode-content">
                    <div className="export-mode-title">
                      <Building2 size={18} />
                      <strong>当前温室数据</strong>
                    </div>
                    <p className="export-mode-desc">
                      导出「{activeGreenhouse?.name || '当前温室'}」的配方、调整记录、试验和观察记录。适合在不同应用间交换单个温室的数据。
                    </p>
                    <div className="export-mode-stats">
                      <span>配方 {records.length} 条</span>
                      <span>调整 {adjRecords.length} 条</span>
                      <span>试验 {trials.length} 条</span>
                      <span>观察 {observations.length} 条</span>
                    </div>
                  </div>
                </label>

                <label className="export-mode-option">
                  <input
                    type="radio"
                    name="exportMode"
                    value={EXPORT_TYPES.FULL_BACKUP}
                    checked={exportMode === EXPORT_TYPES.FULL_BACKUP}
                    onChange={(e) => setExportMode(e.target.value)}
                  />
                  <div className="export-mode-content">
                    <div className="export-mode-title">
                      <Database size={18} />
                      <strong>完整备份</strong>
                    </div>
                    <p className="export-mode-desc">
                      导出所有温室、当前激活温室、配方、调整记录、试验、观察记录和自定义模板。用于完整备份或迁移整个应用数据。
                    </p>
                    <div className="export-mode-stats">
                      <span>温室 {greenhouses.length} 个</span>
                      <span>自定义模板 {getAllTemplates().filter(t => t.isCustom).length} 个</span>
                    </div>
                    <div className="export-mode-warning">
                      <AlertTriangle size={14} />
                      <span>完整备份包含全部数据，导入时可选择覆盖整个应用</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost" onClick={() => setExportModalOpen(false)}>
                取消
              </button>
              <button type="button" className="primary" onClick={handleExportConfirm}>
                <Download size={16} />
                开始导出
              </button>
            </div>
          </div>
        </div>
      )}

      {ghManagerOpen && (
        <div className="modal-overlay" onClick={() => { setGhManagerOpen(false); setGhRenameId(null); setGhRenameName(''); setGhNewName(''); }}>
          <div className="modal gh-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Building2 size={18} />
                <h3>温室管理</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => { setGhManagerOpen(false); setGhRenameId(null); setGhRenameName(''); setGhNewName(''); }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="gh-create-row">
                <input
                  type="text"
                  value={ghNewName}
                  onChange={(e) => setGhNewName(e.target.value)}
                  placeholder={`输入新温室名称，如：温室 ${greenhouses.length + 1} 号`}
                />
                <button type="button" className="primary" style={{ marginTop: 0, width: 'auto', padding: '10px 18px' }} onClick={handleCreateGreenhouse}>
                  <Plus size={14} />
                  新建温室
                </button>
              </div>

              <div className="gh-list">
                {greenhouses.map((gh) => {
                  const data = ghState.data[gh.id] || createEmptyGreenhouseData();
                  const isActive = gh.id === activeGhId;
                  const isRenaming = ghRenameId === gh.id;
                  return (
                    <div key={gh.id} className={'gh-list-item ' + (isActive ? 'gh-list-item-active' : '')}>
                      {isRenaming ? (
                        <div className="gh-rename-row">
                          <Building2 size={16} />
                          <input
                            type="text"
                            value={ghRenameName}
                            onChange={(e) => setGhRenameName(e.target.value)}
                            placeholder="输入新名称"
                            autoFocus
                          />
                          <button type="button" className="ghost" onClick={() => handleRenameGreenhouse(gh.id)}>
                            <CheckCircle size={14} />确认
                          </button>
                          <button type="button" className="ghost" onClick={() => { setGhRenameId(null); setGhRenameName(''); }}>
                            <X size={14} />取消
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="gh-list-info">
                            <Building2 size={18} />
                            <div className="gh-list-detail">
                              <strong>{gh.name}</strong>
                              <span>
                                {data.records?.length || 0} 配方 · {data.trials?.length || 0} 试验 · {data.observations?.length || 0} 观察
                              </span>
                            </div>
                            {isActive && <span className="gh-active-tag">当前</span>}
                            {gh.migrated && <span className="gh-migrated-tag">已迁移</span>}
                          </div>
                          <div className="gh-list-actions">
                            {!isActive && (
                              <button type="button" className="ghost" onClick={() => handleSwitchGreenhouse(gh.id)}>
                                <ChevronRight size={14} />切换
                              </button>
                            )}
                            <button type="button" className="ghost" onClick={() => { setGhRenameId(gh.id); setGhRenameName(gh.name); }}>
                              <Pencil size={14} />重命名
                            </button>
                            {greenhouses.length > 1 && gh.id !== 'gh-default' && (
                              <button type="button" className="ghost-danger" onClick={() => handleDeleteGreenhouse(gh.id)}>
                                <Trash2 size={14} />删除
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="gh-hint">
                <Info size={14} />
                <p>每个温室拥有独立的配方、试验和观察数据。可将配方复制到其他温室作为试配版本。旧版单温室数据已自动迁移到「默认温室」，原始数据保留不删除。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {copyRecipeModalOpen && copyRecipeTarget && (
        <div className="modal-overlay" onClick={() => { setCopyRecipeModalOpen(false); setCopyRecipeTarget(null); setCopyTargetGhId(''); }}>
          <div className="modal copy-recipe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Copy size={18} />
                <h3>复制配方到其他温室</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => { setCopyRecipeModalOpen(false); setCopyRecipeTarget(null); setCopyTargetGhId(''); }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="copy-recipe-info">
                <div className="copy-recipe-source">
                  <span className="copy-recipe-label">源配方</span>
                  <div className="copy-recipe-detail">
                    <strong>{copyRecipeTarget.crop} · {copyRecipeTarget.stage}</strong>
                    <span>v{copyRecipeTarget.version || '?'} · EC {copyRecipeTarget.ec} · pH {copyRecipeTarget.ph} · NPK {copyRecipeTarget.npk}</span>
                    <em>{copyRecipeTarget.memo}</em>
                  </div>
                </div>
                <div className="copy-recipe-arrow">
                  <ChevronRight size={20} />
                </div>
                <div className="copy-recipe-target">
                  <span className="copy-recipe-label">复制后状态</span>
                  <div className="copy-recipe-status">
                    <span className="status status-a">试配</span>
                    <span>自动生成新版本号</span>
                  </div>
                </div>
              </div>

              <label>
                <span>选择目标温室</span>
                <select value={copyTargetGhId} onChange={(e) => setCopyTargetGhId(e.target.value)}>
                  <option value="">请选择温室</option>
                  {greenhouses.filter((g) => g.id !== activeGhId).map((gh) => (
                    <option key={gh.id} value={gh.id}>{gh.name}（{ghState.data[gh.id]?.records?.length || 0} 配方）</option>
                  ))}
                </select>
              </label>

              {greenhouses.filter((g) => g.id !== activeGhId).length === 0 && (
                <div className="gh-hint">
                  <AlertTriangle size={14} />
                  <p>当前只有一个温室，请先在「温室管理」中新建其他温室。</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost" onClick={() => { setCopyRecipeModalOpen(false); setCopyRecipeTarget(null); setCopyTargetGhId(''); }}>
                取消
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleCopyRecipeToGreenhouse}
                disabled={!copyTargetGhId}
              >
                <Copy size={14} />
                确认复制
              </button>
            </div>
          </div>
        </div>
      )}

      {saveTemplateModalOpen && (
        <div className="modal-overlay" onClick={() => { setSaveTemplateModalOpen(false); }}>
          <div className="modal save-template-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveTemplate}>
              <div className="modal-header">
                <div className="modal-title">
                  <BookOpen size={18} />
                  <h3>保存为自定义模板</h3>
                </div>
                <button type="button" className="modal-close" onClick={() => { setSaveTemplateModalOpen(false); }}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="save-template-preview">
                  <span className="save-template-label">当前配方参数</span>
                  <div className="save-template-params">
                    <span>EC {form.ec || '-'}</span>
                    <span>pH {form.ph || '-'}</span>
                    <span>NPK {form.npk || '-'}</span>
                  </div>
                  {form.memo && <p className="save-template-memo">{form.memo}</p>}
                </div>
                <div className="save-template-form-grid">
                  <label className="wide">
                    <span>模板名称 *</span>
                    <input
                      type="text"
                      value={saveTemplateForm.name}
                      onChange={(e) => setSaveTemplateForm({ ...saveTemplateForm, name: e.target.value })}
                      placeholder="如：番茄 · 开花期（高钾版）"
                      required
                    />
                  </label>
                  <label>
                    <span>作物 *</span>
                    <input
                      type="text"
                      value={saveTemplateForm.crop}
                      onChange={(e) => setSaveTemplateForm({ ...saveTemplateForm, crop: e.target.value })}
                      placeholder="如：番茄"
                      required
                    />
                  </label>
                  <label>
                    <span>生长期 *</span>
                    <select
                      value={saveTemplateForm.stage}
                      onChange={(e) => setSaveTemplateForm({ ...saveTemplateForm, stage: e.target.value })}
                      required
                    >
                      <option value="">请选择</option>
                      {appConfig.fields.find((f) => f.key === 'stage')?.options.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="save-template-hint">
                  <Info size={13} />
                  自定义模板保存在浏览器本地，切换温室后仍可使用。
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="ghost" onClick={() => { setSaveTemplateModalOpen(false); }}>
                  取消
                </button>
                <button type="submit" className="primary">
                  <Plus size={14} />
                  保存模板
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
