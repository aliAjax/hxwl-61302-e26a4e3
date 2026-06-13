const EXPORT_FORMAT_VERSION = '1.0';

const RECORD_REQUIRED_FIELDS = ['id', 'crop', 'stage', 'ec', 'ph', 'npk', 'status'];
const ADJ_RECORD_REQUIRED_FIELDS = ['id', 'recipeId', 'sourceId', 'crop', 'stage', 'reason', 'adjustments'];

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

function exportData(records, adjRecords, appConfig) {
  const exportObj = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appId: appConfig.id,
    appTitle: appConfig.title,
    records: records,
    adjRecords: adjRecords,
    meta: {
      recordCount: records.length,
      adjRecordCount: adjRecords.length,
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

function validateImportData(data, currentRecords, currentAdjRecords, appConfig) {
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
      formatErrors: [],
    },
    cleanData: {
      records: [],
      adjRecords: [],
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

  result.preview.formatErrors = formatErrors;

  const currentRecordIds = new Set(currentRecords.map((r) => r.id));
  const currentAdjRecordIds = new Set(currentAdjRecords.map((r) => r.id));

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

  result.cleanData.records = validRecords;
  result.cleanData.adjRecords = validAdjRecords;
  result.valid = result.errors.length === 0;

  return result;
}

function mergeImportedData(cleanData, currentRecords, currentAdjRecords) {
  const { records: importedRecords, adjRecords: importedAdjRecords } = cleanData;

  const recordMap = new Map();
  currentRecords.forEach((r) => recordMap.set(r.id, r));
  importedRecords.forEach((r) => recordMap.set(r.id, r));
  const mergedRecords = Array.from(recordMap.values());

  const adjMap = new Map();
  currentAdjRecords.forEach((r) => adjMap.set(r.id, r));
  importedAdjRecords.forEach((r) => adjMap.set(r.id, r));
  const mergedAdjRecords = Array.from(adjMap.values());

  return {
    records: mergedRecords,
    adjRecords: mergedAdjRecords,
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
};
