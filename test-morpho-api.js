// Test Morpho API connectivity
const MORPHO_API_URL = 'https://blue-api.morpho.org/graphql';

async function testMorphoAPI() {
  console.log('🔍 Testing Morpho API connectivity...\n');

  const query = `
    query TestQuery {
      markets(first: 1) {
        items {
          uniqueKey
          loanAsset {
            symbol
          }
          collateralAsset {
            symbol
          }
        }
      }
    }
  `;

  try {
    console.log('📡 Making test request to Morpho API...');
    const response = await fetch(MORPHO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.log('❌ GraphQL errors:', result.errors);
      return false;
    }

    console.log('✅ Morpho API connected successfully!');
    console.log('📊 Sample market data:', JSON.stringify(result.data, null, 2));
    return true;

  } catch (error) {
    console.log('❌ Morpho API connection failed:', error.message);
    return false;
  }
}

// Test Polygon RPC
async function testPolygonRPC() {
  console.log('\n🔗 Testing Polygon RPC connectivity...');
  const POLYGON_RPC_URL = 'https://polygon-mainnet.g.alchemy.com/v2/-RWUnvaDRA2mOJZGnpF0D';

  try {
    const response = await fetch(POLYGON_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      console.log('❌ RPC error:', result.error);
      return false;
    }

    console.log('✅ Polygon RPC connected successfully!');
    console.log('📦 Latest block:', parseInt(result.result, 16));
    return true;

  } catch (error) {
    console.log('❌ Polygon RPC connection failed:', error.message);
    return false;
  }
}

async function main() {
  const morphoOk = await testMorphoAPI();
  const polygonOk = await testPolygonRPC();

  console.log('\n📋 Test Results:');
  console.log('Morpho API:', morphoOk ? '✅ Working' : '❌ Failed');
  console.log('Polygon RPC:', polygonOk ? '✅ Working' : '❌ Failed');

  if (!morphoOk || !polygonOk) {
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check your internet connection');
    console.log('2. Verify API endpoints are accessible');
    console.log('3. Check if Morpho API has changed');
    console.log('4. Try with a different Alchemy API key');
  } else {
    console.log('\n🎉 All APIs are working! Backend should start successfully.');
  }
}

main().catch(console.error);