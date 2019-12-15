pragma solidity ^0.4.24;

contract TradeRestriction {

    address _parentContract;

    constructor() public {
        _parentContract = msg.sender;
    }

    modifier onlyParentContract {
        require(msg.sender == _parentContract, 'Only parent contract can add trading periods');
        _;
    }

}