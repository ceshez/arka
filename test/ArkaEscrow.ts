import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { getCreate2Address, keccak256, parseEther, toHex } from 'viem'

const TARGET = parseEther('1')

async function deployFixture() {
  const { viem, networkHelpers } = await network.create()
  const [host, alice, bob] = await viem.getWalletClients()
  const publicClient = await viem.getPublicClient()
  const now = await networkHelpers.time.latest()
  const deadline = BigInt(now + 3_600)
  const escrow = await viem.deployContract('ArkaEscrow', [
    host.account.address,
    deadline,
    TARGET,
    'Cena de prueba',
    'ARKA42',
  ])
  return { escrow, host, alice, bob, deadline, networkHelpers, publicClient }
}

describe('ArkaEscrow', () => {
  it('deploys through the singleton-factory interface at the predicted CREATE2 address', async () => {
    const { viem, networkHelpers } = await network.create()
    const [host] = await viem.getWalletClients()
    const publicClient = await viem.getPublicClient()
    const factory = await viem.deployContract('TestSingletonFactory')
    const deadline = BigInt((await networkHelpers.time.latest()) + 3_600)
    const initCode = await factory.read.buildArkaInitCode([
      host.account.address,
      deadline,
      TARGET,
      'Factory Arka',
      'ARKA99',
    ])
    const salt = keccak256(toHex(`arka:${host.account.address}:ARKA99`))
    const expectedAddress = getCreate2Address({
      from: factory.address,
      salt,
      bytecodeHash: keccak256(initCode),
    })

    await factory.write.deploy([initCode, salt])

    assert.ok(await publicClient.getBytecode({ address: expectedAddress }))
    const escrow = await viem.getContractAt('ArkaEscrow', expectedAddress)
    assert.equal((await escrow.read.host()).toLowerCase(), host.account.address.toLowerCase())
    assert.equal(await escrow.read.targetAmount(), TARGET)
  })

  it('records partial deposits and rejects overfunding', async () => {
    const { escrow, alice, bob } = await deployFixture()

    await escrow.write.deposit({ account: alice.account, value: parseEther('0.4') })
    assert.equal(await escrow.read.contributions([alice.account.address]), parseEther('0.4'))
    assert.equal(await escrow.read.totalDeposited(), parseEther('0.4'))

    await assert.rejects(
      escrow.write.deposit({ account: bob.account, value: parseEther('0.7') }),
    )
  })

  it('automatically releases the target to the host', async () => {
    const { escrow, host, alice, bob, publicClient } = await deployFixture()
    const hostBefore = await publicClient.getBalance({ address: host.account.address })

    await escrow.write.deposit({ account: alice.account, value: parseEther('0.4') })
    await escrow.write.deposit({ account: bob.account, value: parseEther('0.6') })

    const hostAfter = await publicClient.getBalance({ address: host.account.address })
    assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n)
    assert.equal(await escrow.read.totalDeposited(), TARGET)
    assert.ok((await escrow.read.releasedAt()) > 0n)
    assert.equal(hostAfter - hostBefore, TARGET)
  })

  it('blocks early refunds and refunds each contributor after expiry', async () => {
    const { escrow, alice, bob, deadline, networkHelpers } = await deployFixture()
    await escrow.write.deposit({ account: alice.account, value: parseEther('0.25') })
    await escrow.write.deposit({ account: bob.account, value: parseEther('0.15') })

    await assert.rejects(escrow.write.refund({ account: alice.account }))
    await networkHelpers.time.increaseTo(deadline)

    await escrow.write.refund({ account: alice.account })
    await escrow.write.refund({ account: bob.account })
    assert.equal(await escrow.read.totalRefunded(), parseEther('0.4'))
    assert.equal(await escrow.read.contributions([alice.account.address]), 0n)
    await assert.rejects(escrow.write.refund({ account: alice.account }))
  })

  it('lets only the host cancel and enables immediate refunds', async () => {
    const { escrow, host, alice } = await deployFixture()
    await escrow.write.deposit({ account: alice.account, value: parseEther('0.2') })

    await assert.rejects(escrow.write.cancel({ account: alice.account }))
    await escrow.write.cancel({ account: host.account })
    assert.equal(await escrow.read.cancelled(), true)
    assert.equal(await escrow.read.refundableNow(), true)

    await escrow.write.refund({ account: alice.account })
    assert.equal(await escrow.read.totalRefunded(), parseEther('0.2'))
  })

  it('rejects deposits once the deadline has passed', async () => {
    const { escrow, alice, deadline, networkHelpers } = await deployFixture()
    await networkHelpers.time.increaseTo(deadline)
    await assert.rejects(
      escrow.write.deposit({ account: alice.account, value: parseEther('0.1') }),
    )
  })
})
