import { useState } from 'react';

const today = new Date().toISOString().slice(0, 10);

function useBatchOperations(records, persist, selected, setSelected) {
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchAction, setBatchAction] = useState(null);
  const [batchScheduleForm, setBatchScheduleForm] = useState({ startDate: '', endDate: '' });

  function toggleBatchMode() {
    setBatchMode(!batchMode);
    setBatchSelectedIds(new Set());
  }

  function toggleBatchSelect(id) {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleBatchSelectAll(displayedIds) {
    setBatchSelectedIds((prev) => {
      const allSelected = displayedIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(displayedIds);
    });
  }

  function openBatchModal(action) {
    if (batchSelectedIds.size === 0) return;
    setBatchAction(action);
    if (action === 'setSchedule') {
      setBatchScheduleForm({ startDate: '', endDate: '' });
    }
    setBatchModalOpen(true);
  }

  function executeBatchAction() {
    if (batchSelectedIds.size === 0 || !batchAction) return;
    const ids = [...batchSelectedIds];
    let next = records;

    if (batchAction === 'archive') {
      next = records.map((item) => {
        if (!ids.includes(item.id)) return item;
        if (item.status === '已归档') return item;
        return {
          ...item,
          status: '已归档',
          timeline: [...(item.timeline || []), { status: '已归档', at: today, by: '批量归档' }]
        };
      });
    } else if (batchAction === 'clearSchedule') {
      next = records.map((item) => {
        if (!ids.includes(item.id)) return item;
        if (!item.startDate && !item.endDate) return item;
        return {
          ...item,
          startDate: undefined,
          endDate: undefined,
          timeline: [...(item.timeline || []), { status: item.status, at: today, by: '批量清除排期' }]
        };
      });
    } else if (batchAction === 'setSchedule') {
      const { startDate, endDate } = batchScheduleForm;
      if (!startDate) return;
      next = records.map((item) => {
        if (!ids.includes(item.id)) return item;
        return {
          ...item,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          timeline: [...(item.timeline || []), { status: item.status, at: today, by: `批量设置周期：${startDate}${endDate ? ' ~ ' + endDate : ''}` }]
        };
      });
    }

    persist(next);

    if (selected && ids.includes(selected.id)) {
      setSelected(next.find((item) => item.id === selected.id) || null);
    }

    setBatchModalOpen(false);
    setBatchAction(null);
    setBatchSelectedIds(new Set());
    setBatchMode(false);
  }

  function closeBatchModal() {
    setBatchModalOpen(false);
    setBatchAction(null);
  }

  return {
    batchMode,
    batchSelectedIds,
    batchModalOpen,
    batchAction,
    batchScheduleForm,
    setBatchScheduleForm,
    toggleBatchMode,
    toggleBatchSelect,
    toggleBatchSelectAll,
    openBatchModal,
    executeBatchAction,
    closeBatchModal,
  };
}

export default useBatchOperations;
