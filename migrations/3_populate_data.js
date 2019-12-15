const AUD = artifacts.require("AUD");
const Water = artifacts.require("Water");
const OrderBook = artifacts.require("OrderBook");
const Users = artifacts.require("Users");
const Roles = artifacts.require("Roles");
const TradingZones = artifacts.require("TradingZones");

module.exports = async function(deployer, environment, accounts) {
  const orderBookInstance = await OrderBook.deployed();
  const waterInstance = await Water.deployed();
  const audInstance = await AUD.deployed();
  const usersInstance = await Users.deployed();
  const rolesInstance = await Roles.deployed();
  const tradingZonesInstance = await TradingZones.deployed();

  const OWNER = accounts[0];
  const ALICE = accounts[1]; // alice is a seller
  const BOB = accounts[2]; // bob is a buyer
  const ALLOCATOR = accounts[3];
  const BUY_CUSTOMER1 = accounts[4];
  const BUY_CUSTOMER2 = accounts[5];
  const BUY_CUSTOMER3 = accounts[6];
  const SELL_CUSTOMER1 = accounts[7];
  const SELL_CUSTOMER2 = accounts[8];
  const SELL_CUSTOMER3 = accounts[9];
  let tx;

  console.log(`Creating trading zones`);
  try {
    let tradingZones = [
      'Border, QLD',
      'Moonie, QLD',
      'Condamine, QLD',
      'Balonne, QLD',
      'Nebine, QLD',
      'Warrego, QLD',
      'Paroo, QLD'
    ];

    tradingZones.forEach(tz => tradingZonesInstance.addTradingZone(tz));

  } catch(error) {
    if (error) {
      console.log('\nAdd trading zones failed');
      console.warn(error);
    }
  }

  console.log(`Setting water balances`);
  try {
    await waterInstance.transfer(ALICE, 1000);
    await waterInstance.transfer(SELL_CUSTOMER1, 1000);
    await waterInstance.transfer(SELL_CUSTOMER2, 1000);
    await waterInstance.transfer(SELL_CUSTOMER3, 1000);

  } catch(error) {
    if (error) {
      console.log('Water Balance setting failed');
      console.log(error.reason);
    }
  }

  console.log(`Setting AUD balances`);
  try {
    await audInstance.transfer(BOB, 1000000000);
    await audInstance.transfer(BUY_CUSTOMER1, 1000000000);
    await audInstance.transfer(BUY_CUSTOMER2, 1000000000);
    await audInstance.transfer(BUY_CUSTOMER3, 1000000000);
  } catch(error) {
    if (error) {
      console.log('AUD Balance setting failed');
      console.log(error.reason);
    }
  }

  console.log(`Setting order book trading zone`);
  try {
    await orderBookInstance.setTradingZone(3); // 'Condamine, QLD'
  } catch(error) {
    if (error) {
      console.log('Setting order book trading zone failed');
      console.log(error.reason);
    }
  }

  console.log(`Performing sell orders`);
  try {
    await orderBookInstance.addSellLimitOrder(392, 5, {from: ALICE});
    await orderBookInstance.addSellLimitOrder(339, 16, {from: SELL_CUSTOMER1});
    await orderBookInstance.addSellLimitOrder(359, 6, {from: SELL_CUSTOMER2});

  } catch(error) {
    if (error) {
      console.log('SELL ORDERS FAILED');
      console.log(error.reason);
    }
  }

  console.log(`Performing buy orders`);
  try {
    await orderBookInstance.addBuyLimitOrder(218, 18, {from: BOB});
    await orderBookInstance.addBuyLimitOrder(278, 7, {from: BUY_CUSTOMER1});
    await orderBookInstance.addBuyLimitOrder(206, 14, {from: BUY_CUSTOMER2});
    await orderBookInstance.addBuyLimitOrder(263, 20, {from: BUY_CUSTOMER3});

  } catch(error) {
    if (error) {
      console.log('BUY ORDERS FAILED');
      console.log(error.reason);
    }
  }

  console.log(`Creating water authority`);
  try {
    await usersInstance.addUser(ALLOCATOR, {from: OWNER});
    await rolesInstance.assignRole('WaterAuthority', 1);

  } catch(error) {
    if (error) {
      console.log('\nAdd water authority failed');
      console.warn(error);
    }
  }


};