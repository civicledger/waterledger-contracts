# WaterLedger Smart Contracts

The WaterLedger platform is a water trading platform across four smart contracts. These contracts have a life of a single financial year, and the scope of a given water scheme.

# Usage

These contracts can be used by any system with the [Truffle command-line tools](https://www.trufflesuite.com/) installed. We also strongly recommend the use of Ganache as a blockchain tool for local testing, as it is extremely fast.

The contracts can be downloaded as a standard git repository, and then the typical tools will be used. A deployment script is included, but that is meant to be illustrative of usage. In the production Water Ledger applications, the contracts are deployed by a bespoke management system.

# Contracts

## OrderBook

The orderbook is the primary listing of unmatched orders. It is the contract that implements the rules around what is a valid trade. In the current model of WaterLedger orders are listed, whether as a buy or sell order, and the order is then accepted by another licence holder.

### Key Methods

`addSellLimitOrder(uint256 price, uint256 quantity, uint8 zoneIndex)`

Add a sell order with a price and a quantity in a given zone. Zone details can be retrieved from the `Zones` contract.

- Placing sell orders requires a valid licence.
- The account placing the sell orders require sufficient balance.

`addBuyLimitOrder(uint256 price, uint256 quantity, uint8 zoneIndex)`

- Placing buy orders requires a valid licence.

`acceptOrder(bytes16 id, uint8 zone)`

Allows a user licence to accept a given outstanding order.

- Accepting an order requires a valid licence.

## History

Storage for trades, which consist of accepted orders.

### Methods

The History smart contract cannot be accessed directly, its methods are called by the OrderBook smart contract, or by API calls.

## Zones

The Zones contract stores balances for each licence, and the details (such as minimum and maximum balances) of each zone. The pattern for deployment of this differs from most contracts, as the contract is deployed and then each zone in the Scheme needs to be added.

### Methods

The Zones smart contract has no methods that are accessed publicly. They are mostly called by the API during the onboarding process or during scheme setup.

## Licences

Stores licence and water account details to ensure the address has valid access to the system. This implements the [EIP-1753 standard for licences](https://erc1753.org/).

### Methods

`hasValid(address who)`

Check if the licence for a given address is valid

## Additional Contracts

There are additional non-Solidity smart contracts written in DAML that handle the inter-party liability.

The following entity relationship diagram covers the primary fields and the relationships between the contracts. Note that this is not exhaustive, and there are minor contracts such as abstracts and libraries that are not featured.

## Relationships

A single scheme requires a collection of the four smart contracts as documented above. The relationships are documented in ERD format below.

The primary smart contract is the OrderBook. There is one for the scheme. The order

![Waterledger Contracts ERD](https://waterledger-wp.sgp1.digitaloceanspaces.com/smart-contract-final.png)

## Events

All of the smart contracts emit events, can be watched

### OrderBook

The following events can be listened to by anyone with the address of the deployment.

`OrderDeleted(bytes16 id)`

The given order has been deleted and should be updated.

`OrderUnmatched(bytes16 orderId)`

The given order has been unmatched.

`OrderAccepted(bytes16 orderId, address indexed buyer)`

The given order has been accepted by a specific buyer (the buyer address corresponds to a licence)

`OrderAdded(bytes16 id, address indexed licenceAddress, uint256 price, uint256 quantity, uint8 zone, OrderType orderType)`

An order has been added. The licence is provided along with price, quantity, and zone. The `orderType` returned is 0 for Sell, and 1 for a Buy.

### Licence

`LicenceAdded(uint256 index, address ethAccount)`

An authority has added a valid licence at the following address.

`WaterAccountAdded(address ethAccount)`

An authority has added a Water Account to the licence.

### Zones

`BalanceUpdated(bytes32 waterAccountId, uint256 balance)`

A water account's balance has been changed to the output value. Note tha this is in kilolitres, not megalitres.

`Allocation(uint8 zoneIndex, bytes32 waterAccountId, uint256 quantity)`

An allocation has been assigned to a waterAccount in a zone.

`ZoneAdded(bytes16 id, uint8 zoneIndex)`

A zone has been added

### History

`HistoryAdded(bytes16 id, address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone, bytes16 orderId)`

A trade has been created from accepting an order, listed as the orderId. The address of the buyer and seller are returned, and with the zones can be used to find the correct water account.

`TradeCompleted(bytes16 id)`

`TradeInvalidated(bytes16 id)`

`TradeRejected(bytes16 id)`

Update a trade's status to completed, invalidated, or rejected.

## Deployment

In order to obtain a valid instance of all of the contracts, there are several steps that need to be undertaken.

The following deployment steps from Truffle's deployment system demonstrate the required approach.

```javascript
const zones = ["Barron Zone A", "Barron Zone B", "Barron Zone C", "Barron Zone D", "Barron Zone E"];

const orderBookInstance = await deployer.deploy(OrderBook);
const historyInstance = await deployer.deploy(History, orderBookInstance.address);
const licenceInstance = await deployer.deploy(Licences);

const zonesInstance = await deployer.deploy(Zones, orderBookInstance.address);

zones.forEach(async zoneName => {
  await zonesInstance.addZone(web3.utils.toHex(zoneName), 100000, 0, 100000);
});

await orderBookInstance.addHistoryContract(historyInstance.address);
await orderBookInstance.addLicencesContract(licenceInstance.address);
```

## Testing

Testing is done using standard Truffle test harness and JavaScript testing. The testing command is `truffle test`, assuming this feature is available. There is no direct Solidity testing. Testing is to be expanded over the course of WaterLedger's lifecycle.

## Upgradeability

Each financial year a new complete set of contracts is deployed, resetting the system. This why the contracts do not implement upgradeable contract patterns.
