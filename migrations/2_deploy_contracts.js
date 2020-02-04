// const Stats = artifacts.require("Stats");
// const AUD = artifacts.require("AUD");
const Zone = artifacts.require("Zone");
// const OrderBook = artifacts.require("OrderBook");
// const Users = artifacts.require("Users");
// const Roles = artifacts.require("Roles");
// const WaterLicence = artifacts.require("WaterLicence");
// const History = artifacts.require("History");

// const zones = ['Barron Zone A', 'Barron Zone B', 'Barron Zone C'];

module.exports = async (deployer, environment) => {

  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance
  // let statsInstance = await deployer.deploy(Stats, 0, 0, 0, 0, 0);
  // statsInstance = await deployer.deploy(Stats, 0, 0, 0, 0, 0);

  // const audInstance = await deployer.deploy(AUD, 500000000000);
  // const historyInstance = await deployer.deploy(History);

  // const orderBookInstance = await deployer.deploy(
  //   OrderBook,
  //   audInstance.address,
  //   historyInstance.address,
  //   statsInstance.address
  // );
  // console.log(web3.utils.utf8ToHex);
  const zoneInstance = await deployer.deploy(Zone, 100000, web3.utils.utf8ToHex("Barron Zone A"));
  // zones.forEach(async zoneName => {
  //   const zoneInstance = await deployer.deploy(Zone, 100000, zoneName);
  //   // await orderBookInstance.addZone(zoneName, zoneInstance.address);
  // });

  // const usersInstance = await deployer.deploy(Users);
  // const rolesInstance = await deployer.deploy(Roles, usersInstance.address);

  // await deployer.deploy(
  //   WaterLicence,
  //   usersInstance.address,
  //   rolesInstance.address,
  //   waterInstance.address
  // );

  // await audInstance.setOrderBook(orderBookInstance.address);
  // await statsInstance.addWriter(orderBookInstance.address);
  // await historyInstance.addWriter(orderBookInstance.address);

};