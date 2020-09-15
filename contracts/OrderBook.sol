pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Zone.sol";
import "./History.sol";
import "./Licences.sol";

contract OrderBook is Ownable {
    Zone[] private _zones;
    string[] private _zoneNames;
    History private _history;
    Licences private _licences;
    uint256 private _year;

    uint256 private _lastTradedPrice;

    struct IndexPosition {
        uint256 index;
        bool isValid;
    }

    mapping(bytes16 => IndexPosition) private _idToIndex;

    enum OrderType {Sell, Buy}

    struct Order {
        bytes16 id;
        OrderType orderType;
        address owner;
        uint256 price;
        uint256 quantity;
        uint256 timeStamp;
        uint256 matchedTimeStamp;
        uint8 zone;
    }

    Order[] private _orders;

    bytes16[] private _unmatchedBuys;
    bytes16[] private _unmatchedSells;

    string private _scheme;

    constructor(string memory scheme, uint256 year) public Ownable() {
        _scheme = scheme;
        _year = year;
    }

    function addZone(string memory name, address zoneContract) public onlyOwner {
        _zones.push(Zone(zoneContract));
        _zoneNames.push(name);
    }

    function addHistoryContract(address historyContract) public onlyOwner {
        _history = History(historyContract);
    }

    function getOrderById(bytes16 id) public view guardId(id) returns (Order memory) {
        return _orders[_idToIndex[id].index];
    }

    function addLicencesContract(address licencesContract) public onlyOwner {
        _licences = Licences(licencesContract);
    }

    function validateTrade(bytes16 tradeId) public onlyOwner returns (bool) {
        (bytes16 orderId, , , , , uint8 fromZone, uint8 toZone) = _history.getTradeDetails(tradeId);
        Order memory order = _orders[_idToIndex[orderId].index];

        if (toZone == fromZone) return true;

        bool validTo = _zones[toZone].isToTransferValid(order.quantity);
        bool validFrom = _zones[fromZone].isFromTransferValid(order.quantity);

        if (validFrom && validTo) return true;

        if (order.orderType == OrderType.Sell) {
            _unmatchedSells.push(order.id);
        } else {
            _unmatchedBuys.push(order.id);
        }

        _orders[_idToIndex[orderId].index].matchedTimeStamp = 0;

        emit OrderUnmatched(order.id);

        _history.invalidateTrade(tradeId);
    }

    function completeTrade(bytes16 tradeId) public onlyOwner {
        (, address buyer, , , uint256 quantity, , uint8 toZone) = _history.getTradeDetails(tradeId);

        _history.completeTrade(tradeId);
        _zones[toZone].orderBookCredit(buyer, quantity);
    }

    function getLastTradedPrice() public view returns (uint256) {
        return _lastTradedPrice;
    }

    function getScheme() external view returns (string memory) {
        return _scheme;
    }

    function getYear() external view returns (uint256) {
        return _year;
    }

    function createId(
        uint256 timestamp,
        uint256 price,
        uint256 quantity,
        address user
    ) private pure returns (bytes16) {
        return bytes16(keccak256(abi.encode(timestamp, price, quantity, user)));
    }

    function removeUnmatchedSellId(bytes32 id) internal {
        for (uint256 i = 0; i < _unmatchedSells.length; i++) {
            if (_unmatchedSells[i] == id) {
                if (i != _unmatchedSells.length - 1) {
                    _unmatchedSells[i] = _unmatchedSells[_unmatchedSells.length - 1];
                }
                _unmatchedSells.pop();
            }
        }
    }

    function removeUnmatchedBuyId(bytes32 id) internal {
        for (uint256 i = 0; i < _unmatchedBuys.length; i++) {
            if (_unmatchedBuys[i] == id) {
                if (i != _unmatchedBuys.length - 1) {
                    _unmatchedBuys[i] = _unmatchedBuys[_unmatchedBuys.length - 1];
                }
                _unmatchedBuys.pop();
            }
        }
    }

    function addSellLimitOrder(
        uint256 price,
        uint256 quantity,
        uint8 zoneIndex
    ) external {
        Zone zone = _zones[zoneIndex];
        require(quantity > 0 && price > 0, "Values must be greater than 0");
        require(zone.balanceOf(msg.sender) >= quantity, "Insufficient water allocation");
        bytes16 id = addOrder(price, quantity, zoneIndex, OrderType.Sell);
        zone.orderBookDebit(msg.sender, quantity);
        _unmatchedSells.push(id);
    }

    function addBuyLimitOrder(
        uint256 price,
        uint256 quantity,
        uint8 zoneIndex
    ) external {
        require(quantity > 0 && price > 0, "Values must be greater than 0");
        bytes16 id = addOrder(price, quantity, zoneIndex, OrderType.Buy);
        _unmatchedBuys.push(id);
    }

    function addOrder(
        uint256 price,
        uint256 quantity,
        uint8 zoneIndex,
        OrderType orderType
    ) internal returns (bytes16) {
        bytes16 id = createId(block.timestamp, price, quantity, msg.sender);
        _orders.push(Order(id, orderType, msg.sender, price, quantity, block.timestamp, 0, zoneIndex));
        _idToIndex[id] = IndexPosition(_orders.length - 1, true);
        emit OrderAdded(id, msg.sender, price, quantity, zoneIndex, orderType);
        return id;
    }

    function acceptOrder(bytes16 id, uint8 zone) public guardId(id) {
        Order storage order = _orders[_idToIndex[id].index];
        require(order.owner != msg.sender, "You cannot accept your own order");

        order.matchedTimeStamp = block.timestamp;

        _lastTradedPrice = order.price;

        uint8 toZone = order.zone;
        uint8 fromZone = order.zone;

        address buyer = order.owner;
        address seller = order.owner;

        if (order.orderType == OrderType.Sell) {
            removeUnmatchedSellId(id);
            toZone = zone;
            buyer = msg.sender;
        } else {
            removeUnmatchedBuyId(id);
            fromZone = zone;
            seller = msg.sender;
        }

        _history.addHistory(buyer, seller, order.price, order.quantity, fromZone, toZone, order.id);

        emit OrderAccepted(id, msg.sender);
    }

    function getOrderBookSells() public view returns (Order[] memory) {
        return getOrders(_unmatchedSells);
    }

    function getOrderBookBuys() public view returns (Order[] memory) {
        return getOrders(_unmatchedBuys);
    }

    function getOrders(bytes16[] storage ids) internal view returns (Order[] memory) {
        Order[] memory returnedOrders = new Order[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            returnedOrders[i] = _orders[_idToIndex[ids[i]].index];
        }

        return returnedOrders;
    }

    function deleteOrder(bytes16 id) external guardId(id) {
        Order memory order = _orders[_idToIndex[id].index];
        require(order.owner != address(0), "This order does not exist");
        require(order.owner == msg.sender, "You can only delete your own order");
        require(order.matchedTimeStamp == 0, "This order has been matched");
        delete _orders[_idToIndex[id].index];

        if (order.orderType == OrderType.Sell) {
            removeUnmatchedSellId(order.id);
            _zones[order.zone].orderBookCredit(order.owner, order.quantity);
        } else {
            removeUnmatchedBuyId(order.id);
        }

        emit OrderDeleted(order.id);
    }

    function getLicenceOrderBookSells(address licenceAddress) external view returns (Order[] memory) {
        uint256 count = getLicenceUnmatchedSellsCount(licenceAddress);

        Order[] memory returnedOrders = new Order[](count);

        uint256 foundCount = 0;
        for (uint256 i = 0; i < _unmatchedSells.length; i++) {
            Order memory order = _orders[_idToIndex[_unmatchedSells[i]].index];
            if (order.matchedTimeStamp == 0 && order.owner == licenceAddress) {
                returnedOrders[foundCount] = order;
                foundCount++;
            }
        }

        return returnedOrders;
    }

    function getLicenceOrderBookBuys(address licenceAddress) external view returns (Order[] memory) {
        uint256 count = getLicenceUnmatchedBuysCount(licenceAddress);

        Order[] memory returnedOrders = new Order[](count);

        uint256 foundCount = 0;
        for (uint256 i = 0; i < _unmatchedBuys.length; i++) {
            Order memory order = _orders[_idToIndex[_unmatchedBuys[i]].index];
            if (order.matchedTimeStamp == 0 && order.owner == licenceAddress) {
                returnedOrders[foundCount] = order;
                foundCount++;
            }
        }

        return returnedOrders;
    }

    function getLicenceUnmatchedSellsCount(address licenceAddress) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _unmatchedSells.length; i++) {
            Order memory order = _orders[_idToIndex[_unmatchedSells[i]].index];
            if (order.matchedTimeStamp == 0 && order.owner == licenceAddress) {
                count++;
            }
        }
        return count;
    }

    function getLicenceUnmatchedBuysCount(address licenceAddress) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _unmatchedBuys.length; i++) {
            Order memory order = _orders[_idToIndex[_unmatchedBuys[i]].index];
            if (order.matchedTimeStamp == 0 && order.owner == licenceAddress) {
                count++;
            }
        }

        return count;
    }

    modifier guardId(bytes16 id) {
        require(_idToIndex[id].isValid, "The ID provided is not valid");
        _;
    }

    event OrderDeleted(bytes16 id);
    event OrderUnmatched(bytes16 orderId);
    event OrderAccepted(bytes16 orderId, address indexed buyer);
    event OrderAdded(bytes16 id, address indexed licenceAddress, uint256 price, uint256 quantity, uint8 zone, OrderType orderType);
}
