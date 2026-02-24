import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const result = await yahooFinance.historical('SPY', {
      period1: '2024-01-01',
      period2: '2024-01-31'
    });
    console.log('Success! Got', result.length, 'records');
    console.log('Sample:', result[0]);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
