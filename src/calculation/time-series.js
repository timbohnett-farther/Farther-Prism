/**
 * Time Series Engine
 * 
 * Manages monthly time-stepping for financial projections.
 * Converts annual assumptions to monthly rates and maintains time index.
 * 
 * Key concepts:
 * - Internal: monthly steps (t = 1..360 for 30 years)
 * - Display: annual aggregation
 * - All calculations happen monthly for accuracy
 */

/**
 * Generate monthly time series for planning horizon.
 * @param {Date} startDate - Projection start date
 * @param {number} horizonYears - Number of years to project
 * @returns {Array<Object>} Array of time periods
 */
export function generateTimeSeries(startDate, horizonYears) {
  const series = [];
  const start = new Date(startDate);
  const horizonMonths = horizonYears * 12;
  
  for (let month = 0; month < horizonMonths; month++) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + month);
    
    series.push({
      index: month,                              // 0-based month index
      date: date.toISOString().split('T')[0],   // YYYY-MM-DD
      year: date.getFullYear(),
      month: date.getMonth() + 1,               // 1-12
      yearIndex: Math.floor(month / 12),        // 0-based year index
      monthInYear: month % 12,                  // 0-11
      isYearEnd: (month + 1) % 12 === 0,        // True for December
      isYearStart: month % 12 === 0,            // True for January
    });
  }
  
  return series;
}

/**
 * Convert annual rate to monthly rate.
 * Uses compound interest formula: (1 + annual)^(1/12) - 1
 * @param {number} annualRate - Annual rate (e.g., 0.03 for 3%)
 * @returns {number} Monthly rate
 */
export function annualToMonthly(annualRate) {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Convert monthly rate to annual rate.
 * @param {number} monthlyRate - Monthly rate
 * @returns {number} Annual rate
 */
export function monthlyToAnnual(monthlyRate) {
  return Math.pow(1 + monthlyRate, 12) - 1;
}

/**
 * Calculate compound growth factor from start to given month.
 * @param {number} annualRate - Annual growth rate
 * @param {number} months - Number of months
 * @returns {number} Growth multiplier
 */
export function growthFactor(annualRate, months) {
  const monthlyRate = annualToMonthly(annualRate);
  return Math.pow(1 + monthlyRate, months);
}

/**
 * Aggregate monthly values to annual.
 * @param {Array<Object>} timeSeries - Monthly time series
 * @param {Array<number>} monthlyValues - Values for each month
 * @param {string} aggregationMethod - 'sum', 'average', 'ending'
 * @returns {Array<Object>} Annual aggregated values
 */
export function aggregateToAnnual(timeSeries, monthlyValues, aggregationMethod = 'sum') {
  const annualValues = [];
  
  for (let year = 0; year < Math.ceil(timeSeries.length / 12); year++) {
    const startIdx = year * 12;
    const endIdx = Math.min(startIdx + 12, timeSeries.length);
    const yearValues = monthlyValues.slice(startIdx, endIdx);
    
    let aggregatedValue;
    
    switch (aggregationMethod) {
      case 'sum':
        aggregatedValue = yearValues.reduce((sum, val) => sum + val, 0);
        break;
      case 'average':
        aggregatedValue = yearValues.reduce((sum, val) => sum + val, 0) / yearValues.length;
        break;
      case 'ending':
        aggregatedValue = yearValues[yearValues.length - 1];
        break;
      default:
        throw new Error(`Unknown aggregation method: ${aggregationMethod}`);
    }
    
    annualValues.push({
      year: timeSeries[startIdx].year,
      yearIndex: year,
      value: aggregatedValue,
      monthCount: yearValues.length,
    });
  }
  
  return annualValues;
}

/**
 * Calculate age at each month in time series.
 * @param {Date} dateOfBirth - Person's date of birth
 * @param {Array<Object>} timeSeries - Monthly time series
 * @returns {Array<number>} Age in years at each month
 */
export function calculateAges(dateOfBirth, timeSeries) {
  const dob = new Date(dateOfBirth);
  
  return timeSeries.map(period => {
    const periodDate = new Date(period.date);
    const ageYears = (periodDate - dob) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(ageYears);
  });
}

/**
 * Check if person has reached a specific age at given month.
 * @param {Date} dateOfBirth - Person's date of birth
 * @param {number} targetAge - Age to check for
 * @param {Object} timePeriod - Time period from series
 * @returns {boolean} True if person has reached age
 */
export function hasReachedAge(dateOfBirth, targetAge, timePeriod) {
  const dob = new Date(dateOfBirth);
  const periodDate = new Date(timePeriod.date);
  const ageYears = (periodDate - dob) / (1000 * 60 * 60 * 24 * 365.25);
  return ageYears >= targetAge;
}

/**
 * Find the month index when person reaches target age.
 * @param {Date} dateOfBirth - Person's date of birth
 * @param {number} targetAge - Age to find
 * @param {Array<Object>} timeSeries - Monthly time series
 * @returns {number|null} Month index when age is reached, or null
 */
export function findAgeMonth(dateOfBirth, targetAge, timeSeries) {
  for (let i = 0; i < timeSeries.length; i++) {
    if (hasReachedAge(dateOfBirth, targetAge, timeSeries[i])) {
      return i;
    }
  }
  return null;
}

export default {
  generateTimeSeries,
  annualToMonthly,
  monthlyToAnnual,
  growthFactor,
  aggregateToAnnual,
  calculateAges,
  hasReachedAge,
  findAgeMonth,
};
