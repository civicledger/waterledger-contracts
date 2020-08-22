pragma solidity ^0.6.2;

interface EIP1753 {
    function grantAuthority(address who) external;

    function revokeAuthority(address who) external;

    function hasAuthority(address who) external pure returns (bool);

    function issue(
        address who,
        uint256 from,
        uint256 to
    ) external;

    function revoke(address who) external;

    function hasValid(address who) external view returns (bool);

    function purchase(uint256 validFrom, uint256 validTo) external payable;
}
