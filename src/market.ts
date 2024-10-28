import { OfferCreated as OfferCreatedEvent } from "../generated/Market/Market"
import { Offer as OfferEntity, Profile as ProfileEntity } from "../generated/schema"
import { Offer as OfferContract } from "../generated/Market/Offer"
import { Market as MarketContract } from "../generated/Market/Market"
import { RepToken as RepTokenContract } from "../generated/Market/RepToken"
import { Address, BigInt } from "@graphprotocol/graph-ts"

export function handleOfferCreated(event: OfferCreatedEvent): void {
  let offer = new OfferEntity(event.params.offer.toHex())
  offer.token = event.params.token.toHexString()
  offer.fiat = event.params.fiat.toHexString()

  // Fetch data from the newly created Offer contract
  let offerContract = OfferContract.bind(event.params.offer as Address)

  let isSellResult = offerContract.try_isSell()
  if (!isSellResult.reverted) {
    offer.isSell = isSellResult.value
  }

  let methodResult = offerContract.try_method()
  if (!methodResult.reverted) {
    offer.method = methodResult.value
  }

  let rateResult = offerContract.try_rate()
  if (!rateResult.reverted) {
    offer.rate = rateResult.value
  }

  let limitsResult = offerContract.try_limits()
  if (!limitsResult.reverted) {
    offer.minFiat = limitsResult.value.getMin().toI32()
    offer.maxFiat = limitsResult.value.getMax().toI32()
  }

  let termsResult = offerContract.try_terms()
  if (!termsResult.reverted) {
    offer.terms = termsResult.value
  }

  offer.blockTimestamp = event.block.timestamp.toI32()

  // Fetch RepToken address from Market contract
  let marketContract = MarketContract.bind(event.address)
  let repTokenAddressResult = marketContract.try_repToken()

  if (repTokenAddressResult.reverted) {
    return
  }

  let repTokenAddress = repTokenAddressResult.value

  // Fetch tokenId from RepToken contract using ownerToTokenId
  let repTokenContract = RepTokenContract.bind(repTokenAddress)
  let tokenIdResult = repTokenContract.try_ownerToTokenId(event.params.owner)

  let profile = ProfileEntity.load(event.params.owner.toHexString())
  if (profile == null) {
    profile = new ProfileEntity(event.params.owner.toHexString())
  }

  if (!tokenIdResult.reverted) {
    let tokenId = tokenIdResult.value

    if (tokenId != BigInt.fromI32(0)) {
      // Fetch stats using tokenId
      let stats = repTokenContract.try_stats(tokenId)
      if (!stats.reverted) {
        profile.createdAt = stats.value.value0.toI32()
        profile.upvotes = stats.value.value1.toI32()
        profile.downvotes = stats.value.value2.toI32()
        profile.volumeUSD = stats.value.value3.toI32()
        profile.dealsCompleted = stats.value.value4.toI32()
        profile.dealsExpired = stats.value.value5.toI32()
        profile.disputesLost = stats.value.value6.toI32()
        profile.avgPaymentTime = stats.value.value7.toI32()
        profile.avgReleaseTime = stats.value.value8.toI32()
      }
    }
  }

  profile.save()
  offer.owner = profile.id
  offer.save()
}
