import { useState, useMemo, Fragment } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X, Sprout, Clock, Calendar, Archive, Filter } from 'lucide-react';
import { getAllCropOptions } from './recipeTemplates';

function statusClass(status) {
  const statuses = ['试配', '使用中', '已归档'];
  const index = statuses.indexOf(status);
  return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function isDateInRange(dateStr, startDate, endDate) {
  if (!startDate) return false;
  const date = new Date(dateStr);
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date('9999-12-31');
  return date >= start && date <= end;
}

function RecipeCalendar({ records, onSelectRecipe, onOpenSchedule, selectedRecord }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [cropFilter, setCropFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState('全部');

  const todayStr = today.toISOString().slice(0, 10);

  const calendarCropOptions = useMemo(() => {
    const recordCrops = records.map((r) => r.crop);
    const allCrops = getAllCropOptions();
    return [...new Set([...allCrops, ...recordCrops])];
  }, [records]);
  const calendarStatusOptions = ['试配', '使用中', '已归档'];

  const hasCalendarFilter = cropFilter !== '全部' || statusFilter !== '全部';

  function clearCalendarFilter() {
    setCropFilter('全部');
    setStatusFilter('全部');
  }

  const monthName = useMemo(() => {
    const date = new Date(viewYear, viewMonth, 1);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  }, [viewYear, viewMonth]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const days = [];

    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        currentMonth: false,
        date: formatDate(viewYear, viewMonth - 1, prevMonthDays - i)
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        currentMonth: true,
        date: formatDate(viewYear, viewMonth, i)
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        currentMonth: false,
        date: formatDate(viewYear, viewMonth + 1, i)
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const scheduledRecipes = useMemo(() => {
    let result = records.filter(r => r.startDate);
    if (statusFilter !== '全部') {
      result = result.filter(r => r.status === statusFilter);
    }
    if (cropFilter !== '全部') {
      result = result.filter(r => r.crop === cropFilter);
    }
    return result;
  }, [records, cropFilter, statusFilter]);

  const unscheduledRecipes = useMemo(() => {
    let result = records.filter(r => !r.startDate);
    if (statusFilter !== '全部') {
      result = result.filter(r => r.status === statusFilter);
    }
    if (cropFilter !== '全部') {
      result = result.filter(r => r.crop === cropFilter);
    }
    return result;
  }, [records, cropFilter, statusFilter]);

  function getRecipesForDate(dateStr) {
    return scheduledRecipes.filter(r => isDateInRange(dateStr, r.startDate, r.endDate));
  }

  function getCropSummaryForDate(dateStr) {
    const recipes = getRecipesForDate(dateStr);
    const cropMap = {};
    recipes.forEach(r => {
      if (!cropMap[r.crop]) {
        cropMap[r.crop] = { count: 0, hasInUse: false, hasTrial: false, hasArchived: false, recipes: [] };
      }
      cropMap[r.crop].count++;
      cropMap[r.crop].recipes.push(r);
      if (r.status === '使用中') cropMap[r.crop].hasInUse = true;
      if (r.status === '试配') cropMap[r.crop].hasTrial = true;
      if (r.status === '已归档') cropMap[r.crop].hasArchived = true;
    });
    return cropMap;
  }

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function handleToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function handleDateClick(dateStr) {
    setSelectedDate(dateStr);
    setDayDetailOpen(true);
  }

  const selectedDateRecipes = selectedDate ? getRecipesForDate(selectedDate) : [];

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="calendar-section">
      <div className="panel calendar-panel">
        <div className="panel-title">
          <CalendarDays size={18} />
          <h2>配方使用日历</h2>
          {hasCalendarFilter ? (
            <button type="button" className="board-clear-filter" onClick={clearCalendarFilter}>
              <X size={14} />
              <span>清除筛选（{cropFilter} · {statusFilter}）</span>
            </button>
          ) : (
            <span className="calendar-tip">点击日期查看当天配方，管理使用排期</span>
          )}
        </div>

        <div className="calendar-toolbar">
          <label>
            <span><Filter size={12} /> 作物</span>
            <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
              <option>全部</option>
              {calendarCropOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span><Filter size={12} /> 状态</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>全部</option>
              {calendarStatusOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <span className="warning-filter-count">
            筛选后：月历 {scheduledRecipes.length} 条排期，未排期 {unscheduledRecipes.length} 条
          </span>
        </div>

        <div className="calendar-header">
          <div className="calendar-nav">
            <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>
              <ChevronLeft size={18} />
            </button>
            <strong className="calendar-month-title">{monthName}</strong>
            <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>
              <ChevronRight size={18} />
            </button>
            <button type="button" className="calendar-today-btn" onClick={handleToday}>今天</button>
          </div>
          <div className="calendar-legend">
            <span className="legend-item">
              <span className="legend-dot legend-in-use"></span>使用中
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-trial"></span>试配
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-archived"></span>已归档
            </span>
          </div>
        </div>

        <div className="calendar-grid">
          {weekDays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          {calendarDays.map((dayInfo, idx) => {
            const cropSummary = getCropSummaryForDate(dayInfo.date);
            const cropList = Object.entries(cropSummary);
            const isToday = dayInfo.date === todayStr;
            const isSelected = selectedDate === dayInfo.date;

            return (
              <button
                key={idx}
                type="button"
                className={
                  'calendar-day' +
                  (dayInfo.currentMonth ? '' : ' calendar-day-other') +
                  (isToday ? ' calendar-day-today' : '') +
                  (isSelected ? ' calendar-day-selected' : '')
                }
                onClick={() => handleDateClick(dayInfo.date)}
              >
                <span className="calendar-day-number">{dayInfo.day}</span>
                <div className="calendar-day-crops">
                  {cropList.slice(0, 3).map(([crop, info]) => (
                    <div
                      key={crop}
                      className={
                        'calendar-crop-tag' +
                        (info.hasInUse ? ' calendar-crop-in-use' : '') +
                        (info.hasTrial && !info.hasInUse ? ' calendar-crop-trial' : '') +
                        (info.hasArchived && !info.hasInUse && !info.hasTrial ? ' calendar-crop-archived' : '')
                      }
                    >
                      <Sprout size={10} />
                      <span>{crop}</span>
                    </div>
                  ))}
                  {cropList.length > 3 && (
                    <span className="calendar-crop-more">+{cropList.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="calendar-unscheduled">
          <div className="calendar-unscheduled-title">
            <Archive size={16} />
            <span>未排期配方</span>
            <span className="unscheduled-count">{unscheduledRecipes.length} 条</span>
          </div>
          {unscheduledRecipes.length > 0 ? (
            <div className="unscheduled-list">
              {unscheduledRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  className={'unscheduled-item ' + (selectedRecord?.id === recipe.id ? 'unscheduled-item-active' : '')}
                  onClick={() => onSelectRecipe(recipe)}
                >
                  <div className="unscheduled-item-head">
                    <strong>{recipe.crop}</strong>
                    <span className="version-tag">v{recipe.version || '?'}</span>
                    <span className={'status ' + statusClass(recipe.status)}>{recipe.status}</span>
                  </div>
                  <div className="unscheduled-item-meta">
                    <span>{recipe.stage}</span>
                    <span>EC {recipe.ec}</span>
                    <span>pH {recipe.ph}</span>
                  </div>
                  <button
                    type="button"
                    className="unscheduled-schedule-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRecipe(recipe);
                      onOpenSchedule && onOpenSchedule(recipe);
                    }}
                  >
                    <Calendar size={12} />
                    安排日期
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="unscheduled-empty">所有配方都已安排排期</p>
          )}
        </div>
      </div>

      {dayDetailOpen && selectedDate && (
        <div className="modal-overlay" onClick={() => setDayDetailOpen(false)}>
          <div className="modal day-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <CalendarDays size={18} />
                <h3>{selectedDate} 配方详情</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setDayDetailOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {selectedDateRecipes.length > 0 ? (
                <div className="day-recipe-list">
                  {selectedDateRecipes.map(recipe => (
                    <article
                      key={recipe.id}
                      className={'day-recipe-card ' + (selectedRecord?.id === recipe.id ? 'day-recipe-card-active' : '')}
                      onClick={() => {
                        onSelectRecipe(recipe);
                        setDayDetailOpen(false);
                      }}
                    >
                      <div className="day-recipe-head">
                        <div>
                          <strong>{recipe.crop}</strong>
                          <span className="version-tag">v{recipe.version || '?'}</span>
                        </div>
                        <span className={'status ' + statusClass(recipe.status)}>{recipe.status}</span>
                      </div>
                      <div className="day-recipe-meta">
                        <span className="day-recipe-stage">
                          <Sprout size={12} />
                          {recipe.stage}
                        </span>
                        <span>EC {recipe.ec}</span>
                        <span>pH {recipe.ph}</span>
                      </div>
                      <p className="day-recipe-detail">{recipe.npk}｜{recipe.memo}</p>
                      <div className="day-recipe-schedule">
                        <Clock size={12} />
                        <span>使用周期：{recipe.startDate} ~ {recipe.endDate || '至今'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="day-detail-empty">
                  <CalendarDays size={36} />
                  <p>当天没有排期的配方</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipeCalendar;
