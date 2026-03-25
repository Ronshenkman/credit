import * as XLSX from 'xlsx';

const DATES = {
    "חרבות ברזל": "2023-10-07",
    "עם כלביא": "2025-06-13",
    "שאגת הארי": "2026-02-28"
};

const COLUMN_NAMES_IN_ORDER = [
    'Date',
    'סה"כ',
    'מוצרי תעשייה',
    'ציוד ושירותי תקשורת',
    'דלק, חשמל וגז',
    'ספרים, ציוד משרדי ופרסום',
    'שירותי רפואה ותרופות',
    'ציוד ושירותי תחבורה',
    'מוצרים ושירותים אחרים',
    'פנאי ובילוי',
    'טיסות, תיירות ואירוח',
    'מחשבים ותוכנה',
    'מזון ומשקאות',
    'שירותי אוכל',
    'ביטוח',
    'שירותי ממשלה ועירייה'
];

/**
 * Calculates the average of array of numbers
 */
function getAverage(arr) {
    if (!arr || arr.length === 0) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
}

/**
 * Parses the Excel ArrayBuffer into the processed JSON expected by App.jsx
 * @param {ArrayBuffer} buffer The Excel file data
 * @returns {Object} Processed JSON Data Map
 */
export async function processExcelData(buffer) {
    // Parse excel file - DO NOT use cellDates to avoid timezone issues
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read raw sheet as array of arrays, skipping the first 11 rows of junk
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 11 });

    // Transform into objects based on our strict column order
    const dataList = rawData.map(row => {
        const obj = {};
        COLUMN_NAMES_IN_ORDER.forEach((colName, index) => {
            obj[colName] = row[index];
        });
        return obj;
    }).filter(row => typeof row['Date'] === 'number');

    // Convert Excel serial numbers to LOCAL Date objects
    // Excel epoch: Jan 0, 1900 (serial 1 = Jan 1, 1900)
    // We use XLSX's built-in SSF utility to parse correctly, then create LOCAL dates
    dataList.forEach(row => {
        const serial = row['Date'];
        // Convert serial to y/m/d using the standard Excel epoch
        // Excel serial 1 = Jan 1, 1900. The "Lotus bug" means serial 60 = Feb 29, 1900 (which doesn't exist)
        // Standard formula: create a UTC date from epoch, then extract y/m/d for local date
        const utcDate = new Date((serial - 25569) * 86400 * 1000);
        // Create a LOCAL date with the UTC date's components to avoid timezone shift
        row['Date'] = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 0, 0, 0, 0);
    });

    // Sort by date ascending
    dataList.sort((a, b) => a['Date'] - b['Date']);

    const result = {};

    Object.entries(DATES).forEach(([opName, startDateStr]) => {
        // Parse date as LOCAL time (not UTC) to avoid timezone offset issues
        const [yr, mo, dy] = startDateStr.split('-').map(Number);
        const startDate = new Date(yr, mo - 1, dy, 0, 0, 0, 0);

        result[opName] = {};

        // Process each category (all columns except Date)
        COLUMN_NAMES_IN_ORDER.slice(1).forEach(col => {
            // Calculate Baselines
            const currentMonthStart = new Date(startDate);
            currentMonthStart.setDate(1);

            const prevMonthEnd = new Date(currentMonthStart);
            prevMonthEnd.setDate(0); // 0th day of current month gets last day of previous month

            const prevMonthStart = new Date(prevMonthEnd);
            prevMonthStart.setDate(1);

            const baseVals = dataList
                .filter(r => r.Date >= prevMonthStart && r.Date <= prevMonthEnd && typeof r[col] === 'number')
                .map(r => r[col]);

            const baseAvg = getAverage(baseVals);

            // Get data from startDate onwards
            const postOpData = dataList.filter(r => r.Date >= startDate);

            // Insert Day 0 Base Line Drop point
            const dayZeroDate = new Date(startDate);
            dayZeroDate.setDate(dayZeroDate.getDate() - 1);

            const daysData = [{
                day: 0,
                date: dayZeroDate.toISOString().split('T')[0],
                value: null,
                change: 0.0
            }];

            postOpData.forEach(row => {
                // Compute delta in days accurately. 
                // Math.floor difference ensures that same day = 0 diff.
                // We add 1 so that the start date itself is Day 1.
                const diffDays = Math.floor((row.Date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const dayOffset = diffDays + 1;

                const val = typeof row[col] === 'number' ? row[col] : null;

                let pct_change = null;

                if (val !== null) {
                    if (baseAvg) pct_change = ((val / baseAvg) - 1) * 100;
                }

                daysData.push({
                    day: dayOffset,
                    date: row.Date.toISOString().split('T')[0],
                    value: val,
                    change: pct_change
                });
            });

            result[opName][col] = {
                base_avg: baseAvg,
                data: daysData
            };
        });
    });

    return result;
}
