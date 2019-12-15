const Stats = artifacts.require("Stats");
const AUD = artifacts.require("AUD");
const Water = artifacts.require("Water");
const OrderBook = artifacts.require("OrderBook");
const Users = artifacts.require("Users");
const Roles = artifacts.require("Roles");
const TradingZones = artifacts.require("TradingZones");
const WaterLicence = artifacts.require("WaterLicence");
const History = artifacts.require("History");

module.exports = async (deployer, environment) => {

  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance
  let statsInstance = await deployer.deploy(Stats, 0, 0, 0, 0, 0);
  statsInstance = await deployer.deploy(Stats, 0, 0, 0, 0, 0);

  const audInstance = await deployer.deploy(AUD, 500000000000);
  const waterInstance = await deployer.deploy(Water, 1000000);
  const historyInstance = await deployer.deploy(History);
  const tradingZonesInstance = await deployer.deploy(TradingZones);

  const orderBookInstance = await deployer.deploy(
    OrderBook,
    audInstance.address,
    historyInstance.address,
    statsInstance.address,
    waterInstance.address,
    tradingZonesInstance.address
  );

  const usersInstance = await deployer.deploy(Users);
  const rolesInstance = await deployer.deploy(Roles, usersInstance.address);
  const waterLicenceInstance = await deployer.deploy(
    WaterLicence,
    usersInstance.address,
    rolesInstance.address,
    tradingZonesInstance.address,
    waterInstance.address
  );

  await audInstance.setOrderBook(orderBookInstance.address);
  await waterInstance.setWaterLicence(waterLicenceInstance.address);
  await waterInstance.setOrderBook(orderBookInstance.address);
  await statsInstance.addWriter(orderBookInstance.address);
  await historyInstance.addWriter(orderBookInstance.address);
};