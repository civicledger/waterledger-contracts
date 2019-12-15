const assemble = (structure, dataArrays) => {
  if(structure.length !== dataArrays.length) {
    throw Error("The structure and data do not match");
  }

  return dataArrays[0].map((data, index) => {
    let newObject = {};
    structure.forEach((field, innerIndex) => {
      let fieldRowValue = dataArrays[innerIndex][index];
      newObject[field.name] = returnType(fieldRowValue, field.type);
    })
    return newObject;
  });
}

const returnType = (value, type) => {
  switch(type) {
    case 'bytes32': return web3.utils.hexToUtf8(value);
    case 'uint256': 
    case 'uint': return Number(value);
    default: return value;
  }
}

module.exports = { assemble }