import { useMemo, useState } from 'react';
import { Sprout, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, BookOpen, ChevronDown, ChevronUp, ArrowRight, FileText, Calculator, Droplets, Beaker, Scale, Info, RefreshCw, GitCompareArrows } from 'lucide-react';
import './App.css';
import { recipeTemplates, cropOptions } from './recipeTemplates';

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

function ensureVersions(items) {
  const groups = {};
  items.forEach((item) => {
    const key = `${item.crop}||${item.stage}`;
    (groups[key] ||= []).push(item);
  });
  Object.values(groups).forEach((group) => {
    const used = new Set(group.filter((g) => g.version).map((g) => g.version));
    let next = 1;
    group.forEach((item) => {
      if (item.version) return;
      while (used.has(next)) next++;
      item.version = next;
      used.add(next);
      next++;
    });
  });
  return items;
}

function withIds(items) {
  return ensureVersions(items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item })));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  if (raw) {
    try {
      return ensureVersions(JSON.parse(raw));
    } catch {
      return withIds(appConfig.seed);
    }
  }
  return withIds(appConfig.seed);
}

const adjStorageKey = appConfig.storage + '-adj';

function loadAdjRecords() {
  const raw = localStorage.getItem(adjStorageKey);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

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
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(true);
  const [templateCrop, setTemplateCrop] = useState('全部');
  const [adjRecords, setAdjRecords] = useState(loadAdjRecords);
  const [adjForm, setAdjForm] = useState({ sourceId: '', reason: '', adjustments: '', observations: '' });
  const [adjFilters, setAdjFilters] = useState({ crop: '全部', stage: '全部' });
  const [adjFormVisible, setAdjFormVisible] = useState(false);

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

  function persist(next) {
    setRecords(next);
    localStorage.setItem(appConfig.storage, JSON.stringify(next));
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

  const filteredTemplates = useMemo(() => {
    return recipeTemplates.filter((t) => templateCrop === '全部' || t.crop === templateCrop);
  }, [templateCrop]);

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

  function persistAdj(next) {
    setAdjRecords(next);
    localStorage.setItem(adjStorageKey, JSON.stringify(next));
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
  const cmpCandidates = useMemo(() => {
    return records.filter((r) => {
      if (cmpCrop !== '全部' && r.crop !== cmpCrop) return false;
      if (cmpStage !== '全部' && r.stage !== cmpStage) return false;
      return true;
    }).sort((a, b) => (a.version || 0) - (b.version || 0));
  }, [records, cmpCrop, cmpStage]);
  const cmpLeftRecord = useMemo(() => records.find((r) => r.id === cmpLeft), [records, cmpLeft]);
  const cmpRightRecord = useMemo(() => records.find((r) => r.id === cmpRight), [records, cmpRight]);

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

  const metrics = [
    { label: "作物数", value: new Set(records.map((item) => item.crop)).size },
    { label: "使用中", value: records.filter((item) => item.status === '使用中').length },
    { label: "平均EC", value: avg(records.map((item) => Number(item.ec))).toFixed(1) },
  ];

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
        </div>
        <div className="port-card">
          <span>Local Port</span>
          <strong>{appConfig.port}</strong>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
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
                  <span className="template-count">共 {filteredTemplates.length} 个模板</span>
                  <select value={templateCrop} onChange={(e) => setTemplateCrop(e.target.value)}>
                    <option>全部</option>
                    {cropOptions.map((crop) => <option key={crop}>{crop}</option>)}
                  </select>
                </div>
                <div className="template-grid">
                  {filteredTemplates.map((template) => (
                    <button type="button" key={template.id} className="template-card" onClick={() => applyTemplate(template)}>
                      <div className="template-card-head">
                        <strong>{template.crop}</strong>
                        <span className="template-stage">{template.stage}</span>
                      </div>
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
            {filteredRecords.map((item) => (
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
              {filteredAdjRecords.map((r) => (
                <article className="adj-card" key={r.id}>
                  <div className="adj-card-head">
                    <div>
                      <strong>{r.recipeName}</strong>
                      <span className="adj-source">源：{r.sourceName}</span>
                    </div>
                    <button className="ghost-danger" type="button" onClick={() => removeAdjRecord(r.id)}><Trash2 size={14} /></button>
                  </div>
                  <div className="adj-card-body">
                    <div className="adj-field"><span className="adj-label">调整原因</span><p>{r.reason}</p></div>
                    <div className="adj-field"><span className="adj-label">调整项</span><p>{r.adjustments}</p></div>
                    {r.observations && <div className="adj-field"><span className="adj-label">观察结果</span><p>{r.observations}</p></div>}
                  </div>
                  <div className="adj-card-foot">
                    <span className="adj-crop-stage">{r.crop} · {r.stage}</span>
                    <span className="adj-date">{r.createdAt?.slice(0, 10)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">暂无调整记录。在详情面板中选择配方后可填写调整记录。</p>
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
            <span className="cmp-count">共 {cmpCandidates.length} 个版本可选</span>
          </div>

          {cmpCandidates.length >= 2 ? (
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
          ) : (
            <p className="cmp-hint">请先选择同一作物与生长期，至少需要 2 个版本才能进行对比。</p>
          )}

          {cmpLeftRecord && cmpRightRecord && (
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

              <div className="cmp-divider"><span>状态时间线对比</span></div>

              <div className="cmp-timeline-pair">
                <div className="cmp-timeline-col">
                  <strong>v{cmpLeftRecord.version || '?'} 时间线</strong>
                  {(cmpLeftRecord.timeline || []).length > 0 ? (
                    <div className="cmp-timeline-list">
                      {(cmpLeftRecord.timeline || []).map((step, i) => (
                        <span key={i} className="cmp-timeline-step">{step.at} · {step.status} · {step.by}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="cmp-timeline-empty">无时间线记录</span>
                  )}
                </div>
                <div className="cmp-timeline-col">
                  <strong>v{cmpRightRecord.version || '?'} 时间线</strong>
                  {(cmpRightRecord.timeline || []).length > 0 ? (
                    <div className="cmp-timeline-list">
                      {(cmpRightRecord.timeline || []).map((step, i) => (
                        <span key={i} className="cmp-timeline-step">{step.at} · {step.status} · {step.by}</span>
                      ))}
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
    </main>
  );
}

export default App;
