import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Activity, Calendar, BarChart3, Clock } from 'lucide-react';
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
      setError("שגיאה בפענוח הקובץ. ודא שזהו קובץ האקסל התקין.");
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
              <label><Clock size={16} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'text-bottom' }} /> חלון זמן</label>
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
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, undefined]}
                  labelFormatter={(label) => `יום ${label}`}
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
        </>
      )}
    </div>
  );
}

export default App;
