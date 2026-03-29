// Yahoo Finance API for fetching stock data
export const fetchStockData = async (symbol: string, date?: string) => {
  try {
    const url = new URL(`/api/stock/${symbol}`, window.location.origin);
    if (date) url.searchParams.append('date', date);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 429) {
        const data = await response.json();
        alert(data.error || 'Too many requests');
      }
      throw new Error('Failed to fetch stock data');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Yahoo Finance Fetch Error:", error);
    return null;
  }
};

export const signIn = () => {
  window.location.href = '/api/auth/google';
};

export const logout = () => {
  window.location.href = '/api/auth/logout';
};
