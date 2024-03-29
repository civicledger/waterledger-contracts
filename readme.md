# WaterLedger Smart Contracts

The WaterLedger platform is a water trading platform across four smart contracts. These contracts have a life of a single financial year, and the scope of a given level 1 water resource.

Ethereum Smart Contracts are used as the primary method of data input for a number of reasons.

Smart Contracts allow regulatory requirements to be implemented in the deployed code, with the established rules publicly visible.

The data stored is also a matter of public record, and as it is stored immutably and securely it is known to be impossible to tamper with, omit, or limit data.

The Ethereum Virtual Machine emits events on the executed functionality, which allows distributed systems or interested parties to subscribe for updates in realtime. This facilitates integration with existing water trading platforms or regulatory systems.

The stored log provided by these events creates an audit log, that clearly shows all events and actions undertaken within the level 1 water resource on any contract. This has value both for reconciliation and as a non-realtime source of event projections.

# Usage

These contracts can be used by any system with the [Truffle command-line tools](https://www.trufflesuite.com/) installed. We also strongly recommend the use of Ganache as a blockchain tool for local testing, as it is extremely fast.

The contracts can be downloaded as a standard git repository, and then the typical tools will be used. A deployment script is included, but that is meant to be illustrative of usage. In the production Water Ledger applications, the contracts are deployed by a bespoke management system.

# Contracts

The contracts primarily deal with the input of data into the Water Ledger system. The retrieval of data is more suited to the API.

In order to maintain data consistency, the smart contract entities are almost all created with an `id` field, which is an internally created hash to uniquely identify the entity. This may be variously referenced - for example it might be `id` or `orderId` depending on the context.

This id field can be typically used to lookup detailed information about the entity. For example the following History function.

`function getTradeDetails(bytes16 id)`

## OrderBook

The orderbook is the primary listing of unmatched orders. It is the contract that implements the rules around what is a valid trade. In the current model of WaterLedger orders are listed, whether as a buy or sell order, and the order is then accepted by another extraction right holder.

### Public Methods

`addSellLimitOrder(uint256 price, uint256 quantity, uint8 level0ResourceIndex)`

Add a sell order with a price and a quantity in a given level 0 water resource system. Level 0 water resource system details can be retrieved from the `Level0Resources` contract.

The quantity provided is in kilolitres rather than the more typical megalitres so that fractional units such as `4.25 ML` are able to be stored.

- Placing sell orders requires a valid extraction right.
- The account placing the sell orders require sufficient water balance in the level 0 water resource system.

`addBuyLimitOrder(uint256 price, uint256 quantity, uint8 level0ResourceIndex)`

- Placing buy orders requires a valid extraction right.

`acceptOrder(bytes16 id, uint8 level0Resource)`

Allows a user extraction right to accept a given outstanding order.

- Accepting an order requires a valid extraction right.
- A valid id for an order is reqired

`deleteOrder(bytes16 id)`

Removes an order from the OrderBook, completely deleting the storage location. Note that this cannot be undone and does not prompt in any way.

- A valid id for an order is reqired
- The extraction right deleting the order must be the current user's address

`getOrderById(bytes16 id)`

This is a `view` function that returns the order that belongs to a given id. This function is public and has no access restrictions.

`getOrderBookSells()`

This is a `view` function that returns all of the outstanding, active, unmatched Sell orders. Note that the orders returned are not sorted in any way, and any sorting should be done in the receiving client. This function is public and has no access restrictions.

The function returns a list of `Order` structs.

`getOrderBookBuys()`

This is the `view` buy equivalent to the above. The same sorting limitations are in effect, and there are no access restrictions. As with sells, it returns a list of `Order` structs.

## History

Storage for trades, which consist of accepted orders. This is the most important record of history, as it lists the successful deals between parties. The addition of entries to the list of trades in the History contract is triggered by the `acceptOrder` method documented above.

The History smart contract send functions cannot be accessed directly. Its state changing methods are called by the OrderBook smart contract, or by API calls.

### Public Methods

`function getTradeDetails(bytes16 id)`

A public `view` function that returns the details of a trade with a given id. This does not return a struct as most functions do, but a list of values.

`getHistory(uint256 numberOfTrades)`

A public `view` method that returns a given number of trades. The trades returned are the most recent. The data returned is an array of `Trade` structs.

## Level0Resources

The Level0Resources contract stores balances for each extraction right, and the details (such as minimum and maximum balances) of each level 0 water resource system. The pattern for deployment of this differs from most contracts, as the contract is deployed and then each level 0 water resource system in the Level1Resource needs to be added.

The Level0Resources smart contract enforces two key rules. One is the storage of the balances of individual water accounts in each level 0 water resource system. The other is the balance of the level 0 water resource system itself - the total hydrological capacity of the catchment. This comes with minimum and maximum capacities which may not be overrun by any trade.

Note that these rules only apply to _cross-level0-resource_ trades. A trade within a level 0 water resource system doesn't trigger these checks.

### Methods

The Level0Resources smart contract has no data-modifying methods that are accessed publicly. They are mostly called by the API during the onboarding process or during level 1 water resource setup.

`isToTransferValid(uint8 level0ResourceIndex, uint256 value)`

Checks whether a transfer of a certain amount of water into a level 0 water resource system would be permitted under cross-level0-resource transit rules. Note that this method is primarily used internally to validate trades.

`isFromTransferValid(uint8 level0ResourceIndex, uint256 value)`

Checks whether removing a certain amount of water from a level 0 water resource system would be permitted under cross-level0-resource transit rules. As above this is used to validate trades.

`getBalanceForLevel0Resource(bytes32 waterAccountId, uint8 level0ResourceIndex)`

Check the balance that a water account has in any level 0 water resource system. It is necessary to pass in both the `waterAccountId` and the `level0ResourceIndex` due to the way balance mappings are keyed.

The `waterAccountId` in this method call is the water authority's string identifier (converted to bytes32 for storage). It is not an id generated by the contract as that is not necessary.

## Extraction Rights

Stores extraction right and water account details to ensure the address has valid access to the system. This implements the [EIP-1753 standard for licences](https://erc1753.org/).

A extraction right is issued by providing the ethereum address to issue to. Once this has been issued, water accounts can be created against it.

### Methods

`issue(address who, uint256 start, uint256 end)`

Issue an extraction right to a given Ethereum address from a start time to an end time. Note that the start and end are required for the EIP-1753 standard, but are not used by Water Ledger.

- Requires the user to have been assigned water authority access

`addextractionRightWaterAccount(uint256 extractionRightIndex, bytes32 waterAccountId, uint8 level0ResourceIndex)`

Adds a water trading account to an extraction right. The extractionRightIndex can be retrived fromt he event triggered on issuing an extraction right. See events below.

- Requires water authority access

`hasValid(address who)`

Check if the extraction right for a given address is valid. This is a public `view` method with no access limitations.

## Relationships

A single level 1 water resource requires a collection of the four smart contracts as documented above. The relationships are documented in ERD format below.

The primary smart contract is the OrderBook. There is one for the level 1 water resource. The OrderBook stores the location of other smart contracts. The secondary smart contracts are stored as part of it.

The main "flow" of data is the addition of Orders to the OrderBook, and the accepting of them in the OrderBook, which then creates a new Trade in the History contract.

The Level0Resources and ExtractionRights contracts are used to validate this process by providing confirmation that the trade (or initial order) fulfils the level 1 water resource requirements.

![Waterledger Contracts ERD](https://waterledger-wp.sgp1.digitaloceanspaces.com/smart-contract-final.png)

## Additional Contracts

There are additional non-Solidity smart contracts written in DAML that handle the inter-party liability.

The following entity relationship diagram covers the primary fields and the relationships between the contracts. Note that this is not exhaustive, and there are minor contracts such as abstracts and libraries that are not featured.

## Events

All of the smart contracts emit events, which can be watched using any system capable of a WebSocket connection.

The following events are available on each contract.

### OrderBook

`OrderDeleted(bytes16 id)`

The given order has been deleted and should be removed from any projection.

`OrderAccepted(bytes16 orderId, address indexed buyer)`

The given order has been accepted by a specific buyer (the buyer address corresponds to an extraction right) any any projection should list it as "matched" or otherwise remove it from the list of open orders.

`OrderAdded(bytes16 id, address indexed extractionRightAddress, uint256 price, uint256 quantity, uint8 level0Resource, OrderType orderType)`

An order has been added. The extraction right is provided along with price, quantity, and level 0 water resource system. The `orderType` returned is 0 for Sell, and 1 for a Buy.

Note that the quantity is output in **kilolitres** to allow display as decimals of megalitres.

### ExtractionRights

`ExtractionRightsAdded(uint256 index, address ethAccount)`

An authority has added a valid extraction right at the following address.

`WaterAccountAdded(address ethAccount)`

An authority has added a Water Account to the extraction right.

### Level0Resources

`BalanceUpdated(bytes32 waterAccountId, uint256 balance)`

A water account's balance has been changed to the output value. Note tha this is in kilolitres, not megalitres.

`Allocation(uint8 level0ResourceIndex, bytes32 waterAccountId, uint256 quantity)`

An allocation has been assigned to a waterAccount in a level 0 water resource system.

`Level0ResourceAdded(bytes16 id, uint8 level0ResourceIndex)`

A level 0 water resource system has been added

### History

`HistoryAdded(bytes16 id, address buyer, address seller, uint256 price, uint256 quantity, uint8 fromLevel0Resource, uint8 toLevel0Resource, bytes16 orderId)`

A trade has been created from accepting an order, listed as the orderId. The address of the buyer and seller are returned, and with the level0Resources can be used to find the correct water account.

`TradeCompleted(bytes16 id)`

`TradeInvalidated(bytes16 id)`

`TradeRejected(bytes16 id)`

Update a trade's status to completed, invalidated, or rejected.

## Deployment

In order to obtain a valid instance of all of the contracts, there are several steps that need to be undertaken.

The following deployment steps from Truffle's deployment system demonstrate the required approach.

```javascript
const level0Resources = [
  "Barron Level0Resource A",
  "Barron Level0Resource B",
  "Barron Level0Resource C",
  "Barron Level0Resource D",
  "Barron Level0Resource E",
];

const orderBookInstance = await deployer.deploy(OrderBook);
const historyInstance = await deployer.deploy(History, orderBookInstance.address);
const extractionRightInstance = await deployer.deploy(ExtractionRights);

const level0ResourcesInstance = await deployer.deploy(Level0Resources, orderBookInstance.address);

Level0Resources.forEach(async level0ResourceName => {
  await Level0ResourcesInstance.addLevel0Resource(web3.utils.toHex(level0ResourceName), 100000, 0, 100000);
});

await orderBookInstance.addHistoryContract(historyInstance.address);
await orderBookInstance.addExtractionRightsContract(extractionRightInstance.address);
```

The unit tests provided with this repository demonstrate a clear process of the setup necessary for individual users. Most notably, it is important that the `allocate` function in the Level0Resources contract is run to provide the user with an amount of water to trade.

## Testing

Testing is done using standard Truffle test harness and JavaScript testing. The testing command is `truffle test`, assuming this feature is available. There is no direct Solidity testing. Testing is to be expanded over the course of WaterLedger's lifecycle.

## Upgradeability

Each financial year a new complete set of contracts is deployed, resetting the system. This why the contracts do not implement upgradeable contract patterns.
