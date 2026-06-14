const EXPORT_FORMAT_VERSION = '3.0';
const BACKWARD_COMPATIBLE_VERSIONS = ['2.0', '3.0'];

const EXPORT_TYPES = {
  GREENHOUSE_DATA: 'greenhouse-data',
  FULL_BACKUP: 'full-backup'
};

const IMPORT_MODES = {
  OVERWRITE: 'overwrite',
  MERGE_CURRENT: 'merge-current',
  NEW_GREENHOUSE: 'new-greenhouse',
  SPECIFIC_GREENHOUSE: 'specific-greenhouse'
};

const RECORD_REQUIRED_FIELDS = ['id', 'crop', 'stage', 'ec', 'ph', 'npk', 'status'];
const ADJ_RECORD_REQUIRED_FIELDS = ['id', 'recipeId', 'sourceId', 'crop', 'stage', 'reason', 'adjustments'];
const TRIAL_REQUIRED_FIELDS = ['id', 'recipeId', 'crop', 'stage', 'status'];
const OBSERVATION_REQUIRED_FIELDS = ['id', 'trialId', 'date'];
const GREENHOUSE_REQUIRED_FIELDS = ['id', 'name', 'createdAt'];

function validateRecord(record, index) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return [`配方记录 #${index + 1}：格式无效，应为对象`];
  }
  RECORD_REQUIRED_FIELDS.forEach((field) => {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === '') {
      errors.push(`配方记录 #${index + 1}（${record.crop || '未知作物'}）：缺少必填字段「${field}」`);
    }
  });
  if (record.timeline !== undefined) {
    if (!Array.isArray(record.timeline)) {
      errors.push(`配方记录 #${index + 1}（${record.crop || '未知作物'}）：timeline 应为数组`);
    } else {
      record.timeline.forEach((step, stepIdx) => {
        if (!step || typeof step !== 'object') {
          errors.push(`配方记录 #${index + 1}：timeline 第 ${stepIdx + 1} 项格式无效`);
        }
      });
    }
  }
  return errors;
}

function validateAdjRecord(record, index) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return [`调整记录 #${index + 1}：格式无效，应为对象`];
  }
  ADJ_RECORD_REQUIRED_FIELDS.forEach((field) => {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === '') {
      errors.push(`调整记录 #${index + 1}：缺少必填字段「${field}」`);
    }
  });
  return errors;
}

function validateTrial(record, index) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return [`试验记录 #${index + 1}：格式无效，应为对象`];
  }
  TRIAL_REQUIRED_FIELDS.forEach((field) => {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === '') {
      errors.push(`试验记录 #${index + 1}：缺少必填字段「${field}」`);
    }
  });
  return errors;
}

function validateObservation(record, index) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return [`观察记录 #${index + 1}：格式无效，应为对象`];
  }
  OBSERVATION_REQUIRED_FIELDS.forEach((field) => {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === '') {
      errors.push(`观察记录 #${index + 1}：缺少必填字段「${field}」`);
    }
  });
  return errors;
}

function validateGreenhouse(gh, index) {
  const errors = [];
  if (!gh || typeof gh !== 'object') {
    return [`温室 #${index + 1}：格式无效，应为对象`];
  }
  GREENHOUSE_REQUIRED_FIELDS.forEach((field) => {
    if (gh[field] === undefined || gh[field] === null || String(gh[field]).trim() === '') {
      errors.push(`温室 #${index + 1}（${gh.name || '未知温室'}）：缺少必填字段「${field}」`);
    }
  });
  return errors;
}

function validateGreenhouseData(data, ghId, ghName) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return [`温室「${ghName || ghId}」的数据格式无效`];
  }
  if (data.records !== undefined && !Array.isArray(data.records)) {
    errors.push(`温室「${ghName || ghId}」的 records 应为数组`);
  }
  if (data.adjRecords !== undefined && !Array.isArray(data.adjRecords)) {
    errors.push(`温室「${ghName || ghId}」的 adjRecords 应为数组`);
  }
  if (data.trials !== undefined && !Array.isArray(data.trials)) {
    errors.push(`温室「${ghName || ghId}」的 trials 应为数组`);
  }
  if (data.observations !== undefined && !Array.isArray(data.observations)) {
    errors.push(`温室「${ghName || ghId}」的 observations 应为数组`);
  }
  return errors;
}

function detectImportType(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.exportType === EXPORT_TYPES.FULL_BACKUP) return EXPORT_TYPES.FULL_BACKUP;
  if (data.greenhouses && data.data && data.activeGreenhouseId) return EXPORT_TYPES.FULL_BACKUP;
  return EXPORT_TYPES.GREENHOUSE_DATA;
}

function exportGreenhouseData(records, adjRecords, appConfig, trials, observations, greenhouseInfo) {
  const exportObj = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportType: EXPORT_TYPES.GREENHOUSE_DATA,
    exportedAt: new Date().toISOString(),
    appId: appConfig.id,
    appTitle: appConfig.title,
    greenhouseId: greenhouseInfo?.id,
    greenhouseName: greenhouseInfo?.name,
    records: records,
    adjRecords: adjRecords,
    trials: trials || [],
    observations: observations || [],
    meta: {
      recordCount: records.length,
      adjRecordCount: adjRecords.length,
      trialCount: (trials || []).length,
      observationCount: (observations || []).length,
    },
  };
  return JSON.stringify(exportObj, null, 2);
}

function exportFullBackup(multiGhState, appConfig, customTemplates) {
  const greenhouseIds = Object.keys(multiGhState.greenhouses || {});
  let totalRecords = 0, totalAdj = 0, totalTrials = 0, totalObs = 0;
  
  greenhouseIds.forEach((ghId) => {
    const ghData = multiGhState.data?.[ghId];
    if (ghData) {
      totalRecords += ghData.records?.length || 0;
      totalAdj += ghData.adjRecords?.length || 0;
      totalTrials += ghData.trials?.length || 0;
      totalObs += ghData.observations?.length || 0;
    }
  });

  const exportObj = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportType: EXPORT_TYPES.FULL_BACKUP,
    exportedAt: new Date().toISOString(),
    appId: appConfig.id,
    appTitle: appConfig.title,
    version: multiGhState.version,
    greenhouses: multiGhState.greenhouses,
    activeGreenhouseId: multiGhState.activeGreenhouseId,
    data: multiGhState.data,
    customTemplates: customTemplates || [],
    meta: {
      greenhouseCount: greenhouseIds.length,
      activeGreenhouseId: multiGhState.activeGreenhouseId,
      activeGreenhouseName: multiGhState.greenhouses?.[multiGhState.activeGreenhouseId]?.name,
      totalRecords,
      totalAdjRecords: totalAdj,
      totalTrials,
      totalObservations: totalObs,
      customTemplateCount: (customTemplates || []).length,
    },
  };
  return JSON.stringify(exportObj, null, 2);
}

function exportData(records, adjRecords, appConfig, trials, observations) {
  return exportGreenhouseData(records, adjRecords, appConfig, trials, observations);
}

function downloadJSON(jsonString, filename) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateExportFilename(appConfig, exportType, greenhouseInfo) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const typeSuffix = exportType === EXPORT_TYPES.FULL_BACKUP ? 'full-backup' : (greenhouseInfo?.name ? `gh-${greenhouseInfo.name.replace(/\s+/g, '-')}` : 'greenhouse');
  return `${appConfig.id}-${typeSuffix}-${dateStr}-${timeStr}.json`;
}

function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const data = JSON.parse(content);
        resolve(data);
      } catch (err) {
        reject(new Error('JSON 格式解析失败：' + err.message));
      }
    };
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
    reader.readAsText(file);
  });
}

function validateGreenhouseRecords(records, adjRecords, trials, observations) {
  const formatErrors = [];
  const valid = { records: [], adjRecords: [], trials: [], observations: [] };
  
  (records || []).forEach((record, index) => {
    const errors = validateRecord(record, index);
    if (errors.length > 0) formatErrors.push(...errors);
    else valid.records.push(record);
  });

  (adjRecords || []).forEach((record, index) => {
    const errors = validateAdjRecord(record, index);
    if (errors.length > 0) formatErrors.push(...errors);
    else valid.adjRecords.push(record);
  });

  (trials || []).forEach((record, index) => {
    const errors = validateTrial(record, index);
    if (errors.length > 0) formatErrors.push(...errors);
    else valid.trials.push(record);
  });

  (observations || []).forEach((record, index) => {
    const errors = validateObservation(record, index);
    if (errors.length > 0) formatErrors.push(...errors);
    else valid.observations.push(record);
  });

  return { valid, formatErrors };
}

function buildGreenhousePreview(validData, currentGhData) {
  const { records, adjRecords, trials, observations } = validData;
  const current = currentGhData || { records: [], adjRecords: [], trials: [], observations: [] };

  const preview = {
    records: { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
    adjRecords: { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
    trials: { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
    observations: { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
  };

  const currentRecordIds = new Set((current.records || []).map((r) => r.id));
  const currentAdjIds = new Set((current.adjRecords || []).map((r) => r.id));
  const currentTrialIds = new Set((current.trials || []).map((r) => r.id));
  const currentObsIds = new Set((current.observations || []).map((r) => r.id));

  records.forEach((r) => {
    if (currentRecordIds.has(r.id)) { preview.records.overwriteCount++; preview.records.overwriteItems.push(r); }
    else { preview.records.newCount++; preview.records.newItems.push(r); }
  });
  adjRecords.forEach((r) => {
    if (currentAdjIds.has(r.id)) { preview.adjRecords.overwriteCount++; preview.adjRecords.overwriteItems.push(r); }
    else { preview.adjRecords.newCount++; preview.adjRecords.newItems.push(r); }
  });
  trials.forEach((r) => {
    if (currentTrialIds.has(r.id)) { preview.trials.overwriteCount++; preview.trials.overwriteItems.push(r); }
    else { preview.trials.newCount++; preview.trials.newItems.push(r); }
  });
  observations.forEach((r) => {
    if (currentObsIds.has(r.id)) { preview.observations.overwriteCount++; preview.observations.overwriteItems.push(r); }
    else { preview.observations.newCount++; preview.observations.newItems.push(r); }
  });

  return preview;
}

function validateFullBackupData(data, currentMultiGhState, appConfig) {
  const result = {
    valid: false,
    errors: [],
    warnings: [],
    importType: EXPORT_TYPES.FULL_BACKUP,
    availableModes: [IMPORT_MODES.OVERWRITE, IMPORT_MODES.MERGE_CURRENT, IMPORT_MODES.NEW_GREENHOUSE, IMPORT_MODES.SPECIFIC_GREENHOUSE],
    preview: {
      sourceGreenhouses: [],
      sourceActiveGhId: null,
      sourceCustomTemplates: [],
      impactByGh: {},
      formatErrors: [],
      customTemplateCount: 0,
    },
    cleanData: {
      greenhouses: {},
      data: {},
      activeGreenhouseId: null,
      customTemplates: [],
    },
  };

  if (!data || typeof data !== 'object') {
    result.errors.push('导入数据格式无效，应为 JSON 对象');
    return result;
  }

  if (data.formatVersion && !BACKWARD_COMPATIBLE_VERSIONS.includes(data.formatVersion)) {
    result.warnings.push(`导入文件格式版本为 ${data.formatVersion}，当前版本为 ${EXPORT_FORMAT_VERSION}，可能存在不兼容`);
  }

  if (data.appId && data.appId !== appConfig.id) {
    result.warnings.push(`导入文件来自应用「${data.appTitle || data.appId}」，可能与当前应用不兼容`);
  }

  if (!data.greenhouses || typeof data.greenhouses !== 'object') {
    result.errors.push('缺少或无效的 greenhouses 字段');
    return result;
  }

  if (!data.data || typeof data.data !== 'object') {
    result.errors.push('缺少或无效的 data 字段');
    return result;
  }

  if (!data.activeGreenhouseId) {
    result.warnings.push('缺少 activeGreenhouseId 字段，将使用当前激活温室');
  }

  const formatErrors = [];
  const cleanGreenhouses = {};
  const cleanData = {};
  const ghIds = Object.keys(data.greenhouses);

  ghIds.forEach((ghId, index) => {
    const gh = data.greenhouses[ghId];
    const ghErrors = validateGreenhouse(gh, index);
    if (ghErrors.length > 0) {
      formatErrors.push(...ghErrors);
      return;
    }

    const ghData = data.data[ghId];
    const dataErrors = validateGreenhouseData(ghData, ghId, gh.name);
    if (dataErrors.length > 0) {
      formatErrors.push(...dataErrors);
      return;
    }

    const { valid, formatErrors: recordErrors } = validateGreenhouseRecords(
      ghData?.records,
      ghData?.adjRecords,
      ghData?.trials,
      ghData?.observations
    );
    if (recordErrors.length > 0) {
      formatErrors.push(...recordErrors.map(e => `[${gh.name || ghId}] ${e}`));
    }

    cleanGreenhouses[ghId] = gh;
    cleanData[ghId] = {
      records: valid.records,
      adjRecords: valid.adjRecords,
      trials: valid.trials,
      observations: valid.observations,
    };
  });

  result.preview.formatErrors = formatErrors;
  result.preview.sourceGreenhouses = Object.values(cleanGreenhouses);
  result.preview.sourceActiveGhId = data.activeGreenhouseId;
  result.preview.sourceCustomTemplates = data.customTemplates || [];
  result.preview.customTemplateCount = (data.customTemplates || []).length;

  Object.keys(cleanGreenhouses).forEach((ghId) => {
    const gh = cleanGreenhouses[ghId];
    const ghData = cleanData[ghId];
    const currentGhData = currentMultiGhState?.data?.[ghId];
    const ghPreview = buildGreenhousePreview(ghData, currentGhData);
    result.preview.impactByGh[ghId] = {
      greenhouse: gh,
      preview: ghPreview,
      willOverwrite: currentMultiGhState?.greenhouses?.[ghId] ? true : false,
    };
  });

  result.cleanData.greenhouses = cleanGreenhouses;
  result.cleanData.data = cleanData;
  result.cleanData.activeGreenhouseId = data.activeGreenhouseId || Object.keys(cleanGreenhouses)[0];
  result.cleanData.customTemplates = data.customTemplates || [];
  result.valid = result.errors.length === 0;

  return result;
}

function validateGreenhouseDataImport(data, currentMultiGhState, appConfig, targetGhId) {
  const result = {
    valid: false,
    errors: [],
    warnings: [],
    importType: EXPORT_TYPES.GREENHOUSE_DATA,
    availableModes: [IMPORT_MODES.MERGE_CURRENT, IMPORT_MODES.NEW_GREENHOUSE, IMPORT_MODES.SPECIFIC_GREENHOUSE],
    preview: {
      sourceGreenhouse: {
        id: data.greenhouseId,
        name: data.greenhouseName,
      },
      impact: null,
      formatErrors: [],
    },
    cleanData: {
      records: [],
      adjRecords: [],
      trials: [],
      observations: [],
    },
  };

  if (!data || typeof data !== 'object') {
    result.errors.push('导入数据格式无效，应为 JSON 对象');
    return result;
  }

  if (data.formatVersion && !BACKWARD_COMPATIBLE_VERSIONS.includes(data.formatVersion)) {
    result.warnings.push(`导入文件格式版本为 ${data.formatVersion}，当前版本为 ${EXPORT_FORMAT_VERSION}，可能存在不兼容`);
  }

  if (data.appId && data.appId !== appConfig.id) {
    result.warnings.push(`导入文件来自应用「${data.appTitle || data.appId}」，可能与当前应用不兼容`);
  }

  if (!Array.isArray(data.records)) {
    result.errors.push('缺少或无效的 records 字段，应为数组');
    return result;
  }

  const { valid, formatErrors } = validateGreenhouseRecords(
    data.records,
    data.adjRecords,
    data.trials,
    data.observations
  );

  result.preview.formatErrors = formatErrors;
  result.cleanData.records = valid.records;
  result.cleanData.adjRecords = valid.adjRecords;
  result.cleanData.trials = valid.trials;
  result.cleanData.observations = valid.observations;

  const targetData = targetGhId ? currentMultiGhState?.data?.[targetGhId] : currentMultiGhState?.data?.[currentMultiGhState.activeGreenhouseId];

  result.preview.impact = buildGreenhousePreview(valid, targetData);

  result.valid = result.errors.length === 0;

  return result;
}

function validateImportData(data, currentRecords, currentAdjRecords, appConfig, currentTrials, currentObservations, currentMultiGhState, targetGhId) {
  const importType = detectImportType(data);

  if (importType === EXPORT_TYPES.FULL_BACKUP) {
    return validateFullBackupData(data, currentMultiGhState, appConfig);
  }

  const ghResult = validateGreenhouseDataImport(data, currentMultiGhState, appConfig, targetGhId);

  return {
    ...ghResult,
    preview: {
      records: ghResult.preview.impact?.records || { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
      adjRecords: ghResult.preview.impact?.adjRecords || { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
      trials: ghResult.preview.impact?.trials || { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
      observations: ghResult.preview.impact?.observations || { newCount: 0, overwriteCount: 0, newItems: [], overwriteItems: [] },
      formatErrors: ghResult.preview.formatErrors,
      ...ghResult.preview,
    },
    cleanData: {
      records: ghResult.cleanData.records,
      adjRecords: ghResult.cleanData.adjRecords,
      trials: ghResult.cleanData.trials,
      observations: ghResult.cleanData.observations,
    },
  };
}

function mergeImportedData(cleanData, currentRecords, currentAdjRecords, currentTrials, currentObservations) {
  const {
    records: importedRecords,
    adjRecords: importedAdjRecords,
    trials: importedTrials,
    observations: importedObservations,
  } = cleanData;

  const recordMap = new Map();
  currentRecords.forEach((r) => recordMap.set(r.id, r));
  importedRecords.forEach((r) => recordMap.set(r.id, r));
  const mergedRecords = Array.from(recordMap.values());

  const adjMap = new Map();
  currentAdjRecords.forEach((r) => adjMap.set(r.id, r));
  importedAdjRecords.forEach((r) => adjMap.set(r.id, r));
  const mergedAdjRecords = Array.from(adjMap.values());

  const trialMap = new Map();
  (currentTrials || []).forEach((r) => trialMap.set(r.id, r));
  (importedTrials || []).forEach((r) => trialMap.set(r.id, r));
  const mergedTrials = Array.from(trialMap.values());

  const observationMap = new Map();
  (currentObservations || []).forEach((r) => observationMap.set(r.id, r));
  (importedObservations || []).forEach((r) => observationMap.set(r.id, r));
  const mergedObservations = Array.from(observationMap.values());

  return {
    records: mergedRecords,
    adjRecords: mergedAdjRecords,
    trials: mergedTrials,
    observations: mergedObservations,
  };
}

function overwriteWithFullBackup(cleanData, appConfig) {
  return {
    version: '1.0',
    greenhouses: { ...cleanData.greenhouses },
    activeGreenhouseId: cleanData.activeGreenhouseId || Object.keys(cleanData.greenhouses)[0],
    data: { ...cleanData.data },
    customTemplates: cleanData.customTemplates || [],
  };
}

function generateNewGreenhouseId(currentGhState) {
  let newId;
  do {
    newId = 'gh-' + Math.random().toString(36).slice(2, 10);
  } while (currentGhState.greenhouses && currentGhState.greenhouses[newId]);
  return newId;
}

function regenerateIdsForGreenhouseData(ghData) {
  const idMapping = {};

  const newRecords = (ghData.records || []).map((r) => {
    const newId = 'gh-' + Math.random().toString(36).slice(2, 10);
    idMapping[r.id] = newId;
    return { ...r, id: newId };
  });

  const newTrials = (ghData.trials || []).map((t) => {
    const newId = 'gh-' + Math.random().toString(36).slice(2, 10);
    idMapping[t.id] = newId;
    const newRecipeId = idMapping[t.recipeId] || t.recipeId;
    return { ...t, id: newId, recipeId: newRecipeId, adoptedRecipeId: t.adoptedRecipeId ? (idMapping[t.adoptedRecipeId] || t.adoptedRecipeId) : null };
  });

  const newObservations = (ghData.observations || []).map((o) => {
    const newId = 'gh-' + Math.random().toString(36).slice(2, 10);
    const newTrialId = idMapping[o.trialId] || o.trialId;
    return { ...o, id: newId, trialId: newTrialId };
  });

  const newAdjRecords = (ghData.adjRecords || []).map((a) => {
    const newId = 'gh-' + Math.random().toString(36).slice(2, 10);
    const newRecipeId = idMapping[a.recipeId] || a.recipeId;
    const newSourceId = idMapping[a.sourceId] || a.sourceId;
    return { ...a, id: newId, recipeId: newRecipeId, sourceId: newSourceId };
  });

  newRecords.forEach((r) => {
    if (r.fromTrialId) {
      r.fromTrialId = idMapping[r.fromTrialId] || r.fromTrialId;
    }
    if (r.copiedFrom?.recipeId) {
      r.copiedFrom.recipeId = idMapping[r.copiedFrom.recipeId] || r.copiedFrom.recipeId;
    }
  });

  return {
    records: newRecords,
    adjRecords: newAdjRecords,
    trials: newTrials,
    observations: newObservations,
  };
}

function createNewGreenhouseFromImport(currentGhState, cleanData, importType, newGreenhouseName) {
  const newId = generateNewGreenhouseId(currentGhState);
  const timestamp = new Date().toISOString();
  const name = newGreenhouseName || `导入温室 ${Object.keys(currentGhState.greenhouses || {}).length + 1} 号`;

  let ghData;
  if (importType === EXPORT_TYPES.FULL_BACKUP) {
    const sourceGhIds = Object.keys(cleanData.data || {});
    if (sourceGhIds.length > 0) {
      const sourceGhId = cleanData.activeGreenhouseId || sourceGhIds[0];
      ghData = regenerateIdsForGreenhouseData(cleanData.data[sourceGhId] || { records: [], adjRecords: [], trials: [], observations: [] });
    } else {
      ghData = { records: [], adjRecords: [], trials: [], observations: [] };
    }
  } else {
    ghData = regenerateIdsForGreenhouseData({
      records: cleanData.records || [],
      adjRecords: cleanData.adjRecords || [],
      trials: cleanData.trials || [],
      observations: cleanData.observations || [],
    });
  }

  const newState = {
    ...currentGhState,
    greenhouses: {
      ...currentGhState.greenhouses,
      [newId]: {
        id: newId,
        name,
        createdAt: timestamp,
        migrated: false,
        importedAt: timestamp,
      },
    },
    data: {
      ...currentGhState.data,
      [newId]: ghData,
    },
    activeGreenhouseId: newId,
  };

  return { newState, newGreenhouseId: newId };
}

function mergeIntoSpecificGreenhouse(currentGhState, cleanData, targetGhId, importType, sourceGhId) {
  if (!currentGhState.greenhouses || !currentGhState.greenhouses[targetGhId]) {
    return currentGhState;
  }

  let sourceData;
  if (importType === EXPORT_TYPES.FULL_BACKUP) {
    const ghId = sourceGhId || cleanData.activeGreenhouseId || Object.keys(cleanData.data || {})[0];
    sourceData = cleanData.data?.[ghId] || { records: [], adjRecords: [], trials: [], observations: [] };
  } else {
    sourceData = {
      records: cleanData.records || [],
      adjRecords: cleanData.adjRecords || [],
      trials: cleanData.trials || [],
      observations: cleanData.observations || [],
    };
  }

  const targetData = currentGhState.data[targetGhId] || { records: [], adjRecords: [], trials: [], observations: [] };
  const merged = mergeImportedData(sourceData, targetData.records, targetData.adjRecords, targetData.trials, targetData.observations);

  return {
    ...currentGhState,
    data: {
      ...currentGhState.data,
      [targetGhId]: merged,
    },
  };
}

function applyImportMode(importMode, currentGhState, cleanData, importType, options = {}) {
  switch (importMode) {
    case IMPORT_MODES.OVERWRITE:
      return overwriteWithFullBackup(cleanData, options.appConfig);

    case IMPORT_MODES.MERGE_CURRENT:
      return mergeIntoSpecificGreenhouse(
        currentGhState,
        cleanData,
        currentGhState.activeGreenhouseId,
        importType,
        options.sourceGhId
      );

    case IMPORT_MODES.SPECIFIC_GREENHOUSE:
      return mergeIntoSpecificGreenhouse(
        currentGhState,
        cleanData,
        options.targetGhId,
        importType,
        options.sourceGhId
      );

    case IMPORT_MODES.NEW_GREENHOUSE:
      const { newState } = createNewGreenhouseFromImport(
        currentGhState,
        cleanData,
        importType,
        options.newGreenhouseName
      );
      return newState;

    default:
      return currentGhState;
  }
}

export {
  EXPORT_FORMAT_VERSION,
  EXPORT_TYPES,
  IMPORT_MODES,
  exportData,
  exportGreenhouseData,
  exportFullBackup,
  downloadJSON,
  generateExportFilename,
  parseImportFile,
  validateImportData,
  validateFullBackupData,
  validateGreenhouseDataImport,
  detectImportType,
  mergeImportedData,
  overwriteWithFullBackup,
  createNewGreenhouseFromImport,
  mergeIntoSpecificGreenhouse,
  applyImportMode,
  buildGreenhousePreview,
  validateRecord,
  validateAdjRecord,
  validateTrial,
  validateObservation,
  validateGreenhouse,
  validateGreenhouseData,
  regenerateIdsForGreenhouseData,
};
