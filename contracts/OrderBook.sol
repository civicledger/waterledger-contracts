pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Zone.sol";
import "./QuickSort.sol";
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

    mapping(bytes16 => uint256) public _idToBuyIndex;
    mapping(bytes16 => uint256) public _idToSellIndex;

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
        return _buys[_idToBuyIndex[id]];
    }

    function getSellById(bytes16 id) public view returns (Order memory) {
        return _sells[_idToSellIndex[id]];
    }

    function addLicencesContract(address licencesContract) public onlyOwner {
        _licences = Licences(licencesContract);
    }

    function validateTrade(uint256 tradeIndex) public onlyOwner returns (bool) {
        (address buyer, uint256 quantity, uint8 toZone, uint8 fromZone, uint256 buyIndex, uint256 sellIndex) = _history
            .getTrade(tradeIndex);

        if (toZone == fromZone) {
            return true;
        }

        if (!_zones[toZone].isToTransferValid(quantity)) {
            _buys[buyIndex].matchedTimeStamp = 0;
            _sells[sellIndex].matchedTimeStamp = 0;
            _history.invalidateTrade(tradeIndex);
        }

        if (!_zones[fromZone].isFromTransferValid(quantity)) {
            _buys[buyIndex].matchedTimeStamp = 0;
            _sells[sellIndex].matchedTimeStamp = 0;
            _history.invalidateTrade(tradeIndex);
        }

        return true;
    }

    function completeTrade(uint256 tradeIndex) public onlyOwner {
        (address buyer, uint256 quantity, uint8 toZone, uint8 fromZone, uint256 buyIndex, uint256 sellIndex) = _history
            .getTrade(tradeIndex);
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
        uint256 sellIndex = _sells.length - 1;
        _idToSellIndex[id] = sellIndex;
        zone.orderBookDebit(msg.sender, quantity);

        emit SellOrderAdded(id, msg.sender, price, quantity, zoneIndex);

        bool isUnmatched = true;

        if (_buys.length > 0) {
            uint256 i = 0;
            uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

            while (isUnmatched && i < sortedIndexes.length) {
                uint256 j = sortedIndexes[i];

                if (
                    _buys[j].matchedTimeStamp == 0 &&
                    _buys[j].price >= price &&
                    _buys[j].quantity == quantity &&
                    _buys[j].owner != msg.sender
                ) {
                    _history.addHistory(
                        msg.sender,
                        _buys[j].owner,
                        _buys[j].price,
                        _buys[j].quantity,
                        zoneIndex,
                        _buys[j].zone,
                        j,
                        sellIndex
                    );
                    _buys[j].matchedTimeStamp = now;
                    _sells[sellIndex].matchedTimeStamp = now;

                    isUnmatched = false;
                    _lastTradedPrice = _buys[j].price;
                }

                i++;
            }
        }
    }

    function addBuyLimitOrder(
        uint256 price,
        uint256 quantity,
        uint8 zoneIndex
    ) public {
        require(quantity > 0 && price > 0, "Values must be greater than 0");

        bytes16 id = createId(block.timestamp, price, quantity, msg.sender);

        //Push to array first
        _buys.push(Order(id, _buys.length, OrderType.Buy, msg.sender, price, quantity, now, 0, zoneIndex));
        uint256 buyIndex = _buys.length - 1;
        _idToBuyIndex[id] = buyIndex;
        emit BuyOrderAdded(id, msg.sender, price, quantity, zoneIndex);

        bool isUnmatched = true;

        if (_sells.length > 0) {
            uint256 i = 0;
            uint256[] memory sortedIndexes = getPriceTimeSellOrders();

            while (isUnmatched && i < sortedIndexes.length) {
                uint256 j = sortedIndexes[i];

                if (
                    _sells[j].matchedTimeStamp == 0 &&
                    _sells[j].price <= price &&
                    _sells[j].quantity == quantity &&
                    _sells[j].owner != msg.sender
                ) {
                    _history.addHistory(
                        msg.sender,
                        _sells[j].owner,
                        _sells[j].price,
                        _sells[j].quantity,
                        _sells[j].zone,
                        zoneIndex,
                        buyIndex,
                        j
                    );

                    _sells[j].matchedTimeStamp = now;
                    _buys[buyIndex].matchedTimeStamp = now;

                    _lastTradedPrice = _sells[j].price;
                    isUnmatched = false;
                }

                i++;
            }
        }
    }

    function getOrderBookSells(uint256 numberOfOrders) public view returns (Order[] memory) {
        uint256 max = getUnmatchedSellsCount() < numberOfOrders ? getUnmatchedSellsCount() : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getPriceTimeSellOrders();

        Order[] memory returnedOrders = new Order[](max);

        for (uint256 i = 0; i < max; i++) {
            returnedOrders[i] = _sells[sortedIndexes[i]];
        }

        return returnedOrders;
    }

    function getOrderBookBuys(uint256 numberOfOrders) public view returns (Order[] memory) {
        uint256 max = getUnmatchedBuysCount() < numberOfOrders ? getUnmatchedBuysCount() : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

        Order[] memory returnedOrders = new Order[](max);

        for (uint256 i = 0; i < max; i++) {
            returnedOrders[i] = _buys[sortedIndexes[i]];
        }

        return returnedOrders;
    }

    function getLicenceOrderBookSells(address licenceAddress, uint256 numberOfOrders)
        public
        view
        returns (Order[] memory)
    {
        uint256 sellsCount = getLicenceUnmatchedSellsCount(licenceAddress);
        uint256 max = sellsCount < numberOfOrders ? sellsCount : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getLicencePriceTimeSellOrders(licenceAddress);

        Order[] memory returnedOrders = new Order[](max);

        for (uint256 i = 0; i < max; i++) {
            returnedOrders[i] = _sells[sortedIndexes[i]];
        }

        return returnedOrders;
    }

    function deleteBuyOrder(uint256 orderIndex) external {
        Order memory order = _buys[orderIndex];
        require(order.owner != address(0), "This order does not exist");
        require(order.owner == msg.sender, "You can only delete your own order");
        require(order.matchedTimeStamp == 0, "This order has been matched");
        delete _buys[orderIndex];
        emit BuyOrderDeleted(order.id);
    }

    function deleteSellOrder(uint256 orderIndex) external {
        Order memory order = _sells[orderIndex];
        require(order.owner != address(0), "This order does not exist");
        require(order.owner == msg.sender, "You can only delete your own order");
        require(order.matchedTimeStamp == 0, "This order has been matched");
        _zones[order.zone].orderBookReCredit(order.owner, order.quantity);
        delete _sells[orderIndex];
        emit SellOrderDeleted(order.id);
    }

    function getLicenceOrderBookBuys(address licenceAddress, uint256 numberOfOrders)
        public
        view
        returns (Order[] memory)
    {
        uint256 buysCount = getLicenceUnmatchedBuysCount(licenceAddress);

        uint256 max = buysCount < numberOfOrders ? buysCount : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getLicencePriceTimeBuyOrders(licenceAddress);

        Order[] memory returnedOrders = new Order[](max);

        for (uint256 i = 0; i < max; i++) {
            returnedOrders[i] = _buys[sortedIndexes[i]];
        }

        return returnedOrders;
    }

    function getPriceTimeSellOrders() internal view returns (uint256[] memory) {
        uint256 count = getUnmatchedSellsCount();

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint256 j = 0;
        for (uint256 i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0 && _sells[i].owner != address(0)) {
                prices[j] = _sells[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = sortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getLicencePriceTimeSellOrders(address licenceAddress) internal view returns (uint256[] memory) {
        uint256 count = getLicenceUnmatchedSellsCount(licenceAddress);

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint256 j = 0;
        for (uint256 i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0 && _sells[i].owner == licenceAddress) {
                prices[j] = _sells[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = sortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getPriceTimeBuyOrders() internal view returns (uint256[] memory) {
        uint256 count = getUnmatchedBuysCount();

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint256 j = 0;
        for (uint256 i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0 && _buys[i].owner != address(0)) {
                prices[j] = _buys[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = reverseSortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getLicencePriceTimeBuyOrders(address licenceAddress) internal view returns (uint256[] memory) {
        uint256 count = getLicenceUnmatchedBuysCount(licenceAddress);

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint256 j = 0;
        for (uint256 i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0 && _buys[i].owner == licenceAddress) {
                prices[j] = _buys[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = reverseSortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getUnmatchedSellsCount() internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0 && _sells[i].owner != address(0)) {
                count++;
            }
        }

        return count;
    }

    function getLicenceUnmatchedSellsCount(address licenceAddress) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0 && _sells[i].owner == licenceAddress) {
                count++;
            }
        }

        return count;
    }

    function getUnmatchedBuysCount() internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0 && _buys[i].owner != address(0)) {
                count++;
            }
        }

        return count;
    }

    function getLicenceUnmatchedBuysCount(address licenceAddress) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0 && _buys[i].owner == licenceAddress) {
                count++;
            }
        }

        return count;
    }

    event BuyOrderAdded(bytes16 id, address indexed licenceAddress, uint256 price, uint256 quantity, uint8 zone);
    event SellOrderAdded(bytes16 id, address indexed licenceAddress, uint256 price, uint256 quantity, uint8 zone);
    event BuyOrderDeleted(bytes16 id);
    event SellOrderDeleted(bytes16 id);
}
