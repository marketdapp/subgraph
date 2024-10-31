import {OfferUpdated} from "../generated/templates/Offer/Offer";
import {Offer as OfferEntity, Offer} from "../generated/schema";
import {Offer as OfferContract} from "../generated/Market/Offer"
import {Address, dataSource, log} from '@graphprotocol/graph-ts';
import {Market as MarketContract} from "../generated/Market/Market";
import {getRangingModifier, updateProfileFor} from "./profile";

export function fetchAndSaveOffer(target: Address, market: Address): Offer {
  let offerContract = OfferContract.bind(target);
  let offer = new OfferEntity(target.toHex());

  let ownerResult = offerContract.try_owner();
  if (!ownerResult.reverted) {
    offer.owner = ownerResult.value;
  }

  let isSellResult = offerContract.try_isSell();
  if (!isSellResult.reverted) {
    offer.isSell = isSellResult.value;
  }

  let tokenResult = offerContract.try_token();
  if (!tokenResult.reverted) {
    offer.token = tokenResult.value;
  }

  let fiatResult = offerContract.try_fiat();
  if (!fiatResult.reverted) {
    offer.fiat = fiatResult.value;
  }

  let methodResult = offerContract.try_method();
  if (!methodResult.reverted) {
    offer.method = methodResult.value;
  }

  let rateResult = offerContract.try_rate();
  if (!rateResult.reverted) {
    offer.rate = rateResult.value;
  }

  let limitsResult = offerContract.try_limits();
  if (!limitsResult.reverted) {
    offer.minFiat = limitsResult.value.getMin().toI32();
    offer.maxFiat = limitsResult.value.getMax().toI32();
  }

  let termsResult = offerContract.try_terms();
  if (!termsResult.reverted) {
    offer.terms = termsResult.value;
  }

  let disabledResult = offerContract.try_disabled();
  if (!disabledResult.reverted) {
    offer.disabled = disabledResult.value;
  }

  let marketContract = MarketContract.bind(market);

  let repTokenResult = marketContract.try_repToken();
  let repTokenAddress = repTokenResult.value;

  const profile = updateProfileFor(repTokenAddress, Address.fromBytes(offer.owner));
  offer.profile = profile ? profile.id : null;
  if (offer.isSell) {
    // ASC sorting, lowest first, so decrease goodstanding
    offer.ranging = offer.rate * 10000 / getRangingModifier(profile);
  } else {
    // DESC sorting, highest first so increase goodstanding
    offer.ranging = offer.rate * getRangingModifier(profile) * 100;
  }

  offer.save();
  return offer;
}

export function handleOfferUpdated(event: OfferUpdated): void {
  fetchAndSaveOffer(event.address, Address.fromString(dataSource.context().getString('marketAddress')))
}