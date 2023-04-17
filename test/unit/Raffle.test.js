const { getNamedAccounts, ethers, deployments } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-harhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle unit test", function () {
          const chainId = network.config.chainId
          const FUND_AMOUNT = ethers.utils.parseEther("1")
          let deployer, raffle, raffleContract, vrfCoordinatorV2Contract, accounts, player, interval
          beforeEach(async () => {
              //   deployer = (await getNamedAccounts()).deployer
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              deployer = accounts[0]
              await deployments.fixture(["all"])
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock") // Returns a new connection to the VRFCoordinatorV2Mock contract
              raffleContract = await ethers.getContract("Raffle") // Returns a new connection to the Raffle contract
              raffle = raffleContract.connect(deployer) // Returns a new instance of the Raffle contract connected to player
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("test constructor value", async () => {
                  const gasLane = await raffle.getGasLane()
                  const keepersUpdateInterval = await raffle.getInterval()
                  const raffleEntranceFee = await raffle.getEntranceFee()
                  const callbackGasLimit = await raffle.getCallbackGasLimit()
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(networkConfig[chainId]["gasLane"], gasLane.toString())
                  assert.equal(
                      networkConfig[chainId]["keepersUpdateInterval"],
                      keepersUpdateInterval.toString()
                  )
                  assert.equal(
                      networkConfig[chainId]["raffleEntranceFee"],
                      raffleEntranceFee.toString()
                  )
                  assert.equal(
                      networkConfig[chainId]["callbackGasLimit"],
                      callbackGasLimit.toString()
                  )
                  assert.equal(raffleState.toString(), "0")
                  //networkConfig[chainId]["gasLane"],
                  // networkConfig[chainId]["keepersUpdateInterval"],
                  // networkConfig[chainId]["raffleEntranceFee"],
                  // networkConfig[chainId]["callbackGasLimit"]
              })
          })

          describe("enterRuffle", function () {
              it("enterRaffle Raffle__NotEnoughETHEntered", async function () {
                  //   await raffleContract.enterRuffle()
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })

              it("enterRaffle success", async function () {
                  await expect(raffle.enterRaffle({ value: FUND_AMOUNT })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("enterRaffle check player", async function () {
                  await raffle.enterRaffle({ value: FUND_AMOUNT })
                  assert.equal(await raffle.getPlayer(0), deployer.address)
              })

              it("enterRaffle not open", async function () {
                  await raffle.enterRaffle({ value: FUND_AMOUNT })
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await raffle.performUpkeep([])

                  await expect(raffle.enterRaffle({ value: FUND_AMOUNT })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })

              it("enterRaffle emit event", async function () {
                  await expect(await raffle.enterRaffle({ value: FUND_AMOUNT })).to.be.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
          })

          describe("performUpKeep", function () {
              it("performUpkeep not needed", async function () {
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })

                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })

              it("updates the raffle state and emits a requestId", async () => {
                  await raffle.enterRaffle({ value: FUND_AMOUNT })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const txResponse = await raffle.performUpkeep("0x") // emits requestId
                  const txReceipt = await txResponse.wait(1) // waits 1 block
                  const raffleState = await raffle.getRaffleState() // updates state
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
                  assert(raffleState == 1) // 0 = open, 1 = calculating
              })

              it("performUpkeep emit event raffle winner", async function () {
                  await raffle.enterRaffle({ value: FUND_AMOUNT })
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })

                  await expect(raffle.performUpkeep([])).to.be.emit(raffle, "RequestedRaffleWinner")
              })
          })

          describe("performRandomWord", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: FUND_AMOUNT })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
              })
              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
              })

              //   it("emit event", async () => {
              //     await raffle.performUpkeep([])
              //     await raffle.
              //   })

              // This test is too big...
              // This test simulates users entering the raffle and wraps the entire functionality of the raffle
              // inside a promise that will resolve if everything is successful.
              // An event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // All the assertions are done once the WinnerPicked event is fired

              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3 // to test
                  const startingIndex = 2
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      // i = 2; i < 5; i=i+1
                      raffle = raffleContract.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
                      await raffle.enterRaffle({ value: FUND_AMOUNT })
                  }
                  const startingTimeStamp = await raffle.getLastTimeStamp() // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!")
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerBalance = await accounts[2].getBalance()
                              const endingTimeStamp = await raffle.getLastTimeStamp()
                              await expect(raffle.getPlayer(0)).to.be.reverted
                              // Comparisons to check if our ending values are correct:
                              assert.equal(recentWinner.toString(), accounts[2].address)
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                      .add(FUND_AMOUNT.mul(additionalEntrances).add(FUND_AMOUNT))
                                      .toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve() // if try passes, resolves the promise
                          } catch (e) {
                              reject(e) // if try fails, rejects the promise
                          }
                      })

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const startingBalance = await accounts[2].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      )
                  })
              })
          })
      })
