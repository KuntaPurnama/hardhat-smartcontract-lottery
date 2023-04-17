const { ethers } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESSES_FILE = "../nextjs-smart-contract-lottery/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-smart-contract-lottery/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("update front end")
        await updateContractAddress()
        updateAbi()
    }
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddress() {
    const raffle = ethers.getContract("Raffle")
    const chainId = network.config.chainId.toString()
    const contractAddress = (await raffle).address
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(contractAddress)) {
            currentAddresses[chainId].push(contractAddress)
        }
    } else {
        currentAddresses[chainId] = [contractAddress]
    }

    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}
module.exports.tags = ["all", "frontend"]
