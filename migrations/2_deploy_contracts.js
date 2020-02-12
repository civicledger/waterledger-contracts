const Zone = artifacts.require("Zone");
const OrderBook = artifacts.require("OrderBook");
const Users = artifacts.require("Users");
const History = artifacts.require("History");

const zones = ['Barron Zone A', 'Barron Zone B', 'Barron Zone C', 'Barron Zone D', 'Barron Zone E'];

module.exports = async (deployer) => {


  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance

  const historyInstance = await deployer.deploy(History);
  const orderBookInstance = await deployer.deploy(OrderBook);
  const usersInstance = await deployer.deploy(Users);

  zones.forEach(async zoneName => {
    const zoneInstance = await deployer.deploy(Zone, 100000, zoneName, orderBookInstance.address);
    await orderBookInstance.addZone(zoneName, zoneInstance.address);
  });

  await orderBookInstance.addHistoryContract(historyInstance.address);
  await historyInstance.addWriter(orderBookInstance.address);

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