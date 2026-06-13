import { useMemo, useState } from 'react';
import { Sprout, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, BookOpen, ChevronDown, ChevronUp, ArrowRight, FileText } from 'lucide-react';
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

function withIds(items) {
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item }));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  if (raw) {
    try {
      return JSON.parse(raw);
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
    const nextRecord = {
      id: uid(),
      ...form,
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
    const copied = { ...item, id: uid(), status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] };
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

  const filteredAdjRecords = useMemo(() => {
    return adjRecords
      .filter((r) => adjFilters.crop === '全部' || r.crop === adjFilters.crop)
      .filter((r) => adjFilters.stage === '全部' || r.stage === adjFilters.stage);
  }, [adjRecords, adjFilters]);

  const adjCropOptions = useMemo(() => [...new Set(adjRecords.map((r) => r.crop))], [adjRecords]);
  const adjStageOptions = useMemo(() => [...new Set(adjRecords.map((r) => r.stage))], [adjRecords]);

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
                    <h3>{item.crop}</h3>
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
    </main>
  );
}

export default App;
