import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Base prices for simulation
const basePrices: Record<string, number> = {
  'BTCUSDT': 43500,
  'ETHUSDT': 2250,
  'SOLUSDT': 95,
  'XRPUSDT': 0.62,
  'BNBUSDT': 315,
  'ADAUSDT': 0.58,
  'AAPL': 182,
  'TSLA': 245,
  'GOOGL': 140,
  'MSFT': 375,
};

// Track current prices with realistic volatility
const currentPrices: Record<string, { price: number; change24h: number }> = {};

// Initialize prices
Object.keys(basePrices).forEach(symbol => {
  currentPrices[symbol] = {
    price: basePrices[symbol],
    change24h: (Math.random() - 0.5) * 10,
  };
});

// Generate realistic price movement
function updatePrice(symbol: string): { price: number; change24h: number; change24hPercent: number } {
  const base = basePrices[symbol] || 100;
  const current = currentPrices[symbol] || { price: base, change24h: 0 };
  
  // Random walk with mean reversion
  const volatility = 0.0005; // 0.05% per tick
  const meanReversion = 0.001;
  const randomChange = (Math.random() - 0.5) * 2 * volatility * current.price;
  const reversionPull = (base - current.price) * meanReversion;
  
  const newPrice = current.price + randomChange + reversionPull;
  const newChange = newPrice - base + current.change24h * 0.999;
  
  currentPrices[symbol] = { price: newPrice, change24h: newChange };
  
  return {
    price: newPrice,
    change24h: newChange,
    change24hPercent: (newChange / base) * 100,
  };
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Check if this is a WebSocket upgrade request
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let intervalId: number | null = null;
    const subscribedSymbols = new Set<string>();

    socket.onopen = () => {
      console.log("WebSocket connected for price streaming");
      
      // Send initial connection success
      socket.send(JSON.stringify({
        type: 'connection.established',
        timestamp: new Date().toISOString(),
        availableSymbols: Object.keys(basePrices),
      }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received message:", message.type);

        switch (message.type) {
          case 'subscribe': {
            const symbols = message.symbols || Object.keys(basePrices);
            symbols.forEach((s: string) => subscribedSymbols.add(s));
            
            console.log(`Subscribed to: ${Array.from(subscribedSymbols).join(', ')}`);
            
            // Send immediate snapshot
            const snapshot: Record<string, { price: number; change24h: number; change24hPercent: number }> = {};
            subscribedSymbols.forEach(symbol => {
              snapshot[symbol] = updatePrice(symbol);
            });
            
            socket.send(JSON.stringify({
              type: 'price.snapshot',
              prices: snapshot,
              timestamp: new Date().toISOString(),
            }));
            
            // Start streaming if not already
            if (!intervalId) {
              intervalId = setInterval(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                  if (intervalId) clearInterval(intervalId);
                  return;
                }
                
                const updates: Record<string, { price: number; change24h: number; change24hPercent: number }> = {};
                subscribedSymbols.forEach(symbol => {
                  updates[symbol] = updatePrice(symbol);
                });
                
                socket.send(JSON.stringify({
                  type: 'price.update',
                  prices: updates,
                  timestamp: new Date().toISOString(),
                }));
              }, 1000); // Update every second
            }
            break;
          }
          
          case 'unsubscribe': {
            const symbols = message.symbols || [];
            symbols.forEach((s: string) => subscribedSymbols.delete(s));
            console.log(`Unsubscribed from: ${symbols.join(', ')}`);
            break;
          }
          
          case 'ping': {
            socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        socket.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    return response;
  } catch (error) {
    console.error("WebSocket upgrade failed:", error);
    return new Response("WebSocket upgrade failed", { status: 500 });
  }
});
