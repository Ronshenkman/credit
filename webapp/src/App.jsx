import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, LabelList
} from 'recharts';
import { Activity, Calendar, BarChart3, Clock, Target } from 'lucide-react';

const renderCustomBarLabel = ({ x, y, width, height, value }) => {
  if (value === undefined || value === null) return null;
  const isNegative = value < 0;

  // In Recharts BarChart, for negative values:
  // y = the 0 line (baseline)
  // height = the length of the bar going DOWN
  // So the bottom of the bar is y + height.
  // For positive values, y is the top, so we want to be above or below.

  const yPos = isNegative ? y + height + 20 : y + height + 20;

  return (
    <text
      x={x + width / 2}
      y={yPos}
      fill="var(--text-active)"
      textAnchor="middle"
      dominantBaseline="hanging"
      fontSize={13}
      fontWeight="700"
    >
      {`${value > 0 ? '+' : ''}${parseFloat(value).toFixed(0)}%`}
    </text>
  );
};
import FileUploader from './components/FileUploader';
import { processExcelData } from './utils/processData';
import './index.css';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUploadDate, setLastUploadDate] = useState(null);

  const [category, setCategory] = useState("סה\"כ");
  const [basePeriod, setBasePeriod] = useState("change_14");
  const [maxDays, setMaxDays] = useState("100");
  const [avgDays, setAvgDays] = useState(6);

  // Load from backend API on init
  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setData(result.data);
          const dateStr = new Date(result.lastUploadDate).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
          setLastUploadDate(dateStr);
        }
      })
      .catch(err => {
        console.error("Failed to load saved data from server", err);
      });
  }, []);

  // Process file and save to backend
  const handleFileLoaded = async (buffer) => {
    try {
      setLoading(true);
      setError(null);

      const parsedData = await processExcelData(buffer);

      // Save it to backend
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedData })
      });

      const result = await response.json();

      if (result.success) {
        setData(parsedData);
        const dateStr = new Date(result.lastUploadDate).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
        setLastUploadDate(dateStr);
      } else {
        throw new Error(result.error || "Server failed to save data");
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "שגיאה בלתי צפויה בתהליך ההעלאה.");
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    if (!data || !data["חרבות ברזל"]) return [];
    return Object.keys(data["חרבות ברזל"]);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];

    // We want to pivot the data so each row represents a `day` on the X-axis
    // And contains the values for the 3 operations.
    const maxDayLimit = maxDays === "max" ? 1000 : parseInt(maxDays);
    const dayMap = {};

    Object.entries(data).forEach(([opName, opData]) => {
      const catData = opData[category]?.data || [];

      catData.forEach(item => {
        if (item.day <= maxDayLimit) {
          if (!dayMap[item.day]) {
            dayMap[item.day] = { day: item.day };
          }
          dayMap[item.day][opName] = item[basePeriod];
        }
      });
    });

    return Object.values(dayMap).sort((a, b) => a.day - b.day);
  }, [data, category, basePeriod, maxDays]);

  const xTicks = useMemo(() => {
    const limit = maxDays === "max" ? 400 : parseInt(maxDays);
    const ticks = [];
    for (let i = 0; i <= limit; i += 5) ticks.push(i);
    return ticks;
  }, [maxDays]);

  const barChartData = useMemo(() => {
    if (!data) return [];

    const result = [];
    const ops = [
      { name: "חרבות ברזל", color: "var(--line-iron)" },
      { name: "עם כלביא", color: "var(--line-rising)" },
      { name: "שאגת הארי", color: "var(--line-roaring)" }
    ];

    ops.forEach(op => {
      if (data[op.name] && data[op.name][category]) {
        const catData = data[op.name][category].data || [];

        // We only want to average the first X days of the event, excluding Day 0 (the anchor day where everything is 0%)
        const validDays = catData.filter(item => item.day > 0 && item.day <= avgDays);

        let sum = 0;
        let count = 0;
        validDays.forEach(item => {
          if (item[basePeriod] !== undefined && item[basePeriod] !== null) {
            sum += item[basePeriod];
            count++;
          }
        });

        const avg = count > 0 ? sum / count : 0;
        result.push({
          name: op.name,
          value: avg,
          color: op.color
        });
      }
    });

    return result;
  }, [data, category, basePeriod, avgDays]);

  const comparisonChartData = useMemo(() => {
    if (!data) return [];

    const ops = ["חרבות ברזל", "עם כלביא", "שאגת הארי"];
    return categories.map(cat => {
      const row = { category: cat };
      ops.forEach(op => {
        if (data[op] && data[op][cat]) {
          const catData = data[op][cat].data || [];
          const validDays = catData.filter(item => item.day > 0 && item.day <= avgDays);

          let sum = 0;
          let count = 0;
          validDays.forEach(item => {
            if (item[basePeriod] !== undefined && item[basePeriod] !== null) {
              sum += item[basePeriod];
              count++;
            }
          });
          row[op] = count > 0 ? sum / count : 0;
        } else {
          row[op] = 0;
        }
      });
      return row;
    });
  }, [data, categories, basePeriod, avgDays]);

  // if (loading) return <div className="app-container"><div className="loading">Loading data...</div></div>;
  if (error) return <div className="app-container"><div className="error">Error: {error}</div></div>;

  return (
    <div className="app-container" dir="rtl">
      <header>
        <h1>ניתוח הוצאות בכרטיסי אשראי</h1>
        <p>השוואת הפגיעה הכלכלית של מבצעים צבאיים ביחס לתקופת הבסיס.</p>
      </header>

      <FileUploader onFileLoaded={handleFileLoaded} onError={setError} />

      {lastUploadDate && !loading && (
        <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-muted)' }}>
          <small>נתונים נטענו לאחרונה: {lastUploadDate}</small>
        </div>
      )}

      {loading && <div className="loading">מעבד נתונים...</div>}

      {data && !loading && (
        <>
          <div className="controls-panel">
            <div className="control-group">
              <label><BarChart3 size={16} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'text-bottom' }} /> קטגוריה</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label><Calendar size={16} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'text-bottom' }} /> תקופת בסיס</label>
              <select value={basePeriod} onChange={e => setBasePeriod(e.target.value)}>
                <option value="change_14">ממוצע 14 ימים</option>
                <option value="change_28">ממוצע 28 ימים</option>
              </select>
            </div>

            <div className="control-group">
              <label><Clock size={16} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'text-bottom' }} /> חלון זמן (ציר X)</label>
              <select value={maxDays} onChange={e => setMaxDays(e.target.value)}>
                <option value="30">30 ימים</option>
                <option value="60">60 ימים</option>
                <option value="100">100 ימים</option>
                <option value="180">חצי שנה (180 ימים)</option>
                <option value="max">מקסימום זמין</option>
              </select>
            </div>


          </div>

          <div className="chart-container" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="day"
                  domain={[0, 'dataMax']}
                  ticks={xTicks}
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  label={{ value: 'ימים מפרוץ המלחמה/המבצע', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 14 }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  domain={[
                    (dataMin) => Math.floor((Math.min(0, dataMin) - 5) / 10) * 10,
                    (dataMax) => Math.ceil((Math.max(0, dataMax) + 5) / 10) * 10
                  ]}
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
                />
                <Tooltip
                  itemSorter={(item) => -item.value}
                  formatter={(value, name) => [
                    <span dir="ltr" style={{ display: 'inline-block' }}>
                      {`${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}%`}
                    </span>,
                    name
                  ]}
                  labelFormatter={(label) => `יום ${label}`}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderRadius: '12px',
                    border: '1px solid var(--panel-border)',
                    boxShadow: '0 12px 20px -5px rgba(0, 0, 0, 0.15)',
                    textAlign: 'right',
                    padding: '8px 12px'
                  }}
                  itemStyle={{
                    fontSize: '14px',
                    fontWeight: '500',
                    padding: '2px 0',
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    justifyContent: 'flex-start',
                    gap: '4px'
                  }}
                  labelStyle={{
                    fontWeight: '700',
                    color: 'var(--text-active)',
                    marginBottom: '8px',
                    borderBottom: '1px solid var(--panel-border)',
                    paddingBottom: '4px',
                    textAlign: 'right'
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                <Line
                  type="linear"
                  dataKey="חרבות ברזל"
                  stroke="var(--line-iron)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="linear"
                  dataKey="עם כלביא"
                  stroke="var(--line-rising)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="linear"
                  dataKey="שאגת הארי"
                  stroke="var(--line-roaring)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container" dir="ltr" style={{ marginTop: '2.5rem', height: '450px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div className="control-group" style={{
                background: 'var(--panel-bg)',
                padding: '8px 16px',
                borderRadius: '12px',
                border: '1px solid var(--panel-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <label style={{ margin: 0, whiteSpace: 'nowrap' }}>
                  <Target size={18} style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />
                  ממוצע של כמה ימים?
                </label>
                <input
                  type="number"
                  value={avgDays}
                  onChange={e => setAvgDays(parseInt(e.target.value) || 1)}
                  min="1"
                  max="100"
                  style={{ width: '70px', textAlign: 'center' }}
                />
              </div>
            </div>

            <h3 style={{ textAlign: 'center', margin: '0 0 1.5rem', color: 'var(--text-active)', fontWeight: '600' }} dir="rtl">
              ממוצע שינוי ב-{avgDays} הימים הראשונים
            </h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart
                data={barChartData}
                margin={{ top: 30, right: 30, left: 30, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 14 }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  domain={[
                    (dataMin) => Math.floor((Math.min(0, dataMin) - 5) / 10) * 10,
                    (dataMax) => Math.ceil((Math.max(0, dataMax) + 5) / 10) * 10
                  ]}
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, 'ממוצע']}
                  cursor={{ fill: 'var(--panel-border)', opacity: 0.4 }}
                />
                <ReferenceLine y={0} stroke="var(--text-muted)" />
                <Bar dataKey="value" maxBarSize={120}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="bottom"
                    offset={10}
                    formatter={(value) => `${value > 0 ? '+' : ''}${parseFloat(value).toFixed(0)}%`}
                    style={{ fill: 'var(--text-active)', fontSize: 13, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container" dir="ltr" style={{ marginTop: '3rem', height: '600px', width: '100%', overflowX: 'auto' }}>
            <h3 style={{ textAlign: 'center', margin: '2rem 0 1.5rem', color: 'var(--text-active)', fontWeight: '600' }} dir="rtl">
              השוואת הפגיעה לפי ענפים - ממוצע {avgDays} ימים ראשונים
            </h3>
            <div style={{ minWidth: '2000px', height: '500px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonChartData}
                  margin={{ top: 40, right: 30, left: 30, bottom: 80 }}
                  barGap={8}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                  <XAxis
                    dataKey="category"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: '500' }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    domain={[
                      (dataMin) => Math.floor((Math.min(0, dataMin) - 5) / 10) * 10,
                      (dataMax) => Math.ceil((Math.max(0, dataMax) + 5) / 10) * 10
                    ]}
                    tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
                  />
                  <Tooltip
                    itemSorter={(item) => -item.value}
                    formatter={(value) => [
                      <span dir="ltr">{`${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}%`}</span>,
                      undefined
                    ]}
                    cursor={{ fill: 'var(--panel-border)', opacity: 0.4 }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" />

                  <Bar dataKey="חרבות ברזל" fill="var(--line-iron)" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="חרבות ברזל"
                      position="bottom"
                      offset={12}
                      formatter={(v) => `${Math.round(v)}%`}
                      style={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                    />
                  </Bar>
                  <Bar dataKey="עם כלביא" fill="var(--line-rising)" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="עם כלביא"
                      position="bottom"
                      offset={12}
                      formatter={(v) => `${Math.round(v)}%`}
                      style={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                    />
                  </Bar>
                  <Bar dataKey="שאגת הארי" fill="var(--line-roaring)" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="שאגת הארי"
                      position="bottom"
                      offset={12}
                      formatter={(v) => `${Math.round(v)}%`}
                      style={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
