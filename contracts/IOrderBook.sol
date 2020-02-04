pragma solidity ^0.4.24;

interface IOrderBook {

    function addBuyLimitOrder(uint256 price, uint256 quantity, uint8 zone) external;

    function addSellLimitOrder(uint256 price, uint256 quantity, uint8 zone) external;

    function getOrderBookBuys(uint256 numberOfOrders) external view returns (
        uint256[],
        address[],
        uint256[],
        uint256[],
        uint256[]
    );

    function getOrderBookSells(uint256 numberOfOrders) external view returns (
        uint256[],
        address[],
        uint256[],
        uint256[],
        uint256[]
    );

    function lowestSell() external view returns(address, uint256, uint256, uint256);

    function highestBuy() external view returns(address, uint256, uint256, uint256);
}