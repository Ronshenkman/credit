import pandas as pd
import json
import sys
import os

excel_path = r"c:\Users\ronsh\.gemini\antigravity\scratch\credit\נתונים.xlsx"
output_path = r"c:\Users\ronsh\.gemini\antigravity\scratch\credit\data.json"

# Important Dates
DATES = {
    "חרבות ברזל": "2023-10-07",
    "עם כלביא": "2025-06-12",
    "שאגת הארי": "2026-02-28"
}

# English translations mapped strictly by their position
COLUMN_NAMES_IN_ORDER = [
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
]

def process_data():
    try:
        # Read Excel, skipping the first 11 rows of headers/junk
        df = pd.read_excel(excel_path, skiprows=11)
        
        # Take exactly as many columns as we need, and rename them to avoid any string matching issues
        df = df.iloc[:, :len(COLUMN_NAMES_IN_ORDER)]
        df.columns = COLUMN_NAMES_IN_ORDER
        
        # Ensure Date column is datetime
        df['Date'] = pd.to_datetime(df['Date'])
        
        # Sort by date
        df = df.sort_values('Date')
        
        # Ensure all other columns are numeric
        numeric_cols = [c for c in df.columns if c != 'Date']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        result = {}
        
        for op_name, start_date_str in DATES.items():
            start_date = pd.to_datetime(start_date_str)
            result[op_name] = {}
            
            # For each category
            for col in numeric_cols:
                # Calculate the previous month's start and end dates
                # First day of the start_date's month
                current_month_start = start_date.replace(day=1)
                # Last day of the previous month
                prev_month_end = current_month_start - pd.Timedelta(days=1)
                # First day of the previous month
                prev_month_start = prev_month_end.replace(day=1)
                
                # Calculate baselines (averages over the previous month)
                base_filter = df[(df['Date'] >= prev_month_start) & (df['Date'] <= prev_month_end)]
                base_avg = base_filter[col].mean()

                # Get data from start date onwards
                post_op_data = df[df['Date'] >= start_date].copy()
                
                # Start with Day 0 as the reference point (0% change)
                days_data = [{
                    "day": 0,
                    "date": (start_date - pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                    "value": None,
                    "change": 0.0
                }]
                
                for idx, row in post_op_data.iterrows():
                    day_offset = (row['Date'] - start_date).days + 1
                    val = row[col]
                    
                    # Calculate percentage change
                    pct_change = ((val / base_avg) - 1) * 100 if pd.notnull(base_avg) and base_avg != 0 else None
                    
                    days_data.append({
                        "day": day_offset,
                        "date": row['Date'].strftime("%Y-%m-%d"),
                        "value": val if pd.notnull(val) else None,
                        "change": pct_change if pd.notnull(pct_change) else None
                    })
                
                result[op_name][col] = {
                    "base_avg": base_avg if pd.notnull(base_avg) else None,
                    "data": days_data
                }

        # Save to JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
        print(f"Data successfully processed and saved to {output_path}")

    except Exception as e:
        print(f"Error processing data: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    process_data()
