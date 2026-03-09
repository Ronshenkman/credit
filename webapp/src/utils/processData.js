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
    // Parse excel file
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
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
    }).filter(row => row['Date'] instanceof Date || typeof row['Date'] === 'number');

    // Convert dates and normalize to midnight
    dataList.forEach(row => {
        if (typeof row['Date'] === 'number') {
            // Excel date serial number to JS Date
            row['Date'] = new Date(Math.round((row['Date'] - 25569) * 86400 * 1000));
        }
        if (row['Date'] instanceof Date) {
            row['Date'].setHours(0, 0, 0, 0);
        }
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
            const baseEnd = new Date(startDate);
            baseEnd.setDate(baseEnd.getDate() - 1);

            const base14Start = new Date(startDate);
            base14Start.setDate(base14Start.getDate() - 14);

            const base28Start = new Date(startDate);
            base28Start.setDate(base28Start.getDate() - 28);

            const base14Vals = dataList
                .filter(r => r.Date >= base14Start && r.Date <= baseEnd && typeof r[col] === 'number')
                .map(r => r[col]);

            const base28Vals = dataList
                .filter(r => r.Date >= base28Start && r.Date <= baseEnd && typeof r[col] === 'number')
                .map(r => r[col]);

            const base14Avg = getAverage(base14Vals);
            const base28Avg = getAverage(base28Vals);

            // Get data from startDate onwards
            const postOpData = dataList.filter(r => r.Date >= startDate);

            // Insert Day 0 Base Line Drop point
            const dayZeroDate = new Date(startDate);
            dayZeroDate.setDate(dayZeroDate.getDate() - 1);

            const daysData = [{
                day: 0,
                date: dayZeroDate.toISOString().split('T')[0],
                value: null,
                change_14: 0.0,
                change_28: 0.0
            }];

            postOpData.forEach(row => {
                // Compute delta in days accurately. 
                // Math.floor difference ensures that same day = 0 diff.
                // We add 1 so that the start date itself is Day 1.
                const diffDays = Math.floor((row.Date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const dayOffset = diffDays + 1;

                const val = typeof row[col] === 'number' ? row[col] : null;

                let pct_change_14 = null;
                let pct_change_28 = null;

                if (val !== null) {
                    if (base14Avg) pct_change_14 = ((val / base14Avg) - 1) * 100;
                    if (base28Avg) pct_change_28 = ((val / base28Avg) - 1) * 100;
                }

                daysData.push({
                    day: dayOffset,
                    date: row.Date.toISOString().split('T')[0],
                    value: val,
                    change_14: pct_change_14,
                    change_28: pct_change_28
                });
            });

            result[opName][col] = {
                base_14_avg: base14Avg,
                base_28_avg: base28Avg,
                data: daysData
            };
        });
    });

    return result;
}
