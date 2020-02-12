pragma solidity ^0.4.24;

import "./Ownable.sol";
import "./Zone.sol";
import "./IOrderBook.sol";
import "./QuickSort.sol";
import "./SafeMath.sol";
import "./History.sol";
import "./Users.sol";

contract OrderBook is IOrderBook, QuickSort, Ownable {
    using SafeMath for uint;

    Zone[] public _zones;
    bytes32[] public _zoneNames;
    History public _history;
    Users public _users;

    enum OrderType { Sell, Buy }

    struct Order {
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

    function addZone(bytes32 name, address zoneContract) public onlyOwner {
        _zones.push(Zone(zoneContract));
        _zoneNames.push(name);
    }

    function addHistoryContract(address historyContract) public onlyOwner {
        _history = History(historyContract);
    }

    function addUsersContract(address usersContract) public onlyOwner {
        _users = Users(usersContract);
    }

    function addSellLimitOrder(uint256 price, uint256 quantity, uint8 zoneIndex) public {
        Zone zone = _zones[zoneIndex];
        require(quantity > 0 && price > 0, "Values must be greater than 0");
        require(zone.balanceOf(msg.sender) >= quantity, "Insufficient water allocation");

        uint256 sellCount = _sells.push(Order(OrderType.Sell, msg.sender, price, quantity, now, 0, zoneIndex));
        uint256 sellIndex = sellCount - 1;
        //_stats.updateVolumeAvailable(quantity);
        zone.orderBookDebit(msg.sender, quantity);

        emit OrderAdded(msg.sender);

        uint256 matchedQuantity = 0;

        if (_buys.length > 0) {

            uint256 i = 0;
            uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

            while (matchedQuantity < quantity && i < sortedIndexes.length) {

                uint256 j = sortedIndexes[i];

                if (_buys[j].matchedTimeStamp == 0 && _buys[j].price >= price && _buys[j].quantity == quantity) {

                    //Credit the seller with AUD
                    //zone.orderBookCredit(msg.sender, _buys[j].quantity * price);

                    //Credit the buyer with water
                    //zone.orderBookCredit(_buys[j].owner, _buys[j].quantity);

                    // _stats.reduceVolumeAvailable(quantity);
                    // _stats.setLastTradePrice(price);

                    _history.addHistory(msg.sender, _buys[j].owner, _buys[j].price, _buys[j].quantity, zoneIndex, zoneIndex);
                    _buys[j].matchedTimeStamp = now;
                    _sells[sellIndex].matchedTimeStamp = now;

                    matchedQuantity += _buys[j].quantity;

                    emit Matched(_buys[j].owner, _buys[j].price, _buys[j].quantity, zoneIndex, _buys[j].zone);
                }

                i++;
            }
        }
    }

    function addBuyLimitOrder(uint256 price, uint256 quantity, uint8 zoneIndex) public {
        Zone zone = _zones[zoneIndex];
        require(quantity > 0 && price > 0, "Values must be greater than 0");
        require(zone.balanceOf(msg.sender) >= price * quantity, "Insufficient AUD allocation");

        //Push to array first
        uint256 buyCount = _buys.push(Order(OrderType.Buy, msg.sender, price, quantity, now, 0, zoneIndex));
        uint256 buyIndex = buyCount - 1;
        zone.orderBookDebit(msg.sender, price * quantity);

        emit OrderAdded(msg.sender);

        uint256 matchedQuantity = 0;

        if (_sells.length > 0) {

            uint256 i = 0;
            uint256[] memory sortedIndexes = getPriceTimeSellOrders();

            while (matchedQuantity < quantity && i < sortedIndexes.length) {

                uint256 j = sortedIndexes[i];

                if ( _sells[j].matchedTimeStamp == 0 && _sells[j].price <= price && _sells[j].quantity == (quantity - matchedQuantity)) {
                    _history.addHistory(msg.sender, _sells[j].owner, _sells[j].price, _sells[j].quantity, zoneIndex, zoneIndex);

                    _sells[j].matchedTimeStamp = now;
                    _buys[buyIndex].matchedTimeStamp = now;

                    matchedQuantity += _sells[j].quantity;

                    //Credit the seller with AUD
                    //zone.orderBookCredit(_sells[j].owner, _sells[j].quantity * price);

                    //Credit the buyer with water
                    //zone.orderBookCredit(msg.sender, _sells[j].quantity);

                    // _stats.reduceVolumeAvailable(quantity);
                    // _stats.setLastTradePrice(price);

                    emit Matched(_sells[j].owner, _sells[j].price, _sells[j].quantity, _sells[j].zone, zoneIndex);
                }

                i++;
            }
        }
    }

    function getOrderBook() public view returns (
        OrderType[],
        address[],
        uint256[],
        uint256[],
        uint256[]
    ) {
        uint256 totalLength = getUnmatchedSellsCount() + getUnmatchedBuysCount();

        OrderType[] memory orderTypes = new OrderType[](totalLength);

        address[] memory owners = new address[](totalLength);
        uint256[] memory prices = new uint256[](totalLength);
        uint256[] memory quantities = new uint256[](totalLength);
        uint256[] memory timeStamps = new uint256[](totalLength);

        for(uint256 i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0) {
                orderTypes[i] = _sells[i].orderType;
                owners[i] = _sells[i].owner;
                prices[i] = _sells[i].price;
                quantities[i] = _sells[i].quantity;
                timeStamps[i] = _sells[i].timeStamp;
            }
        }

        for(uint256 j = 0; j < _buys.length; j++) {
            if (_buys[j].matchedTimeStamp == 0) {
                orderTypes[_sells.length + j] = _buys[j].orderType;
                owners[_sells.length + j] = _buys[j].owner;
                prices[_sells.length + j] = _buys[j].price;
                quantities[_sells.length + j] = _buys[j].quantity;
                timeStamps[_sells.length + j] = _buys[j].timeStamp;
            }
        }

        return (orderTypes, owners, prices, quantities, timeStamps);
    }

    function getOrderBookSells(uint256 numberOfOrders) public view returns (
        OrderType[],
        address[],
        uint256[],
        uint256[],
        uint256[]
    ) {

        uint256 max = getUnmatchedSellsCount() < numberOfOrders ? getUnmatchedSellsCount() : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getPriceTimeSellOrders();

        OrderType[] memory orderTypes = new OrderType[](max);
        address[] memory owners = new address[](max);
        uint256[] memory prices = new uint256[](max);
        uint256[] memory quantities = new uint256[](max);
        uint256[] memory timeStamps = new uint256[](max);

        for(uint256 i = 0; i < max; i++) {
            orderTypes[i] = _sells[sortedIndexes[i]].orderType;
            owners[i] = _sells[sortedIndexes[i]].owner;
            prices[i] = _sells[sortedIndexes[i]].price;
            quantities[i] = _sells[sortedIndexes[i]].quantity;
            timeStamps[i] = _sells[sortedIndexes[i]].timeStamp;
        }

        return (orderTypes, owners, prices, quantities, timeStamps);
    }

    function getOrderBookBuys(uint256 numberOfOrders) public view returns (
        OrderType[],
        address[],
        uint256[],
        uint256[],
        uint256[]
    ) {

        uint256 max = getUnmatchedBuysCount() < numberOfOrders ? getUnmatchedBuysCount() : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

        OrderType[] memory orderTypes = new OrderType[](max);
        address[] memory owners = new address[](max);
        uint256[] memory prices = new uint256[](max);
        uint256[] memory quantities = new uint256[](max);
        uint256[] memory timeStamps = new uint256[](max);

        for(uint256 i = 0; i < max; i++) {
            orderTypes[i] = _buys[sortedIndexes[i]].orderType;
            owners[i] = _buys[sortedIndexes[i]].owner;
            prices[i] = _buys[sortedIndexes[i]].price;
            quantities[i] = _buys[sortedIndexes[i]].quantity;
            timeStamps[i] = _buys[sortedIndexes[i]].timeStamp;
        }

        return (orderTypes, owners, prices, quantities, timeStamps);
    }

    function lowestSell() public view returns(address, uint256, uint256, uint256) {
        if (getUnmatchedSellsCount() > 0) {
            uint256[] memory sortedIndexes = getPriceTimeSellOrders();

            uint i = sortedIndexes[0];
            return (_sells[i].owner, _sells[i].price, _sells[i].quantity, _sells[i].timeStamp);
        }

        return (address(0), 0, 0, 0);
    }

    function highestBuy() public view returns(address, uint256, uint256, uint256) {
        if (getUnmatchedBuysCount() > 0) {
            uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

            uint i = sortedIndexes[0];
            return (_buys[i].owner, _buys[i].price, _buys[i].quantity, _buys[i].timeStamp);
        }

        return (address(0), 0, 0, 0);
    }

    function getPriceTimeSellOrders() internal view returns(uint256[]) {
        uint256 count = getUnmatchedSellsCount();

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint j = 0;
        for (uint i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0) {
                prices[j] = _sells[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = sortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getPriceTimeBuyOrders() internal view returns(uint256[]) {
        uint256 count = getUnmatchedBuysCount();

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint j = 0;
        for (uint i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0) {
                prices[j] = _buys[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = reverseSortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getSellsCount() public view returns (uint) {
        return _sells.length;
    }

    function getUnmatchedSellsCount() internal view returns (uint) {
        uint count = 0;
        for (uint i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0) {
                count++;
            }
        }

        return count;
    }

    function getBuysCount() public view returns (uint) {
        return _buys.length;
    }

    function getUnmatchedBuysCount() internal view returns (uint) {
        uint count = 0;
        for (uint i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0) {
                count++;
            }
        }

        return count;
    }

    event OrderAdded(address _stats);
    event Matched(address indexed owner, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone);
}