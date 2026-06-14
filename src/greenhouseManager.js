const MULTI_GH_STORAGE_KEY = 'hxwl-61302-multi-greenhouse';
const LEGACY_STORAGE_KEY = 'hxwl-61302-greenhouse-nutrient';
const LEGACY_ADJ_KEY = 'hxwl-61302-greenhouse-nutrient-adj';
const LEGACY_TRIALS_KEY = 'hxwl-61302-greenhouse-nutrient-trials';
const LEGACY_OBS_KEY = 'hxwl-61302-greenhouse-nutrient-obs';

const DEFAULT_GREENHOUSE_ID = 'gh-default';

function uid() {
  return 'gh-' + Math.random().toString(36).slice(2, 10);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return fallback;
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

function createEmptyGreenhouseData() {
  return {
    records: [],
    adjRecords: [],
    trials: [],
    observations: []
  };
}

function migrateLegacyData() {
  const records = readJSON(LEGACY_STORAGE_KEY, null);
  const adjRecords = readJSON(LEGACY_ADJ_KEY, []);
  const trials = readJSON(LEGACY_TRIALS_KEY, []);
  const observations = readJSON(LEGACY_OBS_KEY, []);

  if (!records || !Array.isArray(records) || records.length === 0) {
    return null;
  }

  return {
    records: ensureVersions(records),
    adjRecords: Array.isArray(adjRecords) ? adjRecords : [],
    trials: Array.isArray(trials) ? trials : [],
    observations: Array.isArray(observations) ? observations : []
  };
}

function createInitialMultiGreenhouseState() {
  const legacyData = migrateLegacyData();
  const hasLegacy = legacyData !== null;

  const state = {
    version: '1.0',
    greenhouses: {},
    activeGreenhouseId: DEFAULT_GREENHOUSE_ID,
    data: {}
  };

  state.greenhouses[DEFAULT_GREENHOUSE_ID] = {
    id: DEFAULT_GREENHOUSE_ID,
    name: hasLegacy ? '默认温室' : '默认温室',
    createdAt: new Date().toISOString(),
    migrated: hasLegacy
  };

  state.data[DEFAULT_GREENHOUSE_ID] = hasLegacy ? legacyData : createEmptyGreenhouseData();

  return state;
}

function loadMultiGreenhouseState() {
  const existing = readJSON(MULTI_GH_STORAGE_KEY, null);
  if (existing && existing.greenhouses && existing.data && existing.activeGreenhouseId) {
    return existing;
  }
  const initial = createInitialMultiGreenhouseState();
  writeJSON(MULTI_GH_STORAGE_KEY, initial);
  return initial;
}

function saveMultiGreenhouseState(state) {
  writeJSON(MULTI_GH_STORAGE_KEY, state);
}

function createGreenhouse(name) {
  const state = loadMultiGreenhouseState();
  const id = uid();
  state.greenhouses[id] = {
    id,
    name: name || '新温室',
    createdAt: new Date().toISOString(),
    migrated: false
  };
  state.data[id] = createEmptyGreenhouseData();
  saveMultiGreenhouseState(state);
  return state;
}

function renameGreenhouse(id, name) {
  const state = loadMultiGreenhouseState();
  if (state.greenhouses[id]) {
    state.greenhouses[id].name = name;
    saveMultiGreenhouseState(state);
  }
  return state;
}

function deleteGreenhouse(id) {
  const state = loadMultiGreenhouseState();
  const ghIds = Object.keys(state.greenhouses);
  if (ghIds.length <= 1) return state;
  if (id === DEFAULT_GREENHOUSE_ID && ghIds.length > 1) {
    const otherId = ghIds.find((gid) => gid !== DEFAULT_GREENHOUSE_ID);
    if (state.activeGreenhouseId === id) {
      state.activeGreenhouseId = otherId;
    }
  }
  delete state.greenhouses[id];
  delete state.data[id];
  if (!state.greenhouses[state.activeGreenhouseId]) {
    state.activeGreenhouseId = Object.keys(state.greenhouses)[0];
  }
  saveMultiGreenhouseState(state);
  return state;
}

function setActiveGreenhouse(id) {
  const state = loadMultiGreenhouseState();
  if (state.greenhouses[id]) {
    state.activeGreenhouseId = id;
    saveMultiGreenhouseState(state);
  }
  return state;
}

function getGreenhouseData(state, greenhouseId) {
  return state.data[greenhouseId] || createEmptyGreenhouseData();
}

function saveGreenhouseData(state, greenhouseId, data) {
  state.data[greenhouseId] = data;
  saveMultiGreenhouseState(state);
  return state;
}

function copyRecipeToGreenhouse(state, sourceGhId, targetGhId, recipe, status = '试配') {
  const sourceData = state.data[sourceGhId];
  const targetData = state.data[targetGhId];
  if (!sourceData || !targetData) return state;

  const sourceRecipe = sourceData.records.find((r) => r.id === recipe.id) || recipe;

  const sameGroup = targetData.records.filter((r) => r.crop === sourceRecipe.crop && r.stage === sourceRecipe.stage);
  const nextVer = sameGroup.length > 0 ? Math.max(...sameGroup.map((r) => r.version || 0)) + 1 : 1;

  const today = new Date().toISOString().slice(0, 10);
  const sourceGhName = state.greenhouses[sourceGhId]?.name || '未知温室';

  const copiedRecipe = {
    ...sourceRecipe,
    id: 'gh-' + Math.random().toString(36).slice(2, 10),
    version: nextVer,
    status: status,
    createdAt: new Date().toISOString(),
    timeline: [
      { status, at: today, by: `从「${sourceGhName}」复制试配` }
    ],
    copiedFrom: {
      greenhouseId: sourceGhId,
      greenhouseName: sourceGhName,
      recipeId: sourceRecipe.id,
      copiedAt: new Date().toISOString()
    }
  };

  targetData.records = [copiedRecipe, ...targetData.records];
  state.data[targetGhId] = targetData;
  saveMultiGreenhouseState(state);
  return state;
}

export {
  MULTI_GH_STORAGE_KEY,
  DEFAULT_GREENHOUSE_ID,
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
  ensureVersions,
  migrateLegacyData
};
