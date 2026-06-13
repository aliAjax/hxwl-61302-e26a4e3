const EXPORT_FORMAT_VERSION = '2.0';

const RECORD_REQUIRED_FIELDS = ['id', 'crop', 'stage', 'ec', 'ph', 'npk', 'status'];
const ADJ_RECORD_REQUIRED_FIELDS = ['id', 'recipeId', 'sourceId', 'crop', 'stage', 'reason', 'adjustments'];
const TRIAL_REQUIRED_FIELDS = ['id', 'recipeId', 'crop', 'stage', 'status'];
const OBSERVATION_REQUIRED_FIELDS = ['id', 'trialId', 'date'];

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

function exportData(records, adjRecords, appConfig, trials, observations) {
  const exportObj = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appId: appConfig.id,
    appTitle: appConfig.title,
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

function generateExportFilename(appConfig) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  return `${appConfig.id}-data-${dateStr}-${timeStr}.json`;
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

function validateImportData(data, currentRecords, currentAdjRecords, appConfig, currentTrials, currentObservations) {
  const result = {
    valid: false,
    errors: [],
    warnings: [],
    preview: {
      records: {
        newCount: 0,
        overwriteCount: 0,
        newItems: [],
        overwriteItems: [],
      },
      adjRecords: {
        newCount: 0,
        overwriteCount: 0,
        newItems: [],
        overwriteItems: [],
      },
      trials: {
        newCount: 0,
        overwriteCount: 0,
        newItems: [],
        overwriteItems: [],
      },
      observations: {
        newCount: 0,
        overwriteCount: 0,
        newItems: [],
        overwriteItems: [],
      },
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

  if (data.formatVersion && data.formatVersion !== EXPORT_FORMAT_VERSION) {
    result.warnings.push(`导入文件格式版本为 ${data.formatVersion}，当前版本为 ${EXPORT_FORMAT_VERSION}，可能存在不兼容`);
  }

  if (data.appId && data.appId !== appConfig.id) {
    result.warnings.push(`导入文件来自应用「${data.appTitle || data.appId}」，可能与当前应用不兼容`);
  }

  if (!Array.isArray(data.records)) {
    result.errors.push('缺少或无效的 records 字段，应为数组');
    return result;
  }

  if (data.adjRecords !== undefined && !Array.isArray(data.adjRecords)) {
    result.errors.push('adjRecords 字段应为数组');
    return result;
  }

  if (data.trials !== undefined && !Array.isArray(data.trials)) {
    result.errors.push('trials 字段应为数组');
    return result;
  }

  if (data.observations !== undefined && !Array.isArray(data.observations)) {
    result.errors.push('observations 字段应为数组');
    return result;
  }

  const formatErrors = [];
  const validRecords = [];
  data.records.forEach((record, index) => {
    const errors = validateRecord(record, index);
    if (errors.length > 0) {
      formatErrors.push(...errors);
    } else {
      validRecords.push(record);
    }
  });

  const validAdjRecords = [];
  const adjRecords = data.adjRecords || [];
  adjRecords.forEach((record, index) => {
    const errors = validateAdjRecord(record, index);
    if (errors.length > 0) {
      formatErrors.push(...errors);
    } else {
      validAdjRecords.push(record);
    }
  });

  const validTrials = [];
  const trials = data.trials || [];
  trials.forEach((record, index) => {
    const errors = validateTrial(record, index);
    if (errors.length > 0) {
      formatErrors.push(...errors);
    } else {
      validTrials.push(record);
    }
  });

  const validObservations = [];
  const observations = data.observations || [];
  observations.forEach((record, index) => {
    const errors = validateObservation(record, index);
    if (errors.length > 0) {
      formatErrors.push(...errors);
    } else {
      validObservations.push(record);
    }
  });

  result.preview.formatErrors = formatErrors;

  const currentRecordIds = new Set(currentRecords.map((r) => r.id));
  const currentAdjRecordIds = new Set(currentAdjRecords.map((r) => r.id));
  const currentTrialIds = new Set((currentTrials || []).map((r) => r.id));
  const currentObservationIds = new Set((currentObservations || []).map((r) => r.id));

  validRecords.forEach((record) => {
    if (currentRecordIds.has(record.id)) {
      result.preview.records.overwriteCount++;
      result.preview.records.overwriteItems.push(record);
    } else {
      result.preview.records.newCount++;
      result.preview.records.newItems.push(record);
    }
  });

  validAdjRecords.forEach((record) => {
    if (currentAdjRecordIds.has(record.id)) {
      result.preview.adjRecords.overwriteCount++;
      result.preview.adjRecords.overwriteItems.push(record);
    } else {
      result.preview.adjRecords.newCount++;
      result.preview.adjRecords.newItems.push(record);
    }
  });

  validTrials.forEach((record) => {
    if (currentTrialIds.has(record.id)) {
      result.preview.trials.overwriteCount++;
      result.preview.trials.overwriteItems.push(record);
    } else {
      result.preview.trials.newCount++;
      result.preview.trials.newItems.push(record);
    }
  });

  validObservations.forEach((record) => {
    if (currentObservationIds.has(record.id)) {
      result.preview.observations.overwriteCount++;
      result.preview.observations.overwriteItems.push(record);
    } else {
      result.preview.observations.newCount++;
      result.preview.observations.newItems.push(record);
    }
  });

  result.cleanData.records = validRecords;
  result.cleanData.adjRecords = validAdjRecords;
  result.cleanData.trials = validTrials;
  result.cleanData.observations = validObservations;
  result.valid = result.errors.length === 0;

  return result;
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

export {
  EXPORT_FORMAT_VERSION,
  exportData,
  downloadJSON,
  generateExportFilename,
  parseImportFile,
  validateImportData,
  mergeImportedData,
  validateRecord,
  validateAdjRecord,
  validateTrial,
  validateObservation,
};
