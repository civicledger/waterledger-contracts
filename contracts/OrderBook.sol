pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Zone.sol";
// import "./QuickSort.sol";
import "./History.sol";
import "./Licences.sol";

contract OrderBook is QuickSort, Ownable {
    using SafeMath for uint256;

    Zone[] public _zones;
    string[] public _zoneNames;
    History public _history;
    Licences public _licences;
    uint256 public _year;

    uint256 public _lastTradedPrice;

    struct IndexPosition {
        uint256 index;
        bool isValid;
    }

    mapping(bytes16 => IndexPosition) public _idToIndex;

    enum OrderType {Sell, Buy}

    struct Order {
        bytes16 id;
        uint256 orderIndex;
        OrderType orderType;
        address owner;
        uint256 price;
        uint256 quantity;
        uint256 timeStamp;
        uint256 matchedTimeStamp;
        uint8 zone;
    }

    Order[] public _buys;
    Order[] public _sells;

    bytes16[] public _unmatchedBuys;
    bytes16[] public _unmatchedSells;

    string _scheme = "";

    constructor(string memory scheme, uint256 year) public Ownable() {
        _scheme = scheme;
        _year = year;
    }

    function addZone(string memory name, address zoneContract) public onlyOwner {
        _zones.push(Zone(zoneContract));
        _zoneNames.push(name);
    }

    function getZoneNames() public view returns (string[] memory) {
        return _zoneNames;
    }

    function getYear() public view returns (uint256) {
        return _year;
    }

    function addHistoryContract(address historyContract) public onlyOwner {
        _history = History(historyContract);
    }

    function getBuyById(bytes16 id) public view returns (Order memory) {
        return _buys[_idToIndex[id].index];
    }

    function getSellById(bytes16 id) public view returns (Order memory) {
        return _sells[_idToIndex[id].index];
    }

    function addLicencesContract(address licencesContract) public onlyOwner {
        _licences = Licences(licencesContract);
    }

    function validateTrade(uint256 tradeIndex) public onlyOwner returns (bool) {
        (address buyer, uint256 quantity, uint8 toZone, uint8 fromZone, bytes16 buyId, bytes16 sellId) = _history.getTrade(tradeIndex);

        if (toZone == fromZone) {
            return true;
        }

        if (!_zones[toZone].isToTransferValid(quantity)) {
            _buys[_idToIndex[buyId].index].matchedTimeStamp = 0;
            _sells[_idToIndex[sellId].index].matchedTimeStamp = 0;
            _history.invalidateTrade(tradeIndex);
        }

        if (!_zones[fromZone].isFromTransferValid(quantity)) {
            _buys[_idToIndex[buyId].index].matchedTimeStamp = 0;
            _sells[_idToIndex[sellId].index].matchedTimeStamp = 0;
            _history.invalidateTrade(tradeIndex);
        }

        return true;
    }

    function completeTrade(uint256 tradeIndex) public onlyOwner {
        (address buyer, uint256 quantity, uint8 toZone, uint8 fromZone, bytes16 buyId, bytes16 sellId) = _history.getTrade(tradeIndex);
        _history.completeTrade(tradeIndex);
        _zones[toZone].orderBookCredit(buyer, quantity);
    }

    function getLastTradedPrice() public view returns (uint256) {
        return _lastTradedPrice;
    }

    function getScheme() external view returns (string memory) {
        return _scheme;
    }

    function createId(
        uint256 timestamp,
        uint256 price,
        uint256 quantity,
        address user
    ) public pure returns (bytes16) {
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

    function getUnmatchedSellsCount() public view returns (uint256) {
        return _unmatchedSells.length;
    }

    function getUnmatchedBuysCount() public view returns (uint256) {
        return _unmatchedBuys.length;
    }

    function addSellLimitOrder(
        uint256 price,
        uint256 quantity,
        uint8 zoneIndex
    ) public {
        Zone zone = _zones[zoneIndex];
        require(quantity > 0 && price > 0, "Values must be greater than 0");
        require(zone.balanceOf(msg.sender) >= quantity, "Insufficient water allocation");
        bytes16 id = createId(block.timestamp, price, quantity, msg.sender);

        _sells.push(Order(id, _sells.length, OrderType.Sell, msg.sender, price, quantity, now, 0, zoneIndex));
        _idToIndex[id] = IndexPosition(_sells.length - 1, true);
        zone.orderBookDebit(msg.sender, quantity);
        _unmatchedSells.push(id);
        emit SellOrderAdded(id, msg.sender, price, quantity, zoneIndex);
    }

    function acceptSellOrder(bytes16 id, uint8 toZone) public {
        Order storage order = _sells[_idToIndex[id].index];
        order.matchedTimeStamp = block.timestamp;

        _history.addHistory(msg.sender, order.owner, order.price, order.quantity, order.zone, toZone, 0, order.id);
        removeUnmatchedSellId(id);
        emit SellOrderAccepted(id, msg.sender);
    }

    function acceptBuyOrder(bytes16 id, uint8 fromZone) public {
        Order storage order = _buys[_idToIndex[id].index];
        order.matchedTimeStamp = block.timestamp;

        _history.addHistory(msg.sender, order.owner, order.price, order.quantity, order.zone, fromZone, order.id, 0);
        removeUnmatchedBuyId(id);
        emit BuyOrderAccepted(id, msg.sender);
    }

    function addBuyLimitOrder(
        uint256 price,
        uint256 quantity,
        uint8 zoneIndex
    ) public {
        require(quantity > 0 && price > 0, "Values must be greater than 0");

        bytes16 id = createId(block.timestamp, price, quantity, msg.sender);
        _buys.push(Order(id, _buys.length, OrderType.Buy, msg.sender, price, quantity, now, 0, zoneIndex));
        _idToIndex[id] = IndexPosition(_buys.length - 1, true);
        emit BuyOrderAdded(id, msg.sender, price, quantity, zoneIndex);
    }

    function getOrderBookSells() public view returns (Order[] memory) {
        Order[] memory returnedOrders = new Order[](_unmatchedSells.length);

        for (uint256 i = 0; i < _unmatchedSells.length; i++) {
            returnedOrders[i] = _sells[_idToIndex[_unmatchedSells[i]].index];
        }

        return returnedOrders;
    }

    function getOrderBookBuys() public view returns (Order[] memory) {
        Order[] memory returnedOrders = new Order[](_unmatchedBuys.length);

        for (uint256 i = 0; i < _unmatchedBuys.length; i++) {
            returnedOrders[i] = _buys[_idToIndex[_unmatchedBuys[i]].index];
        }

        return returnedOrders;
    }

    function deleteBuyOrder(uint256 orderIndex) external {
        Order memory order = _buys[orderIndex];
        require(order.owner != address(0), "This order does not exist");
        require(order.owner == msg.sender, "You can only delete your own order");
        require(order.matchedTimeStamp == 0, "This order has been matched");
        delete _buys[orderIndex];
        removeUnmatchedBuyId(order.id);
        emit BuyOrderDeleted(order.id);
    }

    function deleteSellOrder(uint256 orderIndex) external {
        Order memory order = _sells[orderIndex];
        require(order.owner != address(0), "This order does not exist");
        require(order.owner == msg.sender, "You can only delete your own order");
        require(order.matchedTimeStamp == 0, "This order has been matched");
        delete _sells[orderIndex];
        removeUnmatchedSellId(order.id);
        emit SellOrderDeleted(order.id);
    }

    // function getLicenceOrderBookSells(address licenceAddress, uint256 numberOfOrders) public view returns (Order[] memory) {
    //     uint256 sellsCount = getLicenceUnmatchedSellsCount(licenceAddress);
    //     uint256 max = sellsCount < numberOfOrders ? sellsCount : numberOfOrders;

    //     if (max > 10) {
    //         max = 10;
    //     }

    //     uint256[] memory sortedIndexes = getLicencePriceTimeSellOrders(licenceAddress);

    //     Order[] memory returnedOrders = new Order[](max);

    //     for (uint256 i = 0; i < max; i++) {
    //         returnedOrders[i] = _sells[sortedIndexes[i]];
    //     }

    //     return returnedOrders;
    // }

    // function getLicenceOrderBookBuys(address licenceAddress, uint256 numberOfOrders) public view returns (Order[] memory) {
    //     uint256 buysCount = getLicenceUnmatchedBuysCount(licenceAddress);

    //     uint256 max = buysCount < numberOfOrders ? buysCount : numberOfOrders;

    //     if (max > 10) {
    //         max = 10;
    //     }

    //     uint256[] memory sortedIndexes = getLicencePriceTimeBuyOrders(licenceAddress);

    //     Order[] memory returnedOrders = new Order[](max);

    //     for (uint256 i = 0; i < max; i++) {
    //         returnedOrders[i] = _buys[sortedIndexes[i]];
    //     }

    //     return returnedOrders;
    // }

    // function getLicencePriceTimeSellOrders(address licenceAddress) internal view returns (uint256[] memory) {
    //     uint256 count = getLicenceUnmatchedSellsCount(licenceAddress);

    //     uint256[] memory prices = new uint256[](count);
    //     uint256[] memory indexes = new uint256[](count);

    //     if (count == 0) {
    //         return indexes;
    //     }

    //     uint256 j = 0;
    //     for (uint256 i = 0; i < _sells.length; i++) {
    //         if (_sells[i].matchedTimeStamp == 0 && _sells[i].owner == licenceAddress) {
    //             prices[j] = _sells[i].price;
    //             indexes[j] = i;
    //             j += 1;
    //         }
    //     }

    //     uint256[] memory sortedIndexes = sortWithIndex(prices, indexes);
    //     return sortedIndexes;
    // }

    // function getLicencePriceTimeBuyOrders(address licenceAddress) internal view returns (uint256[] memory) {
    //     uint256 count = getLicenceUnmatchedBuysCount(licenceAddress);

    //     uint256[] memory prices = new uint256[](count);
    //     uint256[] memory indexes = new uint256[](count);

    //     if (count == 0) {
    //         return indexes;
    //     }

    //     uint256 j = 0;
    //     for (uint256 i = 0; i < _buys.length; i++) {
    //         if (_buys[i].matchedTimeStamp == 0 && _buys[i].owner == licenceAddress) {
    //             prices[j] = _buys[i].price;
    //             indexes[j] = i;
    //             j += 1;
    //         }
    //     }

    //     uint256[] memory sortedIndexes = reverseSortWithIndex(prices, indexes);
    //     return sortedIndexes;
    // }

    // function getLicenceUnmatchedSellsCount(address licenceAddress) internal view returns (uint256) {
    //     uint256 count = 0;
    //     for (uint256 i = 0; i < _unmatchedSells.length; i++) {
    //         Order memory order = _sells[_idToIndex[_unmatchedSells[i]].index];
    //         if (order.matchedTimeStamp == 0 && order.owner == licenceAddress) {
    //             count++;
    //         }
    //     }
    //     return count;
    // }

    // function getLicenceUnmatchedBuysCount(address licenceAddress) internal view returns (uint256) {
    //     uint256 count = 0;
    //     for (uint256 i = 0; i < _unmatchedBuys.length; i++) {
    //         Order memory order = _buys[_idToIndex[_unmatchedBuys[i]].index];
    //         if (order.matchedTimeStamp == 0 && order.owner == licenceAddress) {
    //             count++;
    //         }
    //     }

    //     return count;
    // }

    modifier guardId(bytes16 id) {
        require(_idToIndex[id].isValid, "The ID provided is not valid");
        _;
    }

    event SellOrderAccepted(bytes16 orderId, address indexed buyer);
    event BuyOrderAccepted(bytes16 orderId, address indexed seller);
    event BuyOrderAdded(bytes16 id, address indexed licenceAddress, uint256 price, uint256 quantity, uint8 zone);
    event SellOrderAdded(bytes16 id, address indexed licenceAddress, uint256 price, uint256 quantity, uint8 zone);
    event BuyOrderDeleted(bytes16 id);
    event SellOrderDeleted(bytes16 id);
}
